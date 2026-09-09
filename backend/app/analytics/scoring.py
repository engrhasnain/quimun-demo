"""Índice de Uso — the usage index.

Deliberately *not* a black-box health score. Four pillars, each one a number a
residence director would recognise, each reported alongside the raw figure that
produced it, so the answer to "why is this account at 48?" is always on screen.

Trend is kept OUT of the index and reported beside it. That separation matters:
the brief asks for early detection of decline, and a residence can sit at 78 and
still be the most urgent account in the book if it was at 92 a month ago.
"""

from __future__ import annotations

from app.catalog import CLINICAL_ROLES, MODULE_BY_KEY
from app.analytics.metrics import (
    ResidenceMetrics,
    percentile_in,
)

WEIGHTS = {
    "intensity": 0.30,
    "breadth": 0.25,
    "coverage": 0.25,
    "consistency": 0.20,
}


def _intensity(rm: ResidenceMetrics, band_vals: list[float]) -> float:
    """Peer-normalised volume: where this residence sits against its own size band."""
    pct = percentile_in(band_vals, rm.events_per_resident_week)
    # Compress the extremes: being in the 99th percentile is not 2x better than
    # the 80th for retention purposes, and the floor should not be a hard zero.
    return round(8 + 92 * (pct ** 0.85), 1)


def _breadth(rm: ResidenceMetrics) -> float:
    """Share of contracted value actually in use, weighted by module importance."""
    contracted = [m for m in rm.modules_contracted if m in MODULE_BY_KEY]
    if not contracted:
        return 0.0
    total_w = sum(MODULE_BY_KEY[m]["weight"] for m in contracted)
    used_w = sum(
        MODULE_BY_KEY[m]["weight"]
        for m in contracted
        if rm.module_events_28.get(m, 0) > 0
    )
    return round(100 * used_w / total_w, 1)


def _coverage(rm: ResidenceMetrics) -> float:
    """Is the whole team on the platform, or one person keeping it alive?"""
    seats = rm.seat_coverage
    expected_roles = {"administrador", "enfermera_jefe"}
    if rm.residents >= 25:
        expected_roles.add("tens")
    role_mix = len(rm.active_roles_28 & expected_roles) / len(expected_roles)
    clinical_present = 1.0 if (rm.active_roles_28 & CLINICAL_ROLES) else 0.0
    # Concentration penalty: one seat carrying everything is fragile even when
    # raw volume looks fine.
    concentration_penalty = max(0.0, (rm.top_user_share - 0.55)) * 0.9
    raw = 0.50 * seats + 0.30 * role_mix + 0.20 * clinical_present - concentration_penalty
    return round(100 * max(0.0, min(1.0, raw)), 1)


def _consistency(rm: ResidenceMetrics) -> float:
    """Rhythm. Daily modules used daily, not in a monthly catch-up burst."""
    from app.core.config import WINDOW
    day_rate = rm.active_days_28 / WINDOW
    daily_rate = rm.daily_module_consistency
    raw = 0.45 * day_rate + 0.55 * daily_rate
    return round(100 * max(0.0, min(1.0, raw)), 1)


# Status thresholds are *policy*, not arithmetic, and they are calibrated
# against the current portfolio distribution (p25 ≈ 73, median ≈ 83). They are
# meant to be retuned once real data lands - which is why they live here as
# named constants rather than scattered through the rules.
T_CRITICAL_TREND = -45.0
T_RISK_TREND = -25.0
T_WATCH_TREND = -10.0
T_LOW_INDEX = 62.0
T_FLOOR_INDEX = 58.0
T_WATCH_INDEX = 75.0
T_STALE_DAYS = 14


def status_for(index: float, trend_pct: float, days_since_activity: int) -> str:
    """Traffic light.

    Index and trend are combined rather than OR-ed. A residence with a modest
    index that is *growing* needs a light touch, not an intervention; a
    comfortable index that is falling 30% a month needs one today. Treating
    those two the same is the mistake that makes health scores get ignored.
    """
    if (
        days_since_activity >= T_STALE_DAYS
        or trend_pct <= T_CRITICAL_TREND
        or (index < T_LOW_INDEX and trend_pct <= T_RISK_TREND)
    ):
        return "critico"
    if (
        trend_pct <= T_RISK_TREND
        or index < T_FLOOR_INDEX
        or (index < T_LOW_INDEX and trend_pct <= T_WATCH_TREND)
    ):
        return "en_riesgo"
    if trend_pct <= T_WATCH_TREND or index < T_WATCH_INDEX:
        return "observacion"
    return "saludable"


def score(rm: ResidenceMetrics, band_vals: list[float]) -> dict:
    pillars = {
        "intensity": _intensity(rm, band_vals),
        "breadth": _breadth(rm),
        "coverage": _coverage(rm),
        "consistency": _consistency(rm),
    }
    index = round(sum(pillars[k] * WEIGHTS[k] for k in WEIGHTS), 1)
    st = status_for(index, rm.trend_pct, rm.days_since_activity)

    return {
        "index": index,
        "status": st,
        "trend_pct": round(rm.trend_pct, 1),
        "pillars": [
            {
                "key": "intensity",
                "value": pillars["intensity"],
                "weight": WEIGHTS["intensity"],
                "evidence": {
                    "events_per_resident_week": round(rm.events_per_resident_week, 1),
                    "band": rm.size_band,
                    "band_percentile": round(100 * percentile_in(band_vals, rm.events_per_resident_week)),
                    "peers": len(band_vals),
                },
            },
            {
                "key": "breadth",
                "value": pillars["breadth"],
                "weight": WEIGHTS["breadth"],
                "evidence": {
                    "modules_active": len(rm.modules_active),
                    "modules_contracted": len(rm.modules_contracted),
                    "never_used": rm.modules_never_used,
                },
            },
            {
                "key": "coverage",
                "value": pillars["coverage"],
                "weight": WEIGHTS["coverage"],
                "evidence": {
                    "active_users": rm.active_users_28,
                    "licensed_seats": rm.licensed_seats,
                    "top_user_share": round(100 * rm.top_user_share),
                    "top_user": rm.top_user_name,
                    "roles_active": sorted(rm.active_roles_28),
                },
            },
            {
                "key": "consistency",
                "value": pillars["consistency"],
                "weight": WEIGHTS["consistency"],
                "evidence": {
                    "active_days": rm.active_days_28,
                    "window": 28,
                    "daily_module_rate": round(100 * rm.daily_module_consistency),
                    "clinical_gap_days": rm.clinical_gap_days,
                },
            },
        ],
    }
