"""Projection and change-point detection.

Both are deliberately small, transparent statistics rather than a second model:

  * Holt's linear trend on weekly totals. Weekly, not daily, because the weekday
    shape of this data is enormous (administrative modules essentially stop on
    Sundays) and would otherwise dominate any trend estimate.
  * A robust change-point scan using medians and MAD, so one freak day cannot
    manufacture an alert - which matters when the person acting on it is going
    to open WhatsApp and ask a real customer what happened.
"""

from __future__ import annotations

from datetime import date, timedelta

WEEKS_BACK = 16
ALPHA = 0.55   # level smoothing
BETA = 0.28    # trend smoothing


def _weekly(series: list[int], start: date) -> tuple[list[float], list[date]]:
    """Fold a daily series into aligned trailing weeks (most recent week last)."""
    n = len(series)
    usable = (n // 7) * 7
    tail = series[n - usable:]
    tail_start = start + timedelta(days=n - usable)
    weeks, labels = [], []
    for i in range(0, usable, 7):
        weeks.append(float(sum(tail[i:i + 7])))
        labels.append(tail_start + timedelta(days=i))
    return weeks[-WEEKS_BACK:], labels[-WEEKS_BACK:]


def holt_forecast(series: list[int], start: date, horizon_weeks: int = 4) -> dict:
    weeks, labels = _weekly(series, start)
    if len(weeks) < 4:
        return {"available": False}

    level = weeks[0]
    trend = weeks[1] - weeks[0]
    fitted = [level]
    for y in weeks[1:]:
        prev_level = level
        level = ALPHA * y + (1 - ALPHA) * (level + trend)
        trend = BETA * (level - prev_level) + (1 - BETA) * trend
        fitted.append(level)

    residuals = [weeks[i] - fitted[i] for i in range(len(weeks))]
    n = len(residuals)
    mean_r = sum(residuals) / n
    var = sum((r - mean_r) ** 2 for r in residuals) / max(1, n - 1)
    sigma = var ** 0.5

    projected = []
    last_label = labels[-1]
    for h in range(1, horizon_weeks + 1):
        point = max(0.0, level + h * trend)
        # Uncertainty widens with horizon (random-walk-with-drift approximation).
        spread = 1.96 * sigma * (h ** 0.5)
        projected.append({
            "week_start": (last_label + timedelta(days=7 * h)).isoformat(),
            "point": round(point),
            "low": round(max(0.0, point - spread)),
            "high": round(point + spread),
        })

    current = weeks[-1]
    projected_30 = sum(p["point"] for p in projected[:4]) * (30 / 28)
    recent_30 = sum(weeks[-4:]) * (30 / 28) if len(weeks) >= 4 else current * 4.3
    change = ((projected_30 - recent_30) / recent_30 * 100) if recent_30 > 0 else 0.0

    return {
        "available": True,
        "history": [
            {"week_start": labels[i].isoformat(), "actual": round(weeks[i])}
            for i in range(len(weeks))
        ],
        "projection": projected,
        "weekly_trend": round(trend, 1),
        "projected_30d": round(projected_30),
        "recent_30d": round(recent_30),
        "change_pct": round(change, 1),
    }


def _median(v: list[float]) -> float:
    if not v:
        return 0.0
    s = sorted(v)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def detect_changepoint(
    series: list[int],
    start: date,
    min_shift_pct: float = 22.0,
) -> dict | None:
    """Find the most pronounced sustained level shift in the series.

    Compares a trailing 14-day median against the preceding 42 days at every
    candidate day, and keeps the largest drop that clears both a relative
    threshold and a robust MAD-based significance check.
    """
    n = len(series)
    if n < 70:
        return None

    best = None
    for i in range(56, n - 13):
        before = [float(x) for x in series[i - 42:i]]
        after = [float(x) for x in series[i:i + 14]]
        m_before, m_after = _median(before), _median(after)
        if m_before <= 0:
            continue

        shift_pct = (m_after - m_before) / m_before * 100.0
        if shift_pct > -min_shift_pct:
            continue

        deviations = [abs(x - m_before) for x in before]
        mad = _median(deviations) or 1.0
        robust_z = (m_after - m_before) / (1.4826 * mad)
        if robust_z > -1.6:
            continue

        if best is None or shift_pct < best["shift_pct"]:
            best = {
                "day": (start + timedelta(days=i)).isoformat(),
                "shift_pct": round(shift_pct, 1),
                "robust_z": round(robust_z, 2),
                "before_median": round(m_before, 1),
                "after_median": round(m_after, 1),
            }
    return best
