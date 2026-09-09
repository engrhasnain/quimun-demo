"""Model transparency endpoint.

A prediction nobody can interrogate is a prediction nobody will act on, so the
whole model card is served: target definition, temporal split, held-out metrics,
ROC, calibration, and every coefficient.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.analytics import model as ml
from app.analytics import service
from app.db import get_db

router = APIRouter(prefix="/api/model", tags=["model"])


@router.get("")
def card(db: Session = Depends(get_db)) -> dict:
    if not ml.model_available():
        return {
            "available": False,
            "reason": "No trained model found. Run: python -m ml.train_model",
        }

    state = service.get_state(db)
    scored = [r for r in state["records"] if r["risk"]]

    # Distribution of live predictions, so the card shows what the model is
    # actually saying about the book today - not only how it scored in testing.
    buckets = [0] * 10
    for r in scored:
        i = min(9, int(r["risk"]["probability"] * 10))
        buckets[i] += 1

    return {
        "available": True,
        **ml.model_card(),
        "live": {
            "scored": len(scored),
            "distribution": [
                {"bin": f"{i / 10:.1f}–{(i + 1) / 10:.1f}", "n": buckets[i]}
                for i in range(10)
            ],
            "by_band": {
                b: sum(1 for r in scored if r["risk"]["band"] == b)
                for b in ("alto", "medio", "bajo")
            },
        },
    }
