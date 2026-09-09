"""Runtime inference — pure Python, zero ML dependencies.

The model is fitted offline by `ml/train_model.py` (scikit-learn) and exported to
`data/model.json` as standardisation statistics plus coefficients. Serving it is
then a dot product, which means:

  * the deployed bundle carries no numpy/scipy/scikit-learn (they do not fit
    inside a serverless function's size budget, and would not earn their place
    here even if they did);
  * inference is sub-millisecond, so the whole portfolio is scored per request;
  * every prediction decomposes exactly into per-feature contributions, because
    a logistic model's log-odds is a sum. The "why" is not an approximation
    layered on afterwards - it is the arithmetic itself.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

from app.analytics.features import FEATURE_KEYS, FEATURE_LABELS
from app.core.config import MODEL_PATH


class ModelUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=1)
def load_model() -> dict:
    p = Path(MODEL_PATH)
    if not p.exists():
        raise ModelUnavailable(
            f"No trained model at {p}. Run: python -m ml.train_model"
        )
    with p.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def model_available() -> bool:
    try:
        load_model()
        return True
    except ModelUnavailable:
        return False


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def predict(features: dict[str, float]) -> dict:
    """Score one residence.

    Returns the probability plus the signed contribution of every feature to the
    log-odds, which is what the UI shows as "why this account".
    """
    m = load_model()
    stats = m["features"]
    intercept = m["intercept"]

    z = intercept
    contributions = []
    for spec in stats:
        key = spec["key"]
        raw = float(features.get(key, 0.0))
        scale = spec["scale"] or 1.0
        std = (raw - spec["mean"]) / scale
        contrib = std * spec["coef"]
        z += contrib
        contributions.append({
            "key": key,
            "label_es": FEATURE_LABELS[key]["es"],
            "label_en": FEATURE_LABELS[key]["en"],
            "raw": round(raw, 4),
            "standardized": round(std, 3),
            "coef": round(spec["coef"], 4),
            "contribution": round(contrib, 4),
        })

    p = _sigmoid(z)
    contributions.sort(key=lambda c: -abs(c["contribution"]))

    return {
        "probability": round(p, 4),
        "log_odds": round(z, 4),
        "band": risk_band(p),
        "drivers": contributions[:5],
        "protective": [c for c in contributions if c["contribution"] < 0][:3],
        "all_contributions": contributions,
        "model_version": m.get("version"),
    }


def risk_band(p: float) -> str:
    m = load_model()
    t = m.get("thresholds", {"high": 0.60, "medium": 0.35})
    if p >= t["high"]:
        return "alto"
    if p >= t["medium"]:
        return "medio"
    return "bajo"


def model_card() -> dict:
    """Everything needed to render the model transparency page."""
    m = load_model()
    return {
        "version": m.get("version"),
        "algorithm": m.get("algorithm"),
        "trained_at": m.get("trained_at"),
        "target": m.get("target"),
        "target_en": m.get("target_en"),
        "horizon_days": m.get("horizon_days"),
        "drop_threshold": m.get("drop_threshold"),
        "metrics": m.get("metrics", {}),
        "roc": m.get("roc", []),
        "calibration": m.get("calibration", []),
        "confusion": m.get("confusion", {}),
        "thresholds": m.get("thresholds", {}),
        "coefficients": [
            {
                "key": f["key"],
                "label_es": FEATURE_LABELS[f["key"]]["es"],
                "label_en": FEATURE_LABELS[f["key"]]["en"],
                "coef": round(f["coef"], 4),
                "mean": round(f["mean"], 4),
                "scale": round(f["scale"], 4),
            }
            for f in sorted(m["features"], key=lambda f: -abs(f["coef"]))
        ],
        "training": m.get("training", {}),
    }
