# Guide

A plain-language walkthrough. The app is in Spanish by default (Raimundo is
Chilean); the `EN` button at the bottom-left flips everything. Spanish labels are
shown below so you can follow along either way.

**Open:** http://localhost:3000

---

## The idea in one paragraph

Raimundo has 60+ residences and talks to each one on WhatsApp. He can't tell
which ones are quietly drifting until they complain. Quimun already records
every action staff take in the platform. This reads those records and answers
one question: **who do I message today, and what do I say?**

---

## The five screens

| Screen | Spanish | What it's for |
|---|---|---|
| Portfolio | **Portafolio** | The whole book on one screen. Start here. |
| Residences | **Residencias** | All 64 accounts as a sortable table. |
| Signals | **Señales** | The to-do list. This is the product. |
| Modules | **Módulos** | Which features people actually use. |
| Model | **Modelo** | Proof the prediction is real. |

---

## The four numbers you need to know

Everything else is detail. These four appear everywhere:

**1. Índice de uso — "usage index", 0 to 100**

How well a residence is using the platform. Higher is better.

It's built from four things you can argue with, not a black box:

- *Intensidad* — how much they use it, compared to residences **of their own size**
- *Amplitud* — how many of the modules they pay for they actually use
- *Cobertura* — how many of their staff use it (vs. one person doing everything)
- *Consistencia* — do they use it daily, or in one panicked catch-up per month

**2. Tendencia — "trend"**

Last 28 days vs. the 28 before. Shown separately on purpose: an account at 78
that was at 92 last month matters more than one that's been at 65 all year.

**3. Estado — "status"**

The traffic light. Combines index *and* trend:

| Spanish | English | Meaning |
|---|---|---|
| Saludable | Healthy | Leave them alone |
| En observación | Watch | Keep an eye on it |
| En riesgo | At risk | Do something this week |
| Crítico | Critical | Do something today |

**4. Riesgo 30d — "projected risk"**

The model's answer to: *will this account be in a bad state a month from now?*
This is the only number that looks forward. Everything else describes today.

Shown as **Alto ≥ 70% · Medio ≥ 35% · Bajo** below that.

---

## What to click, in order

### 1 · Portafolio

Six numbers across the top. The two that matter most:

- **Requieren atención: 11** — accounts that need work now
- **MRR en cuentas en riesgo: $2,3M** — of $12,4M total. Revenue at stake.

Below, two boxes to notice:

- **Cola de atención** — the top signals, already prioritised
- **Alerta temprana del modelo** — accounts that *look fine today* but the model
  says won't be in 30 days. This is the whole pitch in one box.

### 2 · Señales ← spend your time here

Left: the queue. Right: the selected signal.

Pick the top one. You get:

1. **What's wrong**, with a number — e.g. *"18 days with no clinical recording
   in the last 28. This is exactly what a SEREMI inspection reviews."*
2. **What to do** — who owns it, which channel, how many days
3. **The steps** — 4 concrete ones
4. **A WhatsApp message, already written**, with the real contact's name

That last part is the demo. Click **Abrir WhatsApp** and it opens ready to send.

The **Triaje** buttons at the bottom (Abierta / En curso / Resuelta /
Descartada) actually save — resolve one and it disappears from the queue.

### 3 · A residence

Click any residence name. Try http://localhost:3000/residencias/el-espino-34 —
it's the worst account in the book.

- Six numbers at the top
- Its open signals, each with the ready-to-send message
- **Índice de uso** broken into the four parts, each showing the raw figure
- Activity chart — you can see it fall off a cliff
- Peers — the same-size residences, so you can see where it sits

### 4 · Módulos

The interesting row: **Portal de Apoderados — 72% adoption, 10 residences never
used it.** They paid for it and never switched it on. That's a real conversation.

The big grid: 64 residences × 12 modules. Darker = more use. Grey = they have it
but aren't using it.

### 5 · Modelo

Only open this if Raimundo asks "is this real?". It shows AUC, the ROC curve,
calibration, and every coefficient — plus a note saying plainly that the demo
data is generated.

---

## Small things worth knowing

- **The "?" circles** next to card titles explain how each number is calculated.
  Hover them. Nothing important is hidden, it's just out of the way.
- **It opens light.** There's a dark toggle bottom-left if you want it, plus
  AUTO to follow your system.
- **Sort any column** in Residencias by clicking its header.
- **Share a link in English:** add `?lang=en` to any URL.
- **Force a theme:** add `?theme=light` or `?theme=dark`.
- The date is frozen at **8 Sept 2026** so the numbers never change between
  rehearsals.

---

## If something breaks

The dashboard will tell you if the API is down and show you the command. Two
terminals:

```bash
cd backend && uvicorn app.main:app --reload   # port 8000
cd frontend && npm run dev                    # port 3000
```

Before a demo, run this — it checks 26 things that would be embarrassing on a
call (impossible numbers, empty messages, a broken model):

```bash
cd backend && python -m scripts.check
```

---

## Is the model needed?

**No — and that's on purpose.** Delete `backend/data/model.json` and everything
still works: all 64 residences, all 88 signals, the whole usage index. Only the
*Riesgo 30d* column and the *Alerta temprana* box go away. I tested exactly that.

The signals are plain rules with evidence attached. They answer four of
Raimundo's five questions by themselves. The model adds the fifth thing only:
spotting accounts that look fine today and won't be in a month.

Keep it — it's the most impressive 30 seconds of the demo, and it's real. But if
he pushes back on "another AI black box", you can say honestly: *the dashboard
doesn't depend on it, and here's the page showing exactly how it works.*

---

## The one caveat to be upfront about

The data is generated, not Quimun's real data — it's a demo. The `/modelo` page
says so on screen. What's real is the pipeline: point it at Quimun's actual
event log and the same code produces the same dashboard with their numbers.

If Raimundo asks, say it first. It lands better coming from you.

---

**More detail:** [`README.md`](README.md) (technical) ·
[`README.es.md`](README.es.md) (español) ·
[`DEMO.md`](DEMO.md) (the 12-minute demo script, in Spanish)
