"""The attention queue, plus the triage state a human puts on top of it."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import service
from app.db import get_db
from app.models import SignalState

router = APIRouter(prefix="/api/signals", tags=["signals"])

VALID_STATUS = {"abierta", "en_curso", "resuelta", "descartada"}


def _state_map(db: Session) -> dict[str, SignalState]:
    out: dict[str, SignalState] = {}
    for st in db.execute(select(SignalState)).scalars():
        out[f"{st.residence_id}:{st.signal_key}:{st.module or '-'}"] = st
    return out


@router.get("")
def list_signals(
    db: Session = Depends(get_db),
    severity: str | None = None,
    key: str | None = None,
    owner: str | None = None,
    status: str | None = None,
    include_resolved: bool = False,
) -> dict:
    state = service.get_state(db)
    states = _state_map(db)

    items = []
    for rec in state["records"]:
        rid = rec["metrics"].id
        for s in rec["signals"]:
            st = states.get(f"{rid}:{s['key']}:{s.get('module') or '-'}")
            triage = {
                "status": st.status if st else "abierta",
                "assignee": st.assignee if st else None,
                "note": st.note if st else None,
                "snoozed_until": st.snoozed_until.isoformat() if st and st.snoozed_until else None,
                "updated_at": st.updated_at.isoformat() if st else None,
            }
            if not include_resolved and triage["status"] in ("resuelta", "descartada"):
                continue
            items.append({**s, "triage": triage})

    if severity:
        items = [i for i in items if i["severity"] in set(severity.split(","))]
    if key:
        items = [i for i in items if i["key"] in set(key.split(","))]
    if owner:
        items = [i for i in items if i["owner"] == owner]
    if status:
        items = [i for i in items if i["triage"]["status"] in set(status.split(","))]

    items.sort(key=lambda i: -i["priority"])

    return {
        "as_of": state["as_of"].isoformat(),
        "count": len(items),
        "results": items,
    }


class TriageIn(BaseModel):
    residence_slug: str
    signal_key: str
    module: str | None = None
    status: str = Field(default="abierta")
    assignee: str | None = None
    note: str | None = None
    snoozed_until: date | None = None


@router.post("/triage")
def set_triage(payload: TriageIn, db: Session = Depends(get_db)) -> dict:
    if payload.status not in VALID_STATUS:
        raise HTTPException(400, f"status must be one of {sorted(VALID_STATUS)}")

    state = service.get_state(db)
    rec = state["by_slug"].get(payload.residence_slug)
    if not rec:
        raise HTTPException(404, f"Residence '{payload.residence_slug}' not found")
    rid = rec["metrics"].id

    st = db.execute(
        select(SignalState).where(
            SignalState.residence_id == rid,
            SignalState.signal_key == payload.signal_key,
            SignalState.module == payload.module,
        )
    ).scalars().first()

    if st is None:
        st = SignalState(
            residence_id=rid,
            signal_key=payload.signal_key,
            module=payload.module,
        )
        db.add(st)

    st.status = payload.status
    st.assignee = payload.assignee
    st.note = payload.note
    st.snoozed_until = payload.snoozed_until
    st.updated_at = datetime.utcnow()
    db.commit()

    return {
        "ok": True,
        "residence_slug": payload.residence_slug,
        "signal_key": payload.signal_key,
        "module": payload.module,
        "status": st.status,
        "assignee": st.assignee,
        "note": st.note,
        "snoozed_until": st.snoozed_until.isoformat() if st.snoozed_until else None,
        "updated_at": st.updated_at.isoformat(),
    }
