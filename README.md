# Quimun · Portfolio Intelligence

Usage and engagement monitoring across the residences running on
[Quimun](https://quimun.com/) — the vertical SaaS for Chilean long-stay elderly
care homes (ELEAM).

> **Español:** este README también existe en castellano → [`README.es.md`](README.es.md)
> **Demo script / guion de demo:** [`DEMO.md`](DEMO.md)

Built for the brief: Raimundo keeps a WhatsApp channel with each of 60+
residences and monitors them by hand. The platform already records who uses
what. The bottleneck is development time. This is the dashboard his team would
otherwise have to build.

---

## What it answers

The brief asks five questions. Each maps to something concrete here:

| The question | Where it is answered |
|---|---|
| How much is each residence using Quimun? | **Índice de uso** — a four-part usage index, peer-normalised by residence size |
| Which modules are they using? | **Módulos** — adoption matrix of 64 residences × 12 real Quimun modules |
| Where is usage declining? | 28-day trend, a change-point detector, and a 30-day projection |
| Which customers need attention? | **Señales** — 11 detection rules, ranked by severity, revenue at stake and model probability |
| What action should be taken? | Every signal carries a **playbook**: owner, channel, SLA, steps, and a WhatsApp draft ready to send |

It is explicitly **not** a churn-prediction product. Quimun has 0% churn. The
model here predicts *degraded usage*, which is the thing that precedes a
problem.

---

## Stack

- **Backend** — FastAPI + SQLAlchemy over SQLite. Read-mostly analytics; nothing
  about a residence's health is stored as a frozen number, so a rule change
  takes effect immediately with no backfill.
- **Frontend** — Next.js 15 (App Router) + TypeScript. No UI framework and no
  chart library: a hand-written design system and custom SVG charts.
- **Model** — scikit-learn at training time only. The fitted weights are
  exported to `data/model.json` and scored by ~40 lines of pure Python at
  request time, so the deployed API carries no numpy/scipy/sklearn.
- **Languages** — full Spanish and English. Spanish is the default, because
  quimun.com, the company and its customers are Chilean.

---

## Running it

Two processes. Backend first.

```bash
cd backend
pip install -r requirements.txt
python -m scripts.seed          # generates data/quimun.db  (~10s)
uvicorn app.main:app --reload   # http://127.0.0.1:8000
```

To (re)train the model — optional, a trained `data/model.json` is committed:

```bash
pip install -r requirements-train.txt
python -m ml.train_model        # ~20s, prints held-out metrics
```

Frontend:

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

Before a demo, run the self-check — it validates the invariants that would
actually embarrass you in front of a customer (impossible numbers, signals
firing without evidence, unrendered message placeholders, a model whose
predictions have collapsed to one value):

```bash
cd backend && python -m scripts.check    # 26 checks
```

`frontend/.env.local` points at the API:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
API_BASE=http://127.0.0.1:8000
```

If the API is down the UI says so and tells you how to start it, rather than
rendering an empty dashboard.

---

## Deploying

Everything goes on Vercel, as **two projects from the same repo** — Vercel lets
each project pick its own Root Directory.

| Project | Root Directory | What it is |
|---|---|---|
| `quimun-api` | `backend` | FastAPI as a Python serverless function |
| `quimun` | `frontend` | The Next.js dashboard |

Deploy the API first, then set `NEXT_PUBLIC_API_URL` on the frontend project to
the API project's URL. Set `ALLOWED_ORIGINS` on the API to the frontend's URL.

**Yes, Vercel runs FastAPI.** Its Python runtime serves any module under `api/`
that exposes an ASGI `app`, so no shim is needed — `backend/api/index.py` is a
three-line import. The real constraints are size and the filesystem, and both
are handled:

```
python deps          30.7 MB
data/quimun.db       20.9 MB
app/ source + model   0.2 MB
────────────────────────────
TOTAL                51.7 MB     (Vercel limit: 250 MB)
```

That headroom is not an accident. Had scikit-learn stayed a runtime dependency
it would have cost **193 MB** (sklearn 47 + numpy 32 + scipy 114), landing the
bundle at ~245 MB — technically under the cap, but with nothing to spare and a
much slower cold start. Exporting the model to 8 KB of JSON and scoring it in
pure Python is what makes this comfortable.

The other Vercel constraint is the read-only filesystem. `app/core/config.py`
detects the serverless environment and copies the bundled SQLite file to `/tmp`
on cold start, so signal triage still writes. Those writes are per-instance and
disappear when the function goes cold — fine for a demo, worth knowing before
you rely on it.

**Prefer a container?** `backend/Dockerfile` is a plain `python:3.12-slim` image
with no ML dependencies, and `render.yaml` targets Render's free tier. An
always-on container avoids cold starts, which is the one thing I would consider
for a live demo over a hotel wifi.

```bash
docker build -t quimun-api ./backend
docker run -p 8000:8000 quimun-api
```

> **What I verified:** the ASGI entrypoint imports and serves, the bundle math
> above, and the container path. I could not run an actual `vercel deploy` from
> here, so treat the Vercel steps as correct-by-construction rather than
> observed.

---

## How the numbers work

### Índice de uso (0–100)

Four components, fixed weights, each reported next to the figure that produced
it — so "why is this account at 50?" is always answerable on screen.

| Component | Weight | What it measures |
|---|---|---|
| **Intensidad** | 30% | Events per resident per week, as a percentile *within the residence's own size band* |
| **Amplitud** | 25% | Share of contracted modules actually in use, weighted by module importance |
| **Cobertura de equipo** | 25% | Licences and roles actually recording; penalises everything resting on one person |
| **Consistencia** | 20% | Rhythm — daily modules used daily, not in a monthly catch-up |

Two decisions worth calling out:

- **Everything is compared within a size band.** The brief says customer sizes
  differ wildly. A 14-bed home and a 130-bed home are never compared directly;
  intensity is a percentile among peers of the same band.
- **Trend is kept out of the index** and reported beside it. A residence can sit
  at 78 and still be the most urgent account in the book if it was at 92 last
  month. Status combines the two rather than OR-ing them, so a modest-but-growing
  account gets a light touch while a comfortable-but-falling one gets an
  intervention.

### Signals

Eleven rules, each stating its own evidence — nothing fires without a number
attached. Among them: sustained drop, abandoned module, single-user dependency,
clinical recording gap (the evidence a SEREMI inspection actually reviews),
dormant family portal, renewal-at-risk, support friction, and expansion
opportunity.

Ranking is by severity × revenue at stake × model probability, so a 12-bed home
and a 130-bed home with the same symptom do not sort equally.

### The model — optional by design

**The dashboard works without it.** Delete `data/model.json` and everything
still runs: 64 residences, all 86 signals, the full usage index. The risk column
shows `—`, the early-warning box empties, and `/modelo` says the model is
missing. Nothing else changes.

That is deliberate. The eleven signals are *rules* with evidence attached, and
they answer four of the brief's five questions on their own. The model adds one
thing rules cannot: a forward-looking read on accounts that look fine today.
Keep it if that early warning is worth it; drop it if Raimundo would rather not
have a model in the loop at all.

Logistic regression predicting **degraded usage within 30 days** — intensity
falling below 80% of the residence's own size-band median.

Held-out performance on a **temporal** split (70/30 by cutoff date, never
random — a random split leaks the future through neighbouring cutoffs of the
same residence):

| | |
|---|---|
| AUC | **0.970** |
| Average precision | 0.952 (base rate 0.380) |
| Precision / Recall | 0.887 / 0.849 |
| Brier | 0.073 |

Three things about the setup matter more than the algorithm:

1. **Training rows are built by the live feature code.** `build_features()` is
   called by both the trainer and the API, so train/serve skew is eliminated by
   construction rather than tested for afterwards.
2. **Only weights ship.** sklearn is a dev dependency; production scores a dot
   product.
3. **Every prediction decomposes exactly.** A logistic model's log-odds *is* a
   sum, so the per-feature contributions shown in the UI are the arithmetic
   itself, not a post-hoc approximation.

The `/modelo` page shows the ROC curve, calibration, confusion matrix and every
coefficient, plus an explicit honesty note: the model is trained on generated
demo data, so the metrics describe how well it recovers structure the generator
put there. What transfers to production is the pipeline, not these coefficients.

---

## The demo data

64 residences, ~1,630 residents, ~460 staff accounts and ~200k usage rows over 270
days, all generated
deterministically from a fixed seed — the same numbers on every run and every
rehearsal.

It is not noise dressed up as data. Each residence gets a behavioural archetype
with a real trajectory, and daily volumes follow how an ELEAM actually runs:

- clinical modules follow three shifts and **do not stop at weekends** — care is
  24/7, so Ficha Clínica and Tratamientos barely dip on a Sunday;
- administrative modules *do* stop, on weekends and on Chilean public holidays;
- Evaluaciones cluster in the first days of the month, Reportería at close;
- activity is attributed to named staff whose role actually touches the module,
  which is what makes single-user dependency detectable at all;
- when a head nurse resigns, a replacement is hired weeks later — and that
  hiring gap is where the clinical recording gap comes from.

The scale matches what Quimun publishes: the site claims **"+1.500 adultos
mayores gestionados en todo Chile"** and **"planes... desde 1 a 100+"**, so the
book lands at ~1,630 residents across homes of 8 to 101 beds, weighted small
because most Chilean ELEAM are small.

Module names, families, terminology (ELEAM, SENAMA, RUT, apoderados,
comunas), the three-module structure and the brand palette are all taken from
quimun.com, not invented.

---

## Layout

```
backend/
  app/
    catalog.py            reference data: modules, roles, plans, size bands, geography
    models.py             SQLAlchemy schema
    analytics/
      metrics.py          SQL aggregation over the whole portfolio in one pass
      scoring.py          the usage index
      signals.py          11 detection rules
      playbooks.py        the action attached to each signal
      features.py         feature vector — shared by trainer and API
      model.py            pure-Python inference
      forecast.py         Holt projection + MAD change-point detection
      service.py          composition and caching
    api/                  FastAPI routers
    seed/generator.py     the demo dataset
  ml/train_model.py       offline trainer (sklearn) → data/model.json
  scripts/seed.py         database builder

frontend/
  src/app/                routes: /, /residencias, /senales, /modulos, /modelo
  src/components/
    charts.tsx            every chart, hand-written SVG
    ui.tsx                design-system primitives and icons
    views/                one component per page
  src/i18n/dictionary.ts  ES + EN, with a compile-time parity check
  src/lib/                API client, formatting, types
```

### A note on colour

Quimun's brand violet (`#3919ba`, taken from their site) is **chrome only** —
active navigation, primary buttons, focus rings, the wordmark. It never encodes
data.

Data series use a separate palette derived from Quimun's own blue and validated
for colour-vision deficiency in both light and dark mode (worst all-pairs CVD
ΔE 8.9 light / 10.5 dark; normal-vision ΔE 21.2 / 20.3). Status colours are
fixed, never themed, and always ship with a text label — hue never carries
meaning on its own.
