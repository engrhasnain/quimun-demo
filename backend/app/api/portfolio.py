"""Portfolio-level endpoints: the answer to 'how is the whole book doing?'."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.analytics import service
from app.analytics.metrics import median
from app.catalog import MODULE_BY_KEY, MODULES, REGION_BY_KEY
from app.db import get_db

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/summary")
def summary(db: Session = Depends(get_db)) -> dict:
    state = service.get_state(db)
    recs = state["records"]
    as_of = state["as_of"]

    status_counts = Counter(r["score"]["status"] for r in recs)
    indices = [r["score"]["index"] for r in recs]

    total_mrr = sum(r["metrics"].mrr_clp for r in recs)
    attention = [r for r in recs if r["score"]["status"] in ("en_riesgo", "critico")]
    watch = [r for r in recs if r["score"]["status"] == "observacion"]
    mrr_at_risk = sum(r["metrics"].mrr_clp for r in attention)

    events_28 = sum(r["metrics"].events_28 for r in recs)
    events_prev = sum(r["metrics"].events_prev for r in recs)

    # Portfolio-wide daily activity, folded to weeks for a readable trend line.
    n = len(recs[0]["metrics"].series) if recs else 0
    daily_total = [0] * n
    for r in recs:
        for i, v in enumerate(r["metrics"].series):
            daily_total[i] += v
    start = recs[0]["metrics"].series_start if recs else None
    weekly = []
    if start:
        usable = (n // 7) * 7
        tail = daily_total[n - usable:]
        tstart = start + timedelta(days=n - usable)
        for i in range(0, usable, 7):
            weekly.append({
                "week_start": (tstart + timedelta(days=i)).isoformat(),
                "events": sum(tail[i:i + 7]),
            })

    # Module adoption across the book.
    module_stats = []
    for m in MODULES:
        contracted = [r for r in recs if m["key"] in r["metrics"].modules_contracted]
        active = [r for r in contracted if r["metrics"].module_events_28.get(m["key"], 0) > 0]
        never = [r for r in contracted if r["metrics"].module_lifetime.get(m["key"], 0) == 0]
        ev = sum(r["metrics"].module_events_28.get(m["key"], 0) for r in contracted)
        prev = sum(r["metrics"].module_events_prev.get(m["key"], 0) for r in contracted)
        module_stats.append({
            "key": m["key"], "name_es": m["name_es"], "name_en": m["name_en"],
            "family": m["family"], "cadence": m["cadence"], "compliance": m["compliance"],
            "contracted": len(contracted), "active": len(active), "never": len(never),
            "adoption_pct": round(100 * len(active) / len(contracted), 1) if contracted else 0.0,
            "events_28": ev, "events_prev": prev,
            "delta_pct": round((ev - prev) / prev * 100, 1) if prev else 0.0,
        })

    # Biggest movers, ignoring accounts too small for the percentage to mean much.
    movers = [
        {
            "slug": r["metrics"].slug, "name": r["metrics"].name,
            "trend_pct": r["score"]["trend_pct"], "index": r["score"]["index"],
            "status": r["score"]["status"], "events_28": r["metrics"].events_28,
        }
        for r in recs if r["metrics"].events_prev >= 200
    ]
    movers.sort(key=lambda m: m["trend_pct"])

    by_region = defaultdict(lambda: {"n": 0, "index": [], "mrr": 0, "attention": 0})
    for r in recs:
        k = r["metrics"].region
        by_region[k]["n"] += 1
        by_region[k]["index"].append(r["score"]["index"])
        by_region[k]["mrr"] += r["metrics"].mrr_clp
        if r["score"]["status"] in ("en_riesgo", "critico"):
            by_region[k]["attention"] += 1
    regions = [
        {
            "key": k, "name": REGION_BY_KEY[k]["name"], "residences": v["n"],
            "avg_index": round(sum(v["index"]) / len(v["index"]), 1),
            "mrr_clp": v["mrr"], "attention": v["attention"],
        }
        for k, v in sorted(by_region.items(), key=lambda kv: -kv[1]["n"])
    ]

    by_band = defaultdict(lambda: {"n": 0, "index": [], "intensity": []})
    for r in recs:
        k = r["metrics"].size_band
        by_band[k]["n"] += 1
        by_band[k]["index"].append(r["score"]["index"])
        by_band[k]["intensity"].append(r["metrics"].events_per_resident_week)
    bands = [
        {
            "key": k, "residences": v["n"],
            "avg_index": round(sum(v["index"]) / len(v["index"]), 1),
            "median_intensity": round(median(v["intensity"]), 1),
        }
        for k, v in by_band.items()
    ]

    all_signals = [s for r in recs for s in r["signals"]]
    sig_by_key = Counter(s["key"] for s in all_signals)
    sig_by_sev = Counter(s["severity"] for s in all_signals)

    risk_bands = Counter(
        r["risk"]["band"] for r in recs if r["risk"]
    ) if state["has_model"] else Counter()

    early_warning = sorted(
        [
            {
                "slug": r["metrics"].slug, "name": r["metrics"].name,
                "index": r["score"]["index"], "trend_pct": r["score"]["trend_pct"],
                "probability": r["risk"]["probability"],
                "driver_es": r["risk"]["drivers"][0]["label_es"] if r["risk"]["drivers"] else None,
                "driver_en": r["risk"]["drivers"][0]["label_en"] if r["risk"]["drivers"] else None,
                "mrr_clp": r["metrics"].mrr_clp,
            }
            for r in recs
            if r["risk"] and r["score"]["status"] == "saludable"
            and r["risk"]["band"] in ("alto", "medio")
        ],
        key=lambda x: -x["probability"],
    )[:6]

    return {
        "as_of": as_of.isoformat(),
        "has_model": state["has_model"],
        "residences": len(recs),
        "residents": sum(r["metrics"].residents for r in recs),
        "beds": sum(r["metrics"].beds for r in recs),
        "status_counts": dict(status_counts),
        "avg_index": round(sum(indices) / len(indices), 1) if indices else 0,
        "median_index": round(median(indices), 1),
        "mrr_clp": total_mrr,
        "mrr_at_risk_clp": mrr_at_risk,
        "attention_count": len(attention),
        "watch_count": len(watch),
        "events_28": events_28,
        "events_prev": events_prev,
        "events_trend_pct": round((events_28 - events_prev) / events_prev * 100, 1) if events_prev else 0.0,
        "active_users": sum(r["metrics"].active_users_28 for r in recs),
        "licensed_seats": sum(r["metrics"].licensed_seats for r in recs),
        "open_tickets": sum(r["metrics"].open_tickets for r in recs),
        "weekly_activity": weekly,
        "modules": module_stats,
        "decliners": movers[:6],
        "risers": list(reversed(movers[-6:])),
        "regions": regions,
        "bands": bands,
        "signal_counts": dict(sig_by_key),
        "signal_severity": dict(sig_by_sev),
        "signal_total": len(all_signals),
        "risk_bands": dict(risk_bands),
        "early_warning": early_warning,
    }
