"""Composition layer: metrics + score + model + signals, assembled once.

The demo dataset is static, so the whole portfolio is computed on first request
and held in memory. On a real integration this is the seam where the cache would
become a scheduled job writing into `score_snapshots`.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.analytics import model as ml
from app.analytics import signals as sig
from app.analytics.features import build_features
from app.analytics.forecast import detect_changepoint, holt_forecast
from app.analytics.metrics import (
    ResidenceMetrics,
    band_benchmarks,
    compute_portfolio,
    median,
    percentile_in,
)
from app.analytics.scoring import score
from app.catalog import FAMILIES, MODULE_BY_KEY, MODULES, REGION_BY_KEY
from app.core.config import SNAPSHOT_DATE

_CACHE: dict[str, Any] = {}


def as_of_date() -> date:
    return date.fromisoformat(SNAPSHOT_DATE)


def invalidate() -> None:
    _CACHE.clear()
    ml.load_model.cache_clear()


def _build(db: Session, as_of: date) -> dict:
    portfolio = compute_portfolio(db, as_of)
    bands = band_benchmarks(portfolio)
    has_model = ml.model_available()

    records: list[dict] = []
    for rm in portfolio.values():
        band_vals = bands.get(rm.size_band, [])
        sc = score(rm, band_vals)

        risk = None
        if has_model:
            feats = build_features(rm, band_vals)
            risk = ml.predict(feats)

        peer_median = median([
            p.events_per_resident_week for p in portfolio.values()
            if p.size_band == rm.size_band
        ])
        detected = sig.detect(rm, as_of, peer_median)
        for s in detected:
            s["residence_id"] = rm.id
            s["residence_slug"] = rm.slug
            s["residence_name"] = rm.name
            s["mrr_clp"] = rm.mrr_clp
            s["owner"] = rm.owner
            s["priority"] = sig.priority_of(s, rm, risk["probability"] if risk else None)
            s["id"] = f"{rm.slug}:{s['key']}:{s.get('module') or '-'}"

        records.append({
            "metrics": rm,
            "score": sc,
            "risk": risk,
            "signals": detected,
            "peer_median": peer_median,
        })

    records.sort(key=lambda r: r["metrics"].name)
    return {
        "as_of": as_of,
        "records": records,
        "bands": bands,
        "by_slug": {r["metrics"].slug: r for r in records},
        "has_model": has_model,
    }


def get_state(db: Session, as_of: date | None = None) -> dict:
    as_of = as_of or as_of_date()
    key = as_of.isoformat()
    if key not in _CACHE:
        _CACHE[key] = _build(db, as_of)
    return _CACHE[key]


# --- shaping helpers -------------------------------------------------------

def residence_row(rec: dict) -> dict:
    """Compact shape for the portfolio table."""
    rm: ResidenceMetrics = rec["metrics"]
    sc = rec["score"]
    risk = rec["risk"]
    # 12 weekly buckets for the row sparkline.
    weekly = []
    s = rm.series[-84:]
    for i in range(0, len(s), 7):
        weekly.append(sum(s[i:i + 7]))

    return {
        "id": rm.id,
        "slug": rm.slug,
        "name": rm.name,
        "region": rm.region,
        "region_name": REGION_BY_KEY[rm.region]["name"],
        "comuna": rm.comuna,
        "plan": rm.plan,
        "beds": rm.beds,
        "residents": rm.residents,
        "size_band": rm.size_band,
        "owner": rm.owner,
        "mrr_clp": rm.mrr_clp,
        "days_to_renewal": rm.days_to_renewal,
        "tenure_days": rm.tenure_days,
        "index": sc["index"],
        "status": sc["status"],
        "trend_pct": sc["trend_pct"],
        "events_28": rm.events_28,
        "intensity": round(rm.events_per_resident_week, 1),
        "active_users": rm.active_users_28,
        "licensed_seats": rm.licensed_seats,
        "modules_active": len(rm.modules_active),
        "modules_contracted": len(rm.modules_contracted),
        "days_since_activity": rm.days_since_activity,
        "last_activity": rm.last_activity.isoformat() if rm.last_activity else None,
        "open_tickets": rm.open_tickets,
        "sparkline": weekly,
        "risk": None if not risk else {
            "probability": risk["probability"],
            "band": risk["band"],
            "top_driver_es": risk["drivers"][0]["label_es"] if risk["drivers"] else None,
            "top_driver_en": risk["drivers"][0]["label_en"] if risk["drivers"] else None,
        },
        "signal_count": len(rec["signals"]),
        "top_signal": rec["signals"][0]["key"] if rec["signals"] else None,
    }


def residence_detail(db: Session, rec: dict, as_of: date) -> dict:
    rm: ResidenceMetrics = rec["metrics"]
    row = residence_row(rec)

    daily = [
        {"day": (rm.series_start + timedelta(days=i)).isoformat(), "events": v}
        for i, v in enumerate(rm.series)
    ]

    module_rows = []
    for mkey in rm.modules_contracted:
        m = MODULE_BY_KEY[mkey]
        now = rm.module_events_28.get(mkey, 0)
        prev = rm.module_events_prev.get(mkey, 0)
        last = rm.module_last_seen.get(mkey)
        module_rows.append({
            "key": mkey,
            "name_es": m["name_es"], "name_en": m["name_en"],
            "family": m["family"], "cadence": m["cadence"],
            "compliance": m["compliance"],
            "events_28": now, "events_prev": prev,
            "delta_pct": round((now - prev) / prev * 100, 1) if prev else (100.0 if now else 0.0),
            "active_days": rm.module_active_days.get(mkey, 0),
            "lifetime": rm.module_lifetime.get(mkey, 0),
            "last_seen": last.isoformat() if last else None,
            "days_silent": (as_of - last).days if last else None,
            "state": (
                "nunca" if rm.module_lifetime.get(mkey, 0) == 0
                else "inactivo" if now == 0
                else "bajo" if prev and now < prev * 0.6
                else "activo"
            ),
        })

    # per-module daily series for the stacked family chart
    fam_series: dict[str, list[int]] = {f["key"]: [0] * len(rm.series) for f in FAMILIES}
    rows = db.execute(text("""
        SELECT day, module, SUM(events) AS ev FROM usage_daily
        WHERE residence_id = :rid AND day BETWEEN :a AND :b
        GROUP BY day, module
    """), {"rid": rm.id, "a": rm.series_start, "b": as_of}).all()
    for r in rows:
        i = (date.fromisoformat(str(r.day)) - rm.series_start).days
        fam = MODULE_BY_KEY[r.module]["family"]
        if 0 <= i < len(rm.series):
            fam_series[fam][i] += r.ev

    tickets = [
        {
            "opened_at": str(t.opened_at), "closed_at": str(t.closed_at) if t.closed_at else None,
            "module": t.module, "subject_es": t.subject, "subject_en": t.subject_en,
            "priority": t.priority, "status": t.status,
        }
        for t in db.execute(text(
            "SELECT * FROM tickets WHERE residence_id=:rid ORDER BY opened_at DESC LIMIT 12"
        ), {"rid": rm.id}).all()
    ]

    interactions = [
        {
            "day": str(i.day), "channel": i.channel, "direction": i.direction,
            "author": i.author, "summary_es": i.summary, "summary_en": i.summary_en,
        }
        for i in db.execute(text(
            "SELECT * FROM interactions WHERE residence_id=:rid ORDER BY day DESC LIMIT 12"
        ), {"rid": rm.id}).all()
    ]

    return {
        **row,
        "legal_name": db.execute(text("SELECT legal_name FROM residences WHERE id=:i"),
                                 {"i": rm.id}).scalar(),
        "rut": db.execute(text("SELECT rut FROM residences WHERE id=:i"), {"i": rm.id}).scalar(),
        "contact_name": rm.contact_name,
        "contact_role": rm.contact_role,
        "whatsapp_group": rm.whatsapp_group,
        "pipedrive_id": rm.pipedrive_id,
        "onboarded_at": rm.onboarded_at.isoformat(),
        "renewal_at": rm.renewal_at.isoformat(),
        "score": rec["score"],
        "risk_full": rec["risk"],
        "signals": sorted(rec["signals"], key=lambda s: -s["priority"]),
        "series_daily": daily,
        "series_family": {k: v for k, v in fam_series.items()},
        "series_start": rm.series_start.isoformat(),
        "modules": module_rows,
        "users": rm.user_events_28,
        "tickets": tickets,
        "interactions": interactions,
        "forecast": holt_forecast(rm.series, rm.series_start),
        "changepoint": detect_changepoint(rm.series, rm.series_start),
        "peer_median_intensity": round(rec["peer_median"], 2),
        "band_percentile": round(100 * percentile_in(
            sorted([p["metrics"].events_per_resident_week
                    for p in _CACHE[as_of.isoformat()]["records"]
                    if p["metrics"].size_band == rm.size_band]),
            rm.events_per_resident_week,
        )),
    }
