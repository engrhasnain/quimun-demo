"""Vercel Python serverless entrypoint.

Vercel's Python runtime does support ASGI apps: a module under `api/` that
exposes a module-level `app` is served directly, so FastAPI runs here without a
shim. The constraints that actually matter are different ones:

  * 250 MB unzipped bundle. We ship FastAPI + SQLAlchemy + Pydantic and a ~21 MB
    SQLite file, which lands around 70 MB. The trained model is 8 KB of JSON and
    is scored in pure Python, which is precisely why scikit-learn, numpy and
    scipy are NOT in requirements.txt - those three alone would blow the limit.
  * Read-only filesystem apart from /tmp. `app/core/config.py` detects the
    serverless environment and copies the bundled database to /tmp on cold
    start, so triage writes work (per-instance and ephemeral, which is fine for
    a demo and is called out in the README).
  * Cold starts. First request after idle pays the copy; subsequent ones are
    warm.

Deploy this directory as its OWN Vercel project with Root Directory = `backend`.
The Next.js app is a second project with Root Directory = `frontend`, pointed
here through NEXT_PUBLIC_API_URL.
"""

import sys
from pathlib import Path

# The function file lives in api/, so the package root is its parent.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

# Vercel looks for a module-level ASGI callable named `app`.
__all__ = ["app"]
