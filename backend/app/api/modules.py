"""Module adoption across the portfolio — 'which functionalities are they using?'."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.analytics import service
from app.analytics.metrics import percentile_in
from app.catalog import FAMILIES, MODULES
from app.db import get_db

router = APIRouter(prefix="/api/modules", tags=["modules"])


@router.get("/adoption")
def adoption(db: Session = Depends(get_db)) -> dict:
    state = service.get_state(db)
    recs = state["records"]

    # Residence x module intensity matrix, normalised per module so a heavy
    # module (Checklist) does not wash out a light one (Auditorías).
    #
    # Cells are the residence's PERCENTILE within that module, not its share of
    # the module's busiest residence. Dividing by the peak squashes almost every
    # cell into a narrow mid-range whenever one residence is an outlier - which
    # is most modules - and the heatmap ends up a single flat colour. Ranking
    # spreads the cells across the whole ramp, which is the point of a heatmap.
    ranked: dict[str, list[float]] = {}
    for m in MODULES:
        vals = []
        for r in recs:
            if m["key"] in r["metrics"].modules_contracted and r["metrics"].residents:
                v = r["metrics"].module_events_28.get(m["key"], 0) / r["metrics"].residents
                if v > 0:
                    vals.append(v)
        ranked[m["key"]] = sorted(vals)

    matrix = []
    for r in recs:
        rm = r["metrics"]
        cells = []
        for m in MODULES:
            if m["key"] not in rm.modules_contracted:
                cells.append({"module": m["key"], "state": "no_contratado", "value": None})
                continue
            per_res = rm.module_events_28.get(m["key"], 0) / rm.residents if rm.residents else 0
            lifetime = rm.module_lifetime.get(m["key"], 0)
            cells.append({
                "module": m["key"],
                "state": (
                    "nunca" if lifetime == 0
                    else "inactivo" if rm.module_events_28.get(m["key"], 0) == 0
                    else "activo"
                ),
                "value": round(percentile_in(ranked[m["key"]], per_res), 3),
                "events": rm.module_events_28.get(m["key"], 0),
            })
        matrix.append({
            "slug": rm.slug, "name": rm.name, "plan": rm.plan,
            "size_band": rm.size_band, "residents": rm.residents,
            "status": r["score"]["status"], "index": r["score"]["index"],
            "cells": cells,
        })

    matrix.sort(key=lambda x: x["index"])

    families = []
    for f in FAMILIES:
        mods = [m["key"] for m in MODULES if m["family"] == f["key"]]
        ev = sum(
            r["metrics"].module_events_28.get(k, 0) for r in recs for k in mods
        )
        prev = sum(
            r["metrics"].module_events_prev.get(k, 0) for r in recs for k in mods
        )
        families.append({
            **f, "events_28": ev, "events_prev": prev,
            "delta_pct": round((ev - prev) / prev * 100, 1) if prev else 0.0,
        })

    return {
        "as_of": state["as_of"].isoformat(),
        "families": families,
        "modules": [
            {
                "key": m["key"], "name_es": m["name_es"], "name_en": m["name_en"],
                "family": m["family"], "cadence": m["cadence"],
                "compliance": m["compliance"], "weight": m["weight"],
                "desc_es": m["desc_es"], "desc_en": m["desc_en"],
            }
            for m in MODULES
        ],
        "matrix": matrix,
    }
