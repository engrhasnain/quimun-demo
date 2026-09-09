"""Residence list and detail."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.analytics import service
from app.db import get_db

router = APIRouter(prefix="/api/residences", tags=["residences"])

SORTS = {
    "index": lambda r: r["index"],
    "trend": lambda r: r["trend_pct"],
    "name": lambda r: r["name"].lower(),
    "events": lambda r: r["events_28"],
    "mrr": lambda r: r["mrr_clp"],
    "residents": lambda r: r["residents"],
    "risk": lambda r: (r["risk"] or {}).get("probability", -1),
    "renewal": lambda r: r["days_to_renewal"],
    "signals": lambda r: r["signal_count"],
}


@router.get("")
def list_residences(
    db: Session = Depends(get_db),
    q: str | None = None,
    status: str | None = None,
    region: str | None = None,
    plan: str | None = None,
    band: str | None = None,
    owner: str | None = None,
    module: str | None = Query(None, description="only residences actively using this module"),
    risk: str | None = None,
    sort: str = "index",
    direction: str = "asc",
) -> dict:
    state = service.get_state(db)
    rows = [service.residence_row(r) for r in state["records"]]

    by_slug = state["by_slug"]
    if module:
        rows = [
            r for r in rows
            if module in by_slug[r["slug"]]["metrics"].modules_active
        ]
    if q:
        needle = q.lower().strip()
        rows = [
            r for r in rows
            if needle in r["name"].lower()
            or needle in r["comuna"].lower()
            or needle in r["region_name"].lower()
        ]
    if status:
        wanted = set(status.split(","))
        rows = [r for r in rows if r["status"] in wanted]
    if region:
        rows = [r for r in rows if r["region"] in set(region.split(","))]
    if plan:
        rows = [r for r in rows if r["plan"] in set(plan.split(","))]
    if band:
        rows = [r for r in rows if r["size_band"] in set(band.split(","))]
    if owner:
        rows = [r for r in rows if r["owner"] == owner]
    if risk:
        wanted = set(risk.split(","))
        rows = [r for r in rows if r["risk"] and r["risk"]["band"] in wanted]

    keyfn = SORTS.get(sort, SORTS["index"])
    rows.sort(key=keyfn, reverse=(direction == "desc"))

    return {
        "as_of": state["as_of"].isoformat(),
        "count": len(rows),
        "total": len(state["records"]),
        "results": rows,
    }


@router.get("/{slug}")
def residence_detail(slug: str, db: Session = Depends(get_db)) -> dict:
    state = service.get_state(db)
    rec = state["by_slug"].get(slug)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Residence '{slug}' not found")
    return service.residence_detail(db, rec, state["as_of"])


@router.get("/{slug}/peers")
def residence_peers(slug: str, db: Session = Depends(get_db)) -> dict:
    """Same-size-band comparison. The brief is explicit that sizes differ wildly,
    so 'is this a lot?' is only answerable against peers."""
    state = service.get_state(db)
    rec = state["by_slug"].get(slug)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Residence '{slug}' not found")
    band = rec["metrics"].size_band
    peers = [
        {
            "slug": r["metrics"].slug,
            "name": r["metrics"].name,
            "intensity": round(r["metrics"].events_per_resident_week, 2),
            "index": r["score"]["index"],
            "residents": r["metrics"].residents,
            "is_self": r["metrics"].slug == slug,
        }
        for r in state["records"] if r["metrics"].size_band == band
    ]
    peers.sort(key=lambda p: -p["intensity"])
    return {"band": band, "peers": peers}
