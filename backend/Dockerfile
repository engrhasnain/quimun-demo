# API image. Training deps (scikit-learn, numpy) are intentionally NOT installed:
# the model ships as data/model.json and is scored by pure Python at runtime.
FROM python:3.12-slim

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY data ./data

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# If the image was built without a seeded database, build one on first boot.
CMD ["sh", "-c", "python -c \"import pathlib,sys; sys.exit(0 if pathlib.Path('data/quimun.db').exists() else 1)\" || python -m scripts.seed; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
