"""Runtime configuration.

Deployment note: on Vercel the filesystem is read-only except for /tmp, so the
SQLite file that ships in the bundle is copied to /tmp on cold start. Locally it
is used in place. Nothing else in the app needs to know which it is.
"""

import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

BUNDLED_DB = DATA_DIR / "quimun.db"
MODEL_PATH = DATA_DIR / "model.json"

IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


def _resolve_db_path() -> Path:
    if not IS_SERVERLESS:
        return BUNDLED_DB
    runtime_db = Path("/tmp/quimun.db")
    if not runtime_db.exists() and BUNDLED_DB.exists():
        shutil.copy(BUNDLED_DB, runtime_db)
    return runtime_db


DB_PATH = _resolve_db_path()
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

# The dataset is generated relative to a fixed "today" so the demo is
# reproducible: same numbers on every run, every machine, every rehearsal.
SNAPSHOT_DATE = "2026-09-08"
HISTORY_DAYS = 270
RANDOM_SEED = 20260908

# Analysis windows
WINDOW = 28          # current period
PREV_WINDOW = 28     # comparison period
FORECAST_DAYS = 30

# Labelling horizon for the disengagement model
LABEL_HORIZON = 30
LABEL_DROP_THRESHOLD = 0.30

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_extra_origins = os.environ.get("ALLOWED_ORIGINS", "")
if _extra_origins:
    ALLOWED_ORIGINS += [o.strip() for o in _extra_origins.split(",") if o.strip()]
