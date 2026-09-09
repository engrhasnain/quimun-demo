"""Offline trainer for the disengagement model.

    python -m ml.train_model

Trains a logistic regression that answers one question:

    Given how a residence looks today, will its recording volume fall by 30% or
    more over the next 30 days?

Three things about how this is set up matter more than the algorithm choice:

1. **Features come from the live code path.** Training rows are produced by
   `compute_portfolio(db, cutoff)` and `build_features(...)` - the same functions
   the API calls. There is no separate feature pipeline to drift out of sync.

2. **The split is temporal, not random.** Rows are ordered by cutoff date and cut
   at the 70th percentile of *time*. A random split would leak the future into
   the training set through neighbouring cutoffs of the same residence, and the
   reported AUC would be a fiction.

3. **Only the weights ship.** scikit-learn is a development dependency; the
   exported `model.json` is scored by ~40 lines of pure Python at runtime.

Note on honesty: this model is trained on generated demo data, so its metrics
describe how well it recovers structure that the generator put there. That is
the right claim to make in a demo, and the pipeline is what transfers to
Quimun's real event stream - not these particular coefficients.
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Windows consoles default to cp1252 and choke on the arrows below.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover - non-reconfigurable stream
    pass

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.preprocessing import StandardScaler
from sqlalchemy import text

from app.analytics.features import FEATURE_KEYS, build_features
from app.analytics.metrics import band_benchmarks, compute_portfolio
from app.core.config import (
    HISTORY_DAYS,
    LABEL_DROP_THRESHOLD,
    LABEL_HORIZON,
    MODEL_PATH,
    SNAPSHOT_DATE,
    WINDOW,
)
from app.db import SessionLocal

TODAY = date.fromisoformat(SNAPSHOT_DATE)
START = TODAY - timedelta(days=HISTORY_DAYS - 1)

WARMUP_DAYS = 84          # need trailing history before the first cutoff
CUTOFF_STRIDE = 7         # weekly cutoffs
MIN_TRAILING_EVENTS = 60  # ignore rows too quiet to have a meaningful label
DEGRADED_FRACTION = 0.80  # 'degraded' = below 80% of the size-band median


def _median(v: list[float]) -> float:
    if not v:
        return 0.0
    s = sorted(v)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def forward_events(db, residence_id: int, start: date, end: date) -> int:
    v = db.execute(text("""
        SELECT COALESCE(SUM(events), 0) FROM usage_daily
        WHERE residence_id = :r AND day BETWEEN :a AND :b
    """), {"r": residence_id, "a": start, "b": end}).scalar()
    return int(v or 0)


def build_dataset(db) -> tuple[np.ndarray, np.ndarray, list[date], list[str]]:
    first_cutoff = START + timedelta(days=WARMUP_DAYS)
    last_cutoff = TODAY - timedelta(days=LABEL_HORIZON)

    X, y, cutoffs, slugs = [], [], [], []
    cutoff = first_cutoff
    n_cutoffs = 0

    while cutoff <= last_cutoff:
        portfolio = compute_portfolio(db, cutoff)
        bands = band_benchmarks(portfolio)
        n_cutoffs += 1

        for rm in portfolio.values():
            if rm.events_28 < MIN_TRAILING_EVENTS:
                continue
            if rm.onboarded_at > cutoff - timedelta(days=WINDOW):
                continue

            fwd = forward_events(
                db, rm.id, cutoff + timedelta(days=1),
                cutoff + timedelta(days=LABEL_HORIZON),
            )
            trailing_per_day = rm.events_28 / WINDOW
            forward_per_day = fwd / LABEL_HORIZON
            if trailing_per_day <= 0:
                continue

            # Target: a forward STATE, not a further fall.
            #
            # "Will it drop another 30%?" scores an already-collapsed account as
            # low risk - technically true, operationally useless, and the first
            # thing that would discredit the dashboard in a demo. The question
            # actually being asked is "will this residence be in a degraded
            # state in 30 days", where degraded is defined against what peers of
            # the same size sustain. Accounts already there stay flagged;
            # healthy accounts sliding toward it get caught early, which is the
            # whole point.
            band_vals = bands.get(rm.size_band, [])
            band_median = _median(band_vals)
            forward_intensity = (
                (forward_per_day * 7.0 / rm.residents) if rm.residents else 0.0
            )
            label = 1 if forward_intensity < DEGRADED_FRACTION * band_median else 0

            feats = build_features(rm, bands.get(rm.size_band, []))
            X.append([feats[k] for k in FEATURE_KEYS])
            y.append(label)
            cutoffs.append(cutoff)
            slugs.append(rm.slug)

        cutoff += timedelta(days=CUTOFF_STRIDE)

    print(f"  cutoffs evaluated : {n_cutoffs}")
    return np.array(X, dtype=float), np.array(y, dtype=int), cutoffs, slugs


def main() -> int:
    db = SessionLocal()
    try:
        n_res = db.execute(text("SELECT COUNT(*) FROM residences")).scalar()
        if not n_res:
            print("No data. Run `python -m ml.seed_all` first.")
            return 1

        print("Building training set from the live feature code path…")
        X, y, cutoffs, slugs = build_dataset(db)

        if len(X) < 200:
            print(f"Only {len(X)} rows - not enough to train.")
            return 1

        order = np.argsort([c.toordinal() for c in cutoffs], kind="stable")
        X, y = X[order], y[order]
        cut_sorted = [cutoffs[i] for i in order]

        split = int(len(X) * 0.70)
        # Push the boundary to the next date change so no cutoff straddles it.
        while split < len(X) - 1 and cut_sorted[split] == cut_sorted[split - 1]:
            split += 1

        X_tr, X_te = X[:split], X[split:]
        y_tr, y_te = y[:split], y[split:]

        print(f"  rows              : {len(X)}  ({len(X_tr)} train / {len(X_te)} test)")
        print(f"  train window      : {cut_sorted[0]} → {cut_sorted[split - 1]}")
        print(f"  test  window      : {cut_sorted[split]} → {cut_sorted[-1]}")
        print(f"  positive rate     : train {y_tr.mean():.3f} / test {y_te.mean():.3f}")

        if y_tr.sum() < 10 or y_te.sum() < 5:
            print("Too few positive examples to train a useful model.")
            return 1

        scaler = StandardScaler().fit(X_tr)
        clf = LogisticRegression(
            C=0.05,
            class_weight="balanced",
            max_iter=2000,
            solver="lbfgs",
        ).fit(scaler.transform(X_tr), y_tr)

        p_te = clf.predict_proba(scaler.transform(X_te))[:, 1]
        pred = (p_te >= 0.5).astype(int)

        auc = roc_auc_score(y_te, p_te)
        ap = average_precision_score(y_te, p_te)
        tn, fp, fn, tp = confusion_matrix(y_te, pred, labels=[0, 1]).ravel()

        fpr, tpr, _ = roc_curve(y_te, p_te)
        step = max(1, len(fpr) // 60)
        roc_pts = [
            {"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4)}
            for i in range(0, len(fpr), step)
        ]
        if roc_pts[-1]["fpr"] != 1.0:
            roc_pts.append({"fpr": 1.0, "tpr": 1.0})

        # Two different questions, two different numbers.
        #
        # `precision_threshold` is the lowest cut that still buys >=80%
        # precision - the right answer for "where should the work queue start".
        # It came out near the base rate, which makes it a terrible *display*
        # band: it painted two thirds of the book red, including accounts at
        # 40%, and a column where every row says "Alto" tells you nothing.
        #
        # The display bands are therefore fixed and explainable - 70% and 35% -
        # and the precision cut is reported separately on the model page.
        hi_t, med_t = 0.70, 0.35
        precision_threshold = None
        best = None
        for cand in [x / 100 for x in range(30, 100)]:
            sel = p_te >= cand
            if sel.sum() < 5:
                continue
            prec = float(y_te[sel].mean())
            rec = float(y_te[sel].sum() / max(1, y_te.sum()))
            if prec >= 0.80 and (best is None or rec > best[1]):
                best = (cand, rec)
        if best:
            precision_threshold = best[0]

        calibration = []
        edges = np.linspace(0, 1, 6)
        for i in range(5):
            mask = (p_te >= edges[i]) & (p_te < edges[i + 1] + (1e-9 if i == 4 else 0))
            if mask.sum() == 0:
                continue
            calibration.append({
                "bin": f"{edges[i]:.1f}–{edges[i + 1]:.1f}",
                "predicted": round(float(p_te[mask].mean()), 4),
                "actual": round(float(y_te[mask].mean()), 4),
                "n": int(mask.sum()),
            })

        payload = {
            "version": "1.0.0",
            "algorithm": "logistic_regression (L2, class_weight=balanced)",
            "trained_at": date.today().isoformat(),
            "target": (
                "Uso degradado en 30 días: intensidad bajo el 80% de la mediana "
                "de su grupo de tamaño"
            ),
            "target_en": (
                "Degraded usage in 30 days: intensity below 80% of the residence's "
                "own size-band median"
            ),
            "horizon_days": LABEL_HORIZON,
            "drop_threshold": DEGRADED_FRACTION,
            "intercept": float(clf.intercept_[0]),
            "features": [
                {
                    "key": k,
                    "mean": float(scaler.mean_[i]),
                    "scale": float(scaler.scale_[i]),
                    "coef": float(clf.coef_[0][i]),
                }
                for i, k in enumerate(FEATURE_KEYS)
            ],
            "thresholds": {
                "high": hi_t,
                "medium": med_t,
                "precision_threshold": precision_threshold,
            },
            "metrics": {
                "auc": round(float(auc), 4),
                "average_precision": round(float(ap), 4),
                "accuracy": round(float(accuracy_score(y_te, pred)), 4),
                "precision": round(float(precision_score(y_te, pred, zero_division=0)), 4),
                "recall": round(float(recall_score(y_te, pred, zero_division=0)), 4),
                "f1": round(float(f1_score(y_te, pred, zero_division=0)), 4),
                "brier": round(float(brier_score_loss(y_te, p_te)), 4),
                "base_rate": round(float(y_te.mean()), 4),
                "n_train": int(len(X_tr)),
                "n_test": int(len(X_te)),
            },
            "confusion": {"tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)},
            "roc": roc_pts,
            "calibration": calibration,
            "training": {
                "split": "temporal (70/30 by cutoff date)",
                "cutoff_stride_days": CUTOFF_STRIDE,
                "train_from": cut_sorted[0].isoformat(),
                "train_to": cut_sorted[split - 1].isoformat(),
                "test_from": cut_sorted[split].isoformat(),
                "test_to": cut_sorted[-1].isoformat(),
                "residences": int(n_res),
                "min_trailing_events": MIN_TRAILING_EVENTS,
                "note": (
                    "Entrenado sobre datos de demostración generados. El pipeline "
                    "es el que se conecta al stream real de Quimun; los coeficientes "
                    "se recalculan con datos reales."
                ),
                "note_en": (
                    "Trained on generated demo data. The pipeline is what connects "
                    "to Quimun's real event stream; coefficients are refitted on real data."
                ),
            },
        }

        Path(MODEL_PATH).write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        print()
        print(f"  AUC (held-out)    : {auc:.3f}")
        print(f"  Avg precision     : {ap:.3f}")
        print(f"  Precision / Recall: {payload['metrics']['precision']:.3f}"
              f" / {payload['metrics']['recall']:.3f}")
        print(f"  Brier score       : {payload['metrics']['brier']:.4f}")
        print(f"  Confusion (tp/fp/fn/tn): {tp}/{fp}/{fn}/{tn}")
        print(f"  Display bands     : alto>={hi_t:.2f}  medio>={med_t:.2f}")
        print(f"  Precision cut     : {precision_threshold}  (>=80% precision)")
        print()
        print("  Top coefficients:")
        for f in sorted(payload["features"], key=lambda f: -abs(f["coef"]))[:6]:
            print(f"    {f['coef']:+.3f}  {f['key']}")
        print()
        print(f"→ {MODEL_PATH}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
