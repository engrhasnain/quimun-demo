"""Aggregation layer.

All heavy lifting happens in SQL in a handful of GROUP BY passes covering the
whole portfolio at once, then gets assembled per residence in Python. The result
is cached per `as_of` date: the demo dataset is static, so the whole portfolio is
computed once on first request and served from memory afterwards.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.catalog import (
    CLINICAL_ROLES,
    DAILY_MODULES,
    MODULE_BY_KEY,
    modules_for_plan,
)
from app.core.config import PREV_WINDOW, SNAPSHOT_DATE, WINDOW

SERIES_DAYS = 182


@dataclass
class ResidenceMetrics:
    id: int
    slug: str
    name: str
    region: str
    comuna: str
    plan: str
    beds: int
    residents: int
    size_band: str
    licensed_seats: int
    onboarded_at: date
    renewal_at: date
    mrr_clp: int
    owner: str
    contact_name: str
    contact_role: str
    whatsapp_group: str
    pipedrive_id: str

    modules_contracted: list[str] = field(default_factory=list)
    events_28: int = 0
    events_prev: int = 0
    minutes_28: int = 0
    active_days_28: int = 0
    active_users_28: int = 0
    active_roles_28: set[str] = field(default_factory=set)
    top_user_share: float = 0.0
    top_user_name: str = ""
    user_events_28: list[dict] = field(default_factory=list)

    module_events_28: dict[str, int] = field(default_factory=dict)
    module_events_prev: dict[str, int] = field(default_factory=dict)
    module_last_seen: dict[str, date] = field(default_factory=dict)
    module_lifetime: dict[str, int] = field(default_factory=dict)
    module_active_days: dict[str, int] = field(default_factory=dict)

    series: list[int] = field(default_factory=list)     # daily events, SERIES_DAYS long
    series_start: date | None = None
    last_activity: date | None = None

    open_tickets: int = 0
    tickets_30: int = 0
    ticket_module_counts: dict[str, int] = field(default_factory=dict)
    last_interaction: date | None = None

    # --- derived -------------------------------------------------------
    @property
    def tenure_days(self) -> int:
        return (date.fromisoformat(SNAPSHOT_DATE) - self.onboarded_at).days

    @property
    def days_to_renewal(self) -> int:
        return (self.renewal_at - date.fromisoformat(SNAPSHOT_DATE)).days

    @property
    def events_per_resident_week(self) -> float:
        if self.residents <= 0:
            return 0.0
        return (self.events_28 / self.residents) / (WINDOW / 7)

    @property
    def prev_events_per_resident_week(self) -> float:
        if self.residents <= 0:
            return 0.0
        return (self.events_prev / self.residents) / (PREV_WINDOW / 7)

    @property
    def trend_pct(self) -> float:
        if self.events_prev <= 0:
            return 0.0 if self.events_28 == 0 else 100.0
        return (self.events_28 - self.events_prev) / self.events_prev * 100.0

    @property
    def seat_coverage(self) -> float:
        if self.licensed_seats <= 0:
            return 0.0
        return min(1.0, self.active_users_28 / self.licensed_seats)

    @property
    def modules_active(self) -> list[str]:
        return [m for m, v in self.module_events_28.items() if v > 0]

    @property
    def modules_never_used(self) -> list[str]:
        return [m for m in self.modules_contracted if self.module_lifetime.get(m, 0) == 0]

    @property
    def days_since_activity(self) -> int:
        if self.last_activity is None:
            return 999
        return (date.fromisoformat(SNAPSHOT_DATE) - self.last_activity).days

    @property
    def days_since_contact(self) -> int:
        if self.last_interaction is None:
            return 999
        return (date.fromisoformat(SNAPSHOT_DATE) - self.last_interaction).days

    @property
    def clinical_gap(self) -> tuple[str | None, int]:
        """The worst per-module recording gap among daily clinical modules.

        Returns (module, days). Per-module rather than "days with no clinical
        recording at all": a home that skipped the shift checklist for three
        weeks while still recording medication is a real and specific finding,
        and claiming "no clinical recording for 21 days" would overstate it -
        exactly the kind of claim a customer can disprove on the call.
        """
        worst_m, worst = None, 0
        for m in DAILY_MODULES:
            if m in self.modules_contracted and self.module_lifetime.get(m, 0) > 0:
                gap = WINDOW - self.module_active_days.get(m, 0)
                if gap > worst:
                    worst_m, worst = m, gap
        return worst_m, worst

    @property
    def clinical_gap_days(self) -> int:
        return self.clinical_gap[1]

    @property
    def daily_module_consistency(self) -> float:
        rates = [
            self.module_active_days.get(m, 0) / WINDOW
            for m in DAILY_MODULES
            if m in self.modules_contracted and self.module_lifetime.get(m, 0) > 0
        ]
        return sum(rates) / len(rates) if rates else 0.0


def _q(db: Session, sql: str, **params):
    return db.execute(text(sql), params).all()


def compute_portfolio(db: Session, as_of: date) -> dict[int, ResidenceMetrics]:
    """One pass over the whole book. Returns metrics keyed by residence id."""
    w_start = as_of - timedelta(days=WINDOW - 1)
    p_start = w_start - timedelta(days=PREV_WINDOW)
    p_end = w_start - timedelta(days=1)
    s_start = as_of - timedelta(days=SERIES_DAYS - 1)

    out: dict[int, ResidenceMetrics] = {}
    for r in _q(db, "SELECT * FROM residences ORDER BY name"):
        m = r._mapping
        rm = ResidenceMetrics(
            id=m["id"], slug=m["slug"], name=m["name"], region=m["region"],
            comuna=m["comuna"], plan=m["plan"], beds=m["beds"], residents=m["residents"],
            size_band=m["size_band"], licensed_seats=m["licensed_seats"],
            onboarded_at=date.fromisoformat(str(m["onboarded_at"])),
            renewal_at=date.fromisoformat(str(m["renewal_at"])),
            mrr_clp=m["mrr_clp"], owner=m["owner"], contact_name=m["contact_name"],
            contact_role=m["contact_role"], whatsapp_group=m["whatsapp_group"],
            pipedrive_id=m["pipedrive_id"],
        )
        rm.modules_contracted = modules_for_plan(rm.plan)
        rm.series_start = s_start
        rm.series = [0] * SERIES_DAYS
        out[rm.id] = rm

    # --- current window, per module ------------------------------------
    for row in _q(db, """
        SELECT residence_id, module, SUM(events) AS ev, SUM(minutes) AS mins,
               COUNT(DISTINCT day) AS active_days
        FROM usage_daily WHERE day BETWEEN :a AND :b
        GROUP BY residence_id, module
    """, a=w_start, b=as_of):
        rm = out.get(row.residence_id)
        if rm:
            rm.module_events_28[row.module] = row.ev
            rm.module_active_days[row.module] = row.active_days
            rm.events_28 += row.ev
            rm.minutes_28 += row.mins or 0

    # --- previous window, per module ------------------------------------
    for row in _q(db, """
        SELECT residence_id, module, SUM(events) AS ev
        FROM usage_daily WHERE day BETWEEN :a AND :b
        GROUP BY residence_id, module
    """, a=p_start, b=p_end):
        rm = out.get(row.residence_id)
        if rm:
            rm.module_events_prev[row.module] = row.ev
            rm.events_prev += row.ev

    # --- lifetime + last seen per module --------------------------------
    for row in _q(db, """
        SELECT residence_id, module, SUM(events) AS ev, MAX(day) AS last_day
        FROM usage_daily WHERE day <= :b
        GROUP BY residence_id, module
    """, b=as_of):
        rm = out.get(row.residence_id)
        if rm:
            rm.module_lifetime[row.module] = row.ev
            rm.module_last_seen[row.module] = date.fromisoformat(str(row.last_day))

    # --- active days & last activity ------------------------------------
    for row in _q(db, """
        SELECT residence_id, COUNT(DISTINCT day) AS d
        FROM usage_daily WHERE day BETWEEN :a AND :b GROUP BY residence_id
    """, a=w_start, b=as_of):
        if rm := out.get(row.residence_id):
            rm.active_days_28 = row.d

    for row in _q(db, """
        SELECT residence_id, MAX(day) AS last_day
        FROM usage_daily WHERE day <= :b GROUP BY residence_id
    """, b=as_of):
        if rm := out.get(row.residence_id):
            rm.last_activity = date.fromisoformat(str(row.last_day))

    # --- per-user activity in window -------------------------------------
    for row in _q(db, """
        SELECT u.residence_id AS rid, u.id AS uid, u.name AS uname, u.role AS urole,
               SUM(d.events) AS ev, MAX(d.day) AS last_day
        FROM usage_daily d JOIN staff_users u ON u.id = d.user_id
        WHERE d.day BETWEEN :a AND :b
        GROUP BY u.residence_id, u.id, u.name, u.role
        ORDER BY ev DESC
    """, a=w_start, b=as_of):
        rm = out.get(row.rid)
        if not rm:
            continue
        rm.user_events_28.append({
            "id": row.uid, "name": row.uname, "role": row.urole,
            "events": row.ev, "last_seen": str(row.last_day),
        })
        rm.active_users_28 += 1
        rm.active_roles_28.add(row.urole)

    for rm in out.values():
        rm.user_events_28.sort(key=lambda u: -u["events"])
        if rm.user_events_28 and rm.events_28 > 0:
            rm.top_user_share = rm.user_events_28[0]["events"] / rm.events_28
            rm.top_user_name = rm.user_events_28[0]["name"]

    # --- daily series -----------------------------------------------------
    for row in _q(db, """
        SELECT residence_id, day, SUM(events) AS ev
        FROM usage_daily WHERE day BETWEEN :a AND :b
        GROUP BY residence_id, day
    """, a=s_start, b=as_of):
        rm = out.get(row.residence_id)
        if rm:
            i = (date.fromisoformat(str(row.day)) - s_start).days
            if 0 <= i < SERIES_DAYS:
                rm.series[i] = row.ev

    # --- tickets ----------------------------------------------------------
    for row in _q(db, """
        SELECT residence_id,
               SUM(CASE WHEN status='abierto' THEN 1 ELSE 0 END) AS open_n,
               SUM(CASE WHEN opened_at >= :t30 THEN 1 ELSE 0 END) AS n30
        FROM tickets WHERE opened_at <= :b GROUP BY residence_id
    """, t30=as_of - timedelta(days=30), b=as_of):
        if rm := out.get(row.residence_id):
            rm.open_tickets = row.open_n or 0
            rm.tickets_30 = row.n30 or 0

    for row in _q(db, """
        SELECT residence_id, module, COUNT(*) AS n FROM tickets
        WHERE opened_at BETWEEN :a AND :b AND module IS NOT NULL
        GROUP BY residence_id, module
    """, a=as_of - timedelta(days=30), b=as_of):
        if rm := out.get(row.residence_id):
            rm.ticket_module_counts[row.module] = row.n

    for row in _q(db, """
        SELECT residence_id, MAX(day) AS last_day FROM interactions
        WHERE day <= :b GROUP BY residence_id
    """, b=as_of):
        if rm := out.get(row.residence_id):
            rm.last_interaction = date.fromisoformat(str(row.last_day))

    return out


def band_benchmarks(portfolio: dict[int, ResidenceMetrics]) -> dict[str, list[float]]:
    """Sorted intensity values per size band, for percentile lookups.

    The brief is explicit that customer sizes differ wildly, so a residence is
    only ever compared against peers in its own band - never portfolio-wide.
    """
    bands: dict[str, list[float]] = {}
    for rm in portfolio.values():
        bands.setdefault(rm.size_band, []).append(rm.events_per_resident_week)
    for k in bands:
        bands[k].sort()
    return bands


def percentile_in(sorted_vals: list[float], value: float) -> float:
    """Fraction of peers at or below `value`, in [0, 1]."""
    if not sorted_vals:
        return 0.5
    lo, hi = 0, len(sorted_vals)
    while lo < hi:
        mid = (lo + hi) // 2
        if sorted_vals[mid] <= value:
            lo = mid + 1
        else:
            hi = mid
    return lo / len(sorted_vals)


def median(vals: list[float]) -> float:
    if not vals:
        return 0.0
    s = sorted(vals)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
