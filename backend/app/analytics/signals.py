"""Signal detection.

Rules, not a model — on purpose. A signal has to be explainable in one sentence
to a residence director on WhatsApp, and it has to be actionable the moment it
fires. The trained model sits alongside these as a separate, forward-looking
estimate; it does not replace them.

Each rule states its own evidence. Nothing fires without a number attached.
"""

from __future__ import annotations

from datetime import date, timedelta

from app.analytics import playbooks
from app.analytics.metrics import ResidenceMetrics
from app.catalog import COMPLIANCE_MODULES, DAILY_MODULES, MODULE_BY_KEY
from app.core.config import WINDOW

SEVERITY_WEIGHT = {
    "critica": 100,
    "alta": 65,
    "media": 35,
    "baja": 15,
    "oportunidad": 30,
}


def _mod(key: str, lang: str = "es") -> str:
    m = MODULE_BY_KEY.get(key)
    if not m:
        return key
    return m["name_es"] if lang == "es" else m["name_en"]


def _render(template: str, **kw) -> str:
    try:
        return template.format(**kw)
    except KeyError:
        return template


def detect(rm: ResidenceMetrics, as_of: date, peer_median_intensity: float) -> list[dict]:
    out: list[dict] = []

    def add(key, severity, title_es, title_en, detail_es, detail_en,
            playbook_key, evidence, module=None, ctx=None):
        pb = playbooks.get(playbook_key) or {}
        ctx = ctx or {}
        base_ctx = {
            "contact": rm.contact_name.split()[0],
            "residence": rm.name,
            "module": _mod(module) if module else "la plataforma",
            "user": rm.top_user_name.split()[0] if rm.top_user_name else "",
            "days": 0,
            "tickets": rm.tickets_30,
        }
        base_ctx.update(ctx)
        en_ctx = dict(base_ctx)
        en_ctx["module"] = _mod(module, "en") if module else "the platform"

        out.append({
            "key": key,
            "severity": severity,
            "module": module,
            "title_es": title_es,
            "title_en": title_en,
            "detail_es": detail_es,
            "detail_en": detail_en,
            "evidence": evidence,
            "detected_on": as_of.isoformat(),
            "playbook": {
                "key": playbook_key,
                "title_es": pb.get("title_es"),
                "title_en": pb.get("title_en"),
                "objective_es": pb.get("objective_es"),
                "objective_en": pb.get("objective_en"),
                "owner": pb.get("owner"),
                "channel": pb.get("channel"),
                "sla_days": pb.get("sla_days"),
                "steps_es": pb.get("steps_es", []),
                "steps_en": pb.get("steps_en", []),
                "expected_es": pb.get("expected_es"),
                "expected_en": pb.get("expected_en"),
                "draft_es": _render(pb.get("whatsapp_es", ""), **base_ctx),
                "draft_en": _render(pb.get("whatsapp_en", ""), **en_ctx),
            },
        })

    # 1 — sustained drop -----------------------------------------------------
    if rm.events_prev >= 50 and rm.trend_pct <= -25:
        sev = "critica" if rm.trend_pct <= -45 else "alta"
        worst_mod, worst_delta = None, 0
        for m, prev in rm.module_events_prev.items():
            if prev < 15:
                continue
            delta = rm.module_events_28.get(m, 0) - prev
            if delta < worst_delta:
                worst_mod, worst_delta = m, delta
        add(
            "caida_sostenida", sev,
            "Caída sostenida de uso",
            "Sustained drop in usage",
            f"El registro cayó {abs(rm.trend_pct):.0f}% respecto de los 28 días anteriores "
            f"({rm.events_prev:,} → {rm.events_28:,} eventos)."
            + (f" La mayor caída está en {_mod(worst_mod)}." if worst_mod else ""),
            f"Recording fell {abs(rm.trend_pct):.0f}% versus the previous 28 days "
            f"({rm.events_prev:,} → {rm.events_28:,} events)."
            + (f" The largest drop is in {_mod(worst_mod, 'en')}." if worst_mod else ""),
            "reactivar_uso",
            {"trend_pct": round(rm.trend_pct, 1), "events_28": rm.events_28,
             "events_prev": rm.events_prev, "worst_module": worst_mod},
            module=worst_mod,
        )

    # 2 — abandoned module ---------------------------------------------------
    for m in rm.modules_contracted:
        prev = rm.module_events_prev.get(m, 0)
        now = rm.module_events_28.get(m, 0)
        if prev >= 20 and now == 0:
            last = rm.module_last_seen.get(m)
            days = (as_of - last).days if last else WINDOW
            sev = "alta" if m in COMPLIANCE_MODULES else "media"
            add(
                "modulo_abandonado", sev,
                f"{_mod(m)} sin uso",
                f"{_mod(m, 'en')} no longer used",
                f"Sin registro en {_mod(m)} hace {days} días. Antes promediaba "
                f"{prev / 4:.0f} eventos por semana.",
                f"No recording in {_mod(m, 'en')} for {days} days. It previously averaged "
                f"{prev / 4:.0f} events per week.",
                "recuperar_modulo",
                {"module": m, "days_silent": days, "prev_events": prev},
                module=m, ctx={"days": days},
            )

    # 3 — single-user dependency ---------------------------------------------
    if rm.licensed_seats >= 3 and rm.top_user_share >= 0.65 and rm.events_28 > 0:
        add(
            "dependencia_unipersonal", "alta",
            "Dependencia de un solo usuario",
            "Single-user dependency",
            f"{rm.top_user_name} concentra el {rm.top_user_share * 100:.0f}% del registro. "
            f"Solo {rm.active_users_28} de {rm.licensed_seats} licencias tuvieron actividad.",
            f"{rm.top_user_name} accounts for {rm.top_user_share * 100:.0f}% of all recording. "
            f"Only {rm.active_users_28} of {rm.licensed_seats} licences were active.",
            "ampliar_base_usuarios",
            {"top_user_share": round(rm.top_user_share, 3), "top_user": rm.top_user_name,
             "active_users": rm.active_users_28, "licensed_seats": rm.licensed_seats},
        )

    # 4 — contracted but never adopted ---------------------------------------
    never = rm.modules_never_used
    contracted_weight = sum(MODULE_BY_KEY[k]["weight"] for k in rm.modules_contracted) or 1
    unused_weight = sum(MODULE_BY_KEY[k]["weight"] for k in never)
    unused_share = unused_weight / contracted_weight
    # Materiality gate: every portfolio has a stray unused module. Only flag it
    # when the unused share is big enough to be worth a conversation.
    if never and rm.tenure_days > 60 and (unused_share >= 0.18 or len(never) >= 3):
        m = max(never, key=lambda k: MODULE_BY_KEY[k]["weight"])
        add(
            "adopcion_incompleta", "media" if unused_share >= 0.28 else "baja",
            f"{_mod(m)} nunca se activó",
            f"{_mod(m, 'en')} was never activated",
            f"Contratado hace {rm.tenure_days} días y sin un solo registro. "
            f"{'Junto a ' + str(len(never) - 1) + ' módulo(s) más.' if len(never) > 1 else ''}",
            f"Contracted {rm.tenure_days} days ago with no recording at all. "
            f"{'Along with ' + str(len(never) - 1) + ' other module(s).' if len(never) > 1 else ''}",
            "acompanar_onboarding" if rm.tenure_days < 180 else "recuperar_modulo",
            {"modules": never, "tenure_days": rm.tenure_days,
             "unused_share": round(unused_share, 3)},
            module=m, ctx={"days": rm.tenure_days},
        )

    # 5 — team shrank --------------------------------------------------------
    if rm.licensed_seats >= 4 and rm.seat_coverage < 0.5:
        add(
            "equipo_reducido", "media",
            "Licencias sin uso",
            "Licences going unused",
            f"Solo {rm.active_users_28} de {rm.licensed_seats} licencias registraron actividad "
            f"en 28 días ({rm.seat_coverage * 100:.0f}% de cobertura).",
            f"Only {rm.active_users_28} of {rm.licensed_seats} licences recorded activity "
            f"in 28 days ({rm.seat_coverage * 100:.0f}% coverage).",
            "ampliar_base_usuarios",
            {"active_users": rm.active_users_28, "licensed_seats": rm.licensed_seats,
             "coverage": round(rm.seat_coverage, 3)},
        )

    # 6 — clinical recording gap (compliance) --------------------------------
    gap_module, gap = rm.clinical_gap
    if gap >= 5 and gap_module:
        sev = "critica" if gap >= 12 else "alta"
        add(
            "brecha_clinica", sev,
            f"Brecha en {_mod(gap_module)}",
            f"Gap in {_mod(gap_module, 'en')}",
            f"{gap} de los últimos 28 días sin registro en {_mod(gap_module)}. "
            f"Es la evidencia que revisa una fiscalización SEREMI.",
            f"{gap} of the last 28 days with no {_mod(gap_module, 'en')} entry. "
            f"This is exactly what a SEREMI inspection reviews.",
            "cerrar_brecha_clinica",
            {"gap_days": gap, "module": gap_module,
             "active_days": rm.module_active_days.get(gap_module, 0)},
            module=gap_module, ctx={"days": gap},
        )

    # 7 — family portal dormant ----------------------------------------------
    if "apoderados" in rm.modules_contracted and rm.module_events_28.get("apoderados", 0) < 4:
        add(
            "apoderados_inactivo", "media",
            "Portal de Apoderados dormido",
            "Family Portal dormant",
            f"Solo {rm.module_events_28.get('apoderados', 0)} accesos en 28 días. "
            f"Es el módulo más visible para las familias del residente.",
            f"Only {rm.module_events_28.get('apoderados', 0)} logins in 28 days. "
            f"It is the module residents' families see most.",
            "activar_apoderados",
            {"events_28": rm.module_events_28.get("apoderados", 0)},
            module="apoderados",
        )

    # 8 — renewal at risk ------------------------------------------------------
    if 0 < rm.days_to_renewal <= 90 and rm.events_per_resident_week < peer_median_intensity:
        add(
            "renovacion_riesgo", "alta",
            "Renovación próxima con uso bajo la mediana",
            "Renewal approaching with below-median usage",
            f"Renueva en {rm.days_to_renewal} días con "
            f"{rm.events_per_resident_week:.1f} eventos/residente/semana, bajo la mediana "
            f"de su grupo ({peer_median_intensity:.1f}).",
            f"Renews in {rm.days_to_renewal} days at "
            f"{rm.events_per_resident_week:.1f} events/resident/week, below its peer "
            f"median ({peer_median_intensity:.1f}).",
            "asegurar_renovacion",
            {"days_to_renewal": rm.days_to_renewal, "mrr_clp": rm.mrr_clp,
             "intensity": round(rm.events_per_resident_week, 2),
             "peer_median": round(peer_median_intensity, 2)},
            ctx={"days": rm.days_to_renewal},
        )

    # 9 — support friction -----------------------------------------------------
    if rm.tickets_30 >= 3:
        top_mod = max(rm.ticket_module_counts, key=rm.ticket_module_counts.get) \
            if rm.ticket_module_counts else None
        add(
            "friccion_soporte", "media",
            "Fricción recurrente en soporte",
            "Recurring support friction",
            f"{rm.tickets_30} tickets en 30 días"
            + (f", concentrados en {_mod(top_mod)}." if top_mod else "."),
            f"{rm.tickets_30} tickets in 30 days"
            + (f", concentrated in {_mod(top_mod, 'en')}." if top_mod else "."),
            "resolver_friccion",
            {"tickets_30": rm.tickets_30, "open": rm.open_tickets, "top_module": top_mod},
            module=top_mod,
        )

    # 10 — gone quiet on the human channel -------------------------------------
    if rm.days_since_contact >= 45 and rm.trend_pct < 0:
        add(
            "sin_contacto", "baja",
            "Sin contacto reciente",
            "No recent contact",
            f"{rm.days_since_contact} días sin conversación registrada, con uso a la baja "
            f"({rm.trend_pct:.0f}%).",
            f"{rm.days_since_contact} days with no logged conversation, while usage is "
            f"declining ({rm.trend_pct:.0f}%).",
            "retomar_contacto",
            {"days_since_contact": rm.days_since_contact, "trend_pct": round(rm.trend_pct, 1)},
            ctx={"days": rm.days_since_contact},
        )

    # 11 — expansion opportunity ------------------------------------------------
    occupancy = rm.residents / rm.beds if rm.beds else 0
    if rm.seat_coverage >= 0.85 and rm.trend_pct > 6 and occupancy >= 0.90:
        add(
            "expansion", "oportunidad",
            "Oportunidad de expansión",
            "Expansion opportunity",
            f"{rm.active_users_28}/{rm.licensed_seats} licencias en uso, ocupación "
            f"{occupancy * 100:.0f}% y uso creciendo {rm.trend_pct:.0f}%.",
            f"{rm.active_users_28}/{rm.licensed_seats} licences in use, occupancy "
            f"{occupancy * 100:.0f}% and usage growing {rm.trend_pct:.0f}%.",
            "explorar_expansion",
            {"occupancy": round(occupancy, 3), "seat_coverage": round(rm.seat_coverage, 3),
             "trend_pct": round(rm.trend_pct, 1), "mrr_clp": rm.mrr_clp},
        )

    return out


def priority_of(signal: dict, rm: ResidenceMetrics, risk_probability: float | None) -> float:
    """Rank the attention queue by what is actually at stake.

    Severity alone would sort a 12-bed residence above a 130-bed one with the
    same symptom. Revenue at risk and the model's forward-looking probability
    both belong in the ordering.
    """
    base = SEVERITY_WEIGHT.get(signal["severity"], 20)
    # Log-scaled revenue so a large account matters more, but never 10x more.
    import math
    revenue_factor = 1.0 + math.log1p(rm.mrr_clp / 200_000) * 0.35
    risk_factor = 1.0 + (risk_probability or 0.0) * 0.8
    urgency = 1.0
    if signal["key"] == "renovacion_riesgo":
        urgency = 1.0 + max(0.0, (90 - rm.days_to_renewal)) / 90 * 0.6
    return round(base * revenue_factor * risk_factor * urgency, 2)
