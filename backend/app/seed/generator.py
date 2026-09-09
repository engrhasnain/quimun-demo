"""Deterministic demo dataset generator.

The dataset is not random noise dressed up as data. Each residence is assigned a
behavioural *archetype* with a real trajectory, and daily volumes are derived
from how a Chilean ELEAM actually runs:

  * clinical modules follow three shifts and do not stop at weekends - care is
    24/7, so Ficha Clínica and Tratamientos barely dip on a Sunday;
  * administrative modules do stop at weekends and on Chilean public holidays;
  * Evaluaciones cluster in the first days of the month, Reportería at close;
  * activity is attributed to named staff whose role actually touches the
    module, which is what makes single-user dependency detectable at all.

Everything is seeded from a fixed RNG so every run, machine and rehearsal
produces the same numbers.
"""

from __future__ import annotations

import math
import random
import unicodedata
from datetime import date, timedelta

from sqlalchemy import delete, insert
from sqlalchemy.orm import Session

from app.catalog import (
    COMUNAS,
    MODULE_BY_KEY,
    PLAN_BY_KEY,
    REGIONS,
    ROLE_BY_KEY,
    ROLES,
    band_for_beds,
    modules_for_plan,
)
from app.core.config import HISTORY_DAYS, RANDOM_SEED, SNAPSHOT_DATE
from app.models import Interaction, Residence, StaffUser, Ticket, UsageDaily
from app.seed.names import (
    FIRST_NAMES_F,
    FIRST_NAMES_M,
    INTERACTIONS,
    OWNERS,
    RESIDENCE_NAMES,
    SURNAMES,
    TICKET_SUBJECTS,
)

TODAY = date.fromisoformat(SNAPSHOT_DATE)
START = TODAY - timedelta(days=HISTORY_DAYS - 1)

# Chilean public holidays falling inside the generated window.
FERIADOS = {
    date(2025, 12, 25), date(2026, 1, 1), date(2026, 4, 3), date(2026, 4, 4),
    date(2026, 5, 1), date(2026, 5, 21), date(2026, 6, 29), date(2026, 7, 16),
    date(2026, 8, 15),
}

# --- Archetypes ------------------------------------------------------------
# `share` is how many of the 64 residences get this behaviour. The mix is what
# a company with 0% churn actually looks like: a healthy majority, a real but
# small tail that needs attention, and a couple of expansion candidates.

# `miss` is the daily probability that a clinical module records nothing at all
# on a given day - the gap a SEREMI inspection would find. It rises as the
# trajectory decays, because a team that is disengaging skips shifts first.
ARCHETYPES = {
    "ancla":            {"share": 8,  "base": 1.18, "concentration": 0.28, "seat_fill": 0.95, "miss": 0.004},
    "estable":          {"share": 15, "base": 1.00, "concentration": 0.34, "seat_fill": 0.86, "miss": 0.012},
    "estacional":       {"share": 6,  "base": 0.95, "concentration": 0.36, "seat_fill": 0.80, "miss": 0.020},
    "declive_lento":    {"share": 7,  "base": 0.98, "concentration": 0.44, "seat_fill": 0.60, "miss": 0.055},
    "caida_abrupta":    {"share": 4,  "base": 1.02, "concentration": 0.40, "seat_fill": 0.52, "miss": 0.050},
    "dependencia":      {"share": 4,  "base": 0.78, "concentration": 0.82, "seat_fill": 0.32, "miss": 0.090},
    "solo_clinico":     {"share": 5,  "base": 0.92, "concentration": 0.42, "seat_fill": 0.68, "miss": 0.018},
    "nuevo":            {"share": 4,  "base": 0.70, "concentration": 0.50, "seat_fill": 0.55, "miss": 0.075},
    "friccion":         {"share": 3,  "base": 0.86, "concentration": 0.46, "seat_fill": 0.64, "miss": 0.065},
    "recuperado":       {"share": 3,  "base": 0.94, "concentration": 0.38, "seat_fill": 0.78, "miss": 0.020},
    "expansion":        {"share": 3,  "base": 1.24, "concentration": 0.26, "seat_fill": 1.00, "miss": 0.004},
    "critico":          {"share": 2,  "base": 0.68, "concentration": 0.80, "seat_fill": 0.22, "miss": 0.170},
}


def _trajectory(archetype: str, t: float, rng: random.Random, shock_at: float) -> float:
    """Activity multiplier at position `t` in [0, 1] of the history window."""
    if archetype == "ancla":
        return 1.0 + 0.10 * t
    if archetype == "estable":
        return 1.0
    if archetype == "estacional":
        # Southern-hemisphere winter (roughly t 0.5-0.75 here) lifts clinical load.
        return 1.0 + 0.16 * math.sin(2 * math.pi * (t - 0.15))
    if archetype == "declive_lento":
        # Flat, then an erosion that only becomes obvious in the last third.
        if t < 0.55:
            return 1.0
        return 1.0 - 0.70 * ((t - 0.55) / 0.45) ** 1.35
    if archetype == "caida_abrupta":
        # A key person left. Everything holds, then steps down and stays down.
        return 1.0 if t < shock_at else 0.34
    if archetype == "dependencia":
        return 0.92 - 0.12 * t
    if archetype == "solo_clinico":
        return 1.0
    if archetype == "nuevo":
        # Onboarding ramp that reaches steady state around 90 days in.
        ramp_end = 0.40
        return min(1.0, 0.18 + (t / ramp_end) * 0.82) if t < ramp_end else 1.0
    if archetype == "friccion":
        # Sawtooth: they try, hit a wall, back off, try again.
        return 0.9 + 0.28 * math.sin(2 * math.pi * t * 3.0)
    if archetype == "critico":
        # Held on for most of the year, then fell away sharply and never recovered.
        if t < 0.62:
            return 1.0 - 0.25 * (t / 0.62)
        return max(0.15, 0.72 - 0.80 * ((t - 0.62) / 0.38))
    if archetype == "recuperado":
        # Dipped mid-window, then came back after an intervention.
        if t < 0.42:
            return 1.0
        if t < 0.62:
            return 1.0 - 0.45 * ((t - 0.42) / 0.20)
        return 0.55 + 0.50 * min(1.0, (t - 0.62) / 0.24)
    if archetype == "expansion":
        return 1.0 + 0.42 * t
    return 1.0


# Base events per day at full adoption, expressed per resident where the
# workload genuinely scales with resident count.
def _module_base_rate(module: str, residents: int) -> float:
    per_resident = {
        "checklist": 3.0,            # three shifts, every resident
        "tratamientos": 2.35,        # medication rounds
        "ficha_clinica": 0.85,       # evolution notes
        "evaluaciones": 0.055,       # periodic scales
        "ingresos_egresos": 0.032,
        "habitaciones": 0.058,
        "productos_servicios": 0.10,
        "apoderados": 0.22,          # family logins
        "contratos": 0.02,           # one per admission, plus renewals
    }
    if module in per_resident:
        return residents * per_resident[module]
    return {"reporteria": 0.55, "auditorias": 0.22, "costos": 0.9}.get(module, 0.3)


def _day_factor(module: str, day: date) -> float:
    """Weekday / holiday shape. Care never stops; paperwork does."""
    m = MODULE_BY_KEY[module]
    clinical = m["family"] == "salud"
    wd = day.weekday()  # 0=Mon .. 6=Sun

    if clinical:
        f = {5: 0.94, 6: 0.90}.get(wd, 1.0)
        if day in FERIADOS:
            f *= 0.88
    else:
        f = {5: 0.34, 6: 0.18}.get(wd, 1.0)
        if day in FERIADOS:
            f *= 0.15

    # Monthly-cadence modules cluster rather than spread.
    if m["cadence"] == "monthly":
        if module == "evaluaciones":
            f *= 3.4 if day.day <= 8 else 0.28
        elif module == "reporteria":
            f *= 4.0 if (day.day >= 28 or day.day <= 4) else 0.20
        elif module == "auditorias":
            f *= 2.6 if day.day <= 5 else 0.35
        elif module == "costos":
            f *= 4.5 if (day.day >= 27 or day.day <= 5) else 0.15
    return f


def _rut(rng: random.Random) -> str:
    body = rng.randint(60_000_000, 79_999_999)
    dv = "0123456789K"[rng.randint(0, 10)]
    s = f"{body:,}".replace(",", ".")
    return f"{s}-{dv}"


def _person(rng: random.Random, role: str) -> str:
    female_leaning = role in {"enfermera_jefe", "tens", "nutricionista", "terapeuta", "recepcion"}
    pool = FIRST_NAMES_F if (female_leaning or rng.random() < 0.45) else FIRST_NAMES_M
    return f"{rng.choice(pool)} {rng.choice(SURNAMES)} {rng.choice(SURNAMES)}"


def _staff_plan(residents: int, plan: str) -> list[str]:
    """Which roles a residence of this size actually staffs on the platform."""
    roles = ["administrador", "enfermera_jefe"]
    tens_count = max(1, round(residents / 14))
    roles += ["tens"] * min(tens_count, 6)
    if residents >= 25:
        roles.append("recepcion")
    if residents >= 30:
        roles.append("kinesiologo")
    if residents >= 45:
        roles.append("nutricionista")
    if residents >= 55:
        roles.append("terapeuta")
    if residents >= 40 or plan == "eleam_plus":
        roles.append("direccion")
    return roles


def generate(db: Session) -> dict:
    rng = random.Random(RANDOM_SEED)

    for table in (UsageDaily, Interaction, Ticket, StaffUser, Residence):
        db.execute(delete(table))
    db.commit()

    archetype_pool: list[str] = []
    for key, cfg in ARCHETYPES.items():
        archetype_pool += [key] * cfg["share"]
    rng.shuffle(archetype_pool)

    days = [START + timedelta(days=i) for i in range(HISTORY_DAYS)]
    n_days = len(days)

    residences: list[Residence] = []
    all_users: list[StaffUser] = []
    usage_rows: list[dict] = []
    ticket_rows: list[dict] = []
    interaction_rows: list[dict] = []

    for idx, (prefix, proper) in enumerate(RESIDENCE_NAMES):
        archetype = archetype_pool[idx]
        cfg = ARCHETYPES[archetype]

        region = rng.choices(
            [r["key"] for r in REGIONS],
            weights=[38, 14, 10, 6, 7, 7, 5, 5, 4, 4],  # RM-heavy, as in reality
        )[0]
        comuna = rng.choice(COMUNAS[region])

        # quimun.com states "+1.500 adultos mayores gestionados en todo Chile"
        # and "planes para todos los tamaños de residencias. Desde 1 a 100+".
        # Weighted small, because most Chilean ELEAM are small: this lands the
        # book at roughly 1.6k residents rather than the 2.7k a flat spread gave.
        beds = rng.choices(
            [
                rng.randint(8, 18),
                rng.randint(19, 32),
                rng.randint(33, 55),
                rng.randint(58, 104),
            ],
            weights=[34, 36, 22, 8],
        )[0]
        occupancy = rng.uniform(0.84, 0.99) if archetype != "expansion" else rng.uniform(0.95, 1.0)
        residents = max(8, round(beds * occupancy))
        band = band_for_beds(beds)

        if beds >= 70:
            plan = rng.choices(["profesional", "eleam_plus"], weights=[35, 65])[0]
        elif beds >= 40:
            plan = rng.choices(["esencial", "profesional", "eleam_plus"], weights=[15, 55, 30])[0]
        else:
            plan = rng.choices(["esencial", "profesional"], weights=[55, 45])[0]

        contracted = modules_for_plan(plan)

        roles = _staff_plan(residents, plan)
        licensed_seats = len(roles) + (1 if rng.random() < 0.4 else 0)

        onboard_days_ago = rng.randint(40, 95) if archetype == "nuevo" else rng.randint(HISTORY_DAYS + 30, 1150)
        onboarded_at = TODAY - timedelta(days=onboard_days_ago)
        renewal_at = onboarded_at
        while renewal_at <= TODAY + timedelta(days=20):
            renewal_at += timedelta(days=365)

        mrr = round(beds * PLAN_BY_KEY[plan]["clp_per_bed"] / 1000) * 1000
        # Strip diacritics properly: `"í".isalnum()` is True in Python, so a
        # naive alnum filter happily leaves accents in the URL.
        folded = unicodedata.normalize("NFKD", proper.lower())
        folded = "".join(c for c in folded if not unicodedata.combining(c))
        folded = folded.replace("ñ", "n").replace(" ", "-")
        slug = "".join(c for c in folded if c.isascii() and (c.isalnum() or c == "-"))
        slug = f"{slug}-{idx + 1:02d}"

        res = Residence(
            slug=slug,
            name=f"{prefix} {proper}",
            legal_name=f"Sociedad {proper} SpA",
            rut=_rut(rng),
            region=region,
            comuna=comuna,
            plan=plan,
            beds=beds,
            residents=residents,
            size_band=band,
            licensed_seats=licensed_seats,
            onboarded_at=onboarded_at,
            renewal_at=renewal_at,
            mrr_clp=mrr,
            owner=rng.choices(OWNERS, weights=[62, 20, 18])[0],
            contact_name=_person(rng, "direccion"),
            contact_role=rng.choice(["Directora", "Administrador", "Sostenedora", "Gerente"]),
            whatsapp_group=f"Quimun · {prefix} {proper}",
            pipedrive_id=f"PD-{4200 + idx * 7}",
        )
        db.add(res)
        db.flush()
        residences.append(res)

        # --- staff -----------------------------------------------------
        users: list[StaffUser] = []
        for role in roles:
            created = max(onboarded_at, START - timedelta(days=rng.randint(0, 200)))
            deactivated = None
            # The "key person left" archetype: the head nurse account goes dark.
            if archetype == "caida_abrupta" and role == "enfermera_jefe":
                deactivated = START + timedelta(days=int(n_days * 0.62))
            u = StaffUser(
                residence_id=res.id,
                name=_person(rng, role),
                role=role,
                created_at=created,
                deactivated_at=deactivated,
            )
            db.add(u)
            users.append(u)

            # A residence does not stop caring for residents when someone
            # resigns - it hires a replacement. The weeks in between are where
            # the clinical recording gap actually comes from.
            if deactivated is not None:
                replacement = StaffUser(
                    residence_id=res.id,
                    name=_person(rng, role),
                    role=role,
                    created_at=deactivated + timedelta(days=rng.randint(19, 34)),
                    deactivated_at=None,
                )
                db.add(replacement)
                users.append(replacement)
        db.flush()
        all_users += users

        # Residence-specific discipline around recording, independent of how
        # engaged they are overall. Without this the miss rate is a perfect
        # proxy for the archetype and any model trained on it just reads the
        # generator's mind.
        miss_factor = rng.uniform(0.45, 1.9)

        # Per-user propensity - some people are simply heavier users.
        propensity = {u.id: rng.uniform(0.55, 1.45) for u in users}

        # Seats that were bought but nobody logs into. This is what separates
        # "12 licences" from "4 people actually using the platform", and it is
        # the single most common quiet failure in vertical SaaS.
        dormant: set[int] = set()
        protected = {"administrador", "enfermera_jefe"}
        first_tens = next((u.id for u in users if u.role == "tens"), None)
        for u in users:
            if u.role in protected or u.id == first_tens:
                continue
            if rng.random() > cfg["seat_fill"]:
                dormant.add(u.id)
        # The single-user-dependency archetype funnels everything to one seat.
        anchor_user = next((u for u in users if u.role == "administrador"), users[0])

        shock_at = rng.uniform(0.55, 0.72)

        # Modules this residence actually adopted (vs merely contracted).
        adopted: dict[str, float] = {}
        for mkey in contracted:
            fam = MODULE_BY_KEY[mkey]["family"]
            p = 0.94
            if archetype == "solo_clinico" and fam != "salud":
                p = 0.18
            elif archetype == "dependencia" and fam == "salud":
                p = 0.55
            elif archetype == "nuevo" and MODULE_BY_KEY[mkey]["cadence"] == "monthly":
                p = 0.45
            if mkey == "apoderados":
                p *= 0.78  # family portal is the classic contracted-but-unused module
            if rng.random() < p:
                adopted[mkey] = rng.uniform(0.7, 1.15)

        # Guarantee at least the clinical core so no residence is empty.
        for mkey in ("ficha_clinica", "tratamientos"):
            adopted.setdefault(mkey, rng.uniform(0.8, 1.1))

        # A module that was abandoned partway through the window.
        abandoned_at: dict[str, int] = {}
        if archetype in ("declive_lento", "caida_abrupta", "dependencia", "critico") and rng.random() < 0.75:
            candidates = [m for m in adopted if MODULE_BY_KEY[m]["family"] != "salud"]
            # An account in real trouble lets go of more than one thing.
            n_drop = 2 if archetype == "critico" else 1
            for m in rng.sample(candidates, min(n_drop, len(candidates))):
                abandoned_at[m] = int(n_days * rng.uniform(0.72, 0.93))

        # --- daily usage ------------------------------------------------
        for di, day in enumerate(days):
            if day < onboarded_at:
                continue
            t = di / max(1, n_days - 1)
            traj = _trajectory(archetype, t, rng, shock_at)

            # A disengaging team skips shifts before it cancels a contract:
            # the probability of recording nothing rises as activity decays.
            miss_p = min(0.55, cfg["miss"] * miss_factor / max(0.45, traj))

            for mkey, madopt in adopted.items():
                if mkey in abandoned_at and di >= abandoned_at[mkey]:
                    continue
                if MODULE_BY_KEY[mkey]["cadence"] == "daily" and rng.random() < miss_p:
                    continue

                rate = _module_base_rate(mkey, residents)
                rate *= cfg["base"] * madopt * traj * _day_factor(mkey, day)
                rate *= rng.uniform(0.78, 1.22)  # day-to-day noise

                # Floor on daily clinical modules. Medication rounds and shift
                # checklists happen whether or not the home is disengaging - a
                # residence recording nothing clinical for 27 of 28 days would
                # have been closed, not flagged. The floor is deliberately low:
                # enough that a struggling home still ticks some boxes, not so
                # much that it props volume up and flattens a real collapse.
                if MODULE_BY_KEY[mkey]["cadence"] == "daily":
                    rate = max(rate, residents * 0.11)

                events = int(rng.gauss(rate, max(0.6, rate * 0.22)))
                if events <= 0:
                    continue

                eligible = [
                    u for u in users
                    if mkey in ROLE_BY_KEY[u.role]["modules"]
                    and u.id not in dormant
                    and u.created_at <= day
                    and (u.deactivated_at is None or day < u.deactivated_at)
                ]
                if not eligible:
                    continue

                conc = cfg["concentration"]
                if archetype == "dependencia" and anchor_user in eligible:
                    weights = [
                        propensity[u.id] * (7.5 if u.id == anchor_user.id else 0.35)
                        for u in eligible
                    ]
                else:
                    weights = [propensity[u.id] ** (1 + conc * 2.2) for u in eligible]

                total_w = sum(weights)
                remaining = events
                for i, u in enumerate(eligible):
                    if remaining <= 0:
                        break
                    share = weights[i] / total_w
                    n = remaining if i == len(eligible) - 1 else int(round(events * share))
                    n = min(n, remaining)
                    if n <= 0:
                        continue
                    remaining -= n
                    usage_rows.append({
                        "day": day,
                        "residence_id": res.id,
                        "user_id": u.id,
                        "module": mkey,
                        "events": n,
                        "minutes": max(1, int(n * rng.uniform(0.7, 2.1))),
                    })

        # --- tickets ----------------------------------------------------
        n_tickets = rng.randint(0, 3)
        if archetype == "friccion":
            n_tickets = rng.randint(5, 8)
        elif archetype == "nuevo":
            n_tickets = rng.randint(3, 6)
        friction_module = None
        if archetype == "friccion":
            friction_module = rng.choice([m for m in adopted] or ["ficha_clinica"])
        for _ in range(n_tickets):
            subj_es, subj_en, mod = rng.choice(TICKET_SUBJECTS)
            if friction_module and rng.random() < 0.7:
                mod = friction_module
                subj_es, subj_en = f"Problema recurrente en {MODULE_BY_KEY[mod]['name_es']}", \
                                   f"Recurring problem in {MODULE_BY_KEY[mod]['name_en']}"
            opened = TODAY - timedelta(days=rng.randint(1, 34) if archetype == "friccion" else rng.randint(1, 200))
            closed = None if rng.random() < 0.22 else opened + timedelta(days=rng.randint(0, 9))
            ticket_rows.append({
                "residence_id": res.id,
                "opened_at": opened,
                "closed_at": closed,
                "module": mod,
                "subject": subj_es,
                "subject_en": subj_en,
                "priority": rng.choices(["baja", "media", "alta"], weights=[42, 43, 15])[0],
                "status": "abierto" if closed is None else "cerrado",
            })

        # --- human touchpoints -----------------------------------------
        drifting = archetype in ("declive_lento", "dependencia", "critico", "caida_abrupta")
        gap = 40 if drifting else rng.randint(9, 22)
        # Silence compounds: the accounts that most need a conversation are the
        # ones that quietly fall off the contact rota.
        first_gap = rng.randint(48, 86) if (drifting and rng.random() < 0.6) else rng.randint(2, 20)
        d = TODAY - timedelta(days=first_gap)
        while d > TODAY - timedelta(days=180):
            es, en, ch = rng.choice(INTERACTIONS)
            interaction_rows.append({
                "residence_id": res.id,
                "day": d,
                "channel": ch,
                "direction": rng.choice(["saliente", "entrante"]),
                "author": res.owner,
                "summary": es,
                "summary_en": en,
            })
            d -= timedelta(days=rng.randint(max(5, gap - 8), gap + 12))

    db.commit()

    for chunk_start in range(0, len(usage_rows), 5000):
        db.execute(insert(UsageDaily), usage_rows[chunk_start:chunk_start + 5000])
    db.execute(insert(Ticket), ticket_rows)
    db.execute(insert(Interaction), interaction_rows)
    db.commit()

    return {
        "residences": len(residences),
        "users": len(all_users),
        "usage_rows": len(usage_rows),
        "tickets": len(ticket_rows),
        "interactions": len(interaction_rows),
        "from": START.isoformat(),
        "to": TODAY.isoformat(),
    }
