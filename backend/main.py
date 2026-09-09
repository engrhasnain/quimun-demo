"""Entrypoint for Vercel's FastAPI preset.

Vercel auto-detects a FastAPI project by looking for a module-level ASGI `app`
in a conventional location - `main.py` at the project root is the first place it
checks. The real application lives in `app/main.py`; this file only re-exports
it so the preset finds it without any routing configuration.

Without this, the preset deploys an entrypoint of its own choosing and every
route 404s with FastAPI's own `{"detail":"Not Found"}` - the app is up, but none
of our routers are on it.

Local development is unaffected: `uvicorn app.main:app` still works, and so does
`uvicorn main:app` from this directory.
"""

from app.main import app

__all__ = ["app"]
