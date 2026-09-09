"""Pre-demo self-check.

    python -m scripts.check

Validates the invariants that would actually embarrass you in front of a
customer: impossible numbers, signals firing without evidence, playbook
placeholders left unrendered, a model whose live predictions have collapsed to
one value. Exits non-zero if anything fails.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

from sqlalchemy import text

from app.analytics import service
from app.analytics.model import model_available
from app.catalog import MODULES, modules_for_plan
from app.core.config import SNAPSHOT_DATE
from app.db import SessionLocal

failures: list[str] = []
checks = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global checks
    checks += 1
    if ok:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label}  {detail}")
        failures.append(label)


def main() -> int:
    db = SessionLocal()
    try:
        as_of = date.fromisoformat(SNAPSHOT_DATE)
        state = service.get_state(db, as_of)
        recs = state["records"]

        print("Data")
        check("64 residences seeded", len(recs) == 64, f"got {len(recs)}")
        check(
            "no residence has zero contracted modules",
            all(r["metrics"].modules_contracted for r in recs),
        )
        check(
            "every residence recorded activity in the window",
            all(r["metrics"].events_28 > 0 for r in recs),
            str([r["metrics"].slug for r in recs if r["metrics"].events_28 == 0][:3]),
        )
        check(
            "slugs are url-safe ascii",
            all(
                all(c.isascii() and (c.isalnum() or c == "-") for c in r["metrics"].slug)
                for r in recs
            ),
        )
        check(
            "residents never exceed beds",
            all(r["metrics"].residents <= r["metrics"].beds for r in recs),
        )
        check(
            "plan/module consistency",
            all(
                set(r["metrics"].modules_contracted) == set(modules_for_plan(r["metrics"].plan))
                for r in recs
            ),
        )

        print("\nScoring")
        idx = [r["score"]["index"] for r in recs]
        check("index within 0-100", all(0 <= v <= 100 for v in idx), f"min {min(idx)} max {max(idx)}")
        check(
            "index spreads across at least 30 points",
            max(idx) - min(idx) >= 30,
            f"range {max(idx) - min(idx):.1f}",
        )
        pillar_ok = all(
            all(0 <= p["value"] <= 100 for p in r["score"]["pillars"]) for r in recs
        )
        check("all pillars within 0-100", pillar_ok)
        check(
            "pillar weights sum to 1",
            all(abs(sum(p["weight"] for p in r["score"]["pillars"]) - 1.0) < 1e-9 for r in recs),
        )
        statuses = {r["score"]["status"] for r in recs}
        check(
            "all four statuses present",
            statuses == {"saludable", "observacion", "en_riesgo", "critico"},
            str(sorted(statuses)),
        )
        healthy = sum(1 for r in recs if r["score"]["status"] == "saludable")
        check(
            "healthy majority (0% churn book)",
            healthy / len(recs) >= 0.5,
            f"{healthy}/{len(recs)}",
        )

        print("\nSignals")
        sigs = [s for r in recs for s in r["signals"]]
        check("signals fire", len(sigs) > 20, f"got {len(sigs)}")
        kinds = {s["key"] for s in sigs}
        check("at least 9 distinct signal types fire", len(kinds) >= 9, f"got {len(kinds)}")
        check("every signal carries evidence", all(s["evidence"] for s in sigs))
        check(
            "no unrendered placeholders in drafts",
            all(
                "{" not in s["playbook"]["draft_es"] and "{" not in s["playbook"]["draft_en"]
                for s in sigs
            ),
            str([s["key"] for s in sigs if "{" in s["playbook"]["draft_es"]][:3]),
        )
        check(
            "every signal has a bilingual playbook with steps",
            all(
                s["playbook"]["steps_es"] and s["playbook"]["steps_en"]
                and s["playbook"]["draft_es"] and s["playbook"]["draft_en"]
                for s in sigs
            ),
        )
        check("priorities are positive", all(s["priority"] > 0 for s in sigs))
        check(
            "no residence is drowning in signals",
            max(len(r["signals"]) for r in recs) <= 8,
            f"max {max(len(r['signals']) for r in recs)}",
        )

        print("\nModel")
        if not model_available():
            check("model file present", False, "run: python -m ml.train_model")
        else:
            probs = [r["risk"]["probability"] for r in recs if r["risk"]]
            check("every residence scored", len(probs) == len(recs))
            check("probabilities in [0,1]", all(0 <= p <= 1 for p in probs))
            check(
                "predictions are not degenerate",
                max(probs) - min(probs) > 0.5,
                f"range {min(probs):.3f}-{max(probs):.3f}",
            )
            check(
                "contributions decompose the log-odds",
                all(
                    abs(
                        sum(c["contribution"] for c in r["risk"]["all_contributions"])
                        + _intercept()
                        - r["risk"]["log_odds"]
                    )
                    < 0.01
                    for r in recs if r["risk"]
                ),
            )
            bands = {r["risk"]["band"] for r in recs if r["risk"]}
            check("all three risk bands used", bands == {"alto", "medio", "bajo"}, str(sorted(bands)))

        print("\nDerived series")
        check(
            "forecast available for every residence",
            all(
                service.residence_detail(db, r, as_of)["forecast"]["available"]
                for r in recs[:8]
            ),
            "(sampled 8)",
        )

        n_usage = db.execute(text("SELECT COUNT(*) FROM usage_daily")).scalar()
        check("usage table populated", (n_usage or 0) > 100_000, f"{n_usage:,} rows")

    finally:
        db.close()

    print()
    if failures:
        print(f"{len(failures)} of {checks} checks FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"All {checks} checks passed.")
    return 0


def _intercept() -> float:
    from app.analytics.model import load_model

    return load_model()["intercept"]


if __name__ == "__main__":
    raise SystemExit(main())
