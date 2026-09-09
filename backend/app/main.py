"""Quimun Portfolio Intelligence — API.

Read-mostly analytics over the platform's own usage events. Everything is
derived on read from `usage_daily`; nothing about a residence's health is stored
as a frozen number, so a rule change takes effect immediately and never needs a
backfill.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.analytics import model as ml
from app.api import meta, modelinfo, modules, portfolio, residences, signals
from app.core.config import ALLOWED_ORIGINS, DB_PATH, SNAPSHOT_DATE
from app.db import engine

app = FastAPI(
    title="Quimun · Portfolio Intelligence",
    description=(
        "Uso y engagement de las residencias que operan sobre Quimun. "
        "Usage and engagement across the residences running on Quimun."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (meta.router, portfolio.router, residences.router,
          signals.router, modules.router, modelinfo.router):
    app.include_router(r)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    ok, residences_n, usage_n = True, 0, 0
    try:
        with engine.connect() as c:
            residences_n = c.execute(text("SELECT COUNT(*) FROM residences")).scalar() or 0
            usage_n = c.execute(text("SELECT COUNT(*) FROM usage_daily")).scalar() or 0
    except Exception:
        ok = False

    return {
        "ok": ok and residences_n > 0,
        "snapshot_date": SNAPSHOT_DATE,
        "database": str(DB_PATH),
        "residences": residences_n,
        "usage_rows": usage_n,
        "model_loaded": ml.model_available(),
    }


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"service": "quimun-portfolio-intelligence", "docs": "/docs", "health": "/api/health"}
