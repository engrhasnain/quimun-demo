"""Build the demo database.

    python -m scripts.seed
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Windows consoles default to cp1252 and choke on the arrows below.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover - non-reconfigurable stream
    pass

from app.db import Base, SessionLocal, engine
from app.models import *  # noqa: F401,F403  (register mappings)
from app.seed.generator import generate


def main() -> int:
    print("Creating schema…")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    db = SessionLocal()
    try:
        print("Generating portfolio…")
        stats = generate(db)
    finally:
        db.close()

    print()
    for k, v in stats.items():
        print(f"  {k:<14}: {v:,}" if isinstance(v, int) else f"  {k:<14}: {v}")
    print()
    print("Next: python -m ml.train_model")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
