"""Reference data the frontend needs to render labels in either language."""

from fastapi import APIRouter

from app.analytics.playbooks import PLAYBOOKS
from app.catalog import (
    FAMILIES,
    MODULES,
    PLANS,
    REGIONS,
    ROLES,
    SIZE_BANDS,
)
from app.core.config import SNAPSHOT_DATE

router = APIRouter(prefix="/api/meta", tags=["meta"])

STATUSES = [
    {"key": "saludable", "name_es": "Saludable", "name_en": "Healthy", "tone": "good"},
    {"key": "observacion", "name_es": "En observación", "name_en": "Watch", "tone": "warning"},
    {"key": "en_riesgo", "name_es": "En riesgo", "name_en": "At risk", "tone": "serious"},
    {"key": "critico", "name_es": "Crítico", "name_en": "Critical", "tone": "critical"},
]

SEVERITIES = [
    {"key": "critica", "name_es": "Crítica", "name_en": "Critical", "tone": "critical"},
    {"key": "alta", "name_es": "Alta", "name_en": "High", "tone": "serious"},
    {"key": "media", "name_es": "Media", "name_en": "Medium", "tone": "warning"},
    {"key": "baja", "name_es": "Baja", "name_en": "Low", "tone": "muted"},
    {"key": "oportunidad", "name_es": "Oportunidad", "name_en": "Opportunity", "tone": "good"},
]

PILLARS = [
    {
        "key": "intensity",
        "name_es": "Intensidad",
        "name_en": "Intensity",
        "desc_es": "Volumen de registro por residente, comparado con residencias de su mismo tamaño.",
        "desc_en": "Recording volume per resident, compared against residences of the same size.",
    },
    {
        "key": "breadth",
        "name_es": "Amplitud",
        "name_en": "Breadth",
        "desc_es": "Qué parte de lo contratado está realmente en uso, ponderado por importancia del módulo.",
        "desc_en": "How much of what they pay for is actually in use, weighted by module importance.",
    },
    {
        "key": "coverage",
        "name_es": "Cobertura de equipo",
        "name_en": "Team coverage",
        "desc_es": "Cuántas licencias y qué roles registran. Penaliza que todo dependa de una persona.",
        "desc_en": "How many licences and which roles record. Penalises everything resting on one person.",
    },
    {
        "key": "consistency",
        "name_es": "Consistencia",
        "name_en": "Consistency",
        "desc_es": "Ritmo de uso: los módulos diarios se usan a diario, no en una puesta al día mensual.",
        "desc_en": "Rhythm of use: daily modules used daily, not in a monthly catch-up.",
    },
]

CHANNELS = [
    {"key": "whatsapp", "name_es": "WhatsApp", "name_en": "WhatsApp"},
    {"key": "llamada", "name_es": "Llamada", "name_en": "Call"},
    {"key": "visita", "name_es": "Visita", "name_en": "On-site visit"},
    {"key": "email", "name_es": "Correo", "name_en": "Email"},
]

OWNER_TEAMS = [
    {"key": "csm", "name_es": "Customer Success", "name_en": "Customer Success"},
    {"key": "soporte", "name_es": "Soporte", "name_en": "Support"},
    {"key": "onboarding", "name_es": "Onboarding", "name_en": "Onboarding"},
    {"key": "ventas", "name_es": "Ventas", "name_en": "Sales"},
]


@router.get("")
def meta() -> dict:
    return {
        "snapshot_date": SNAPSHOT_DATE,
        "families": FAMILIES,
        "modules": MODULES,
        "plans": PLANS,
        "regions": REGIONS,
        "roles": ROLES,
        "size_bands": SIZE_BANDS,
        "statuses": STATUSES,
        "severities": SEVERITIES,
        "pillars": PILLARS,
        "channels": CHANNELS,
        "owner_teams": OWNER_TEAMS,
        "playbooks": [
            {
                "key": k,
                "title_es": v["title_es"], "title_en": v["title_en"],
                "objective_es": v["objective_es"], "objective_en": v["objective_en"],
                "owner": v["owner"], "channel": v["channel"], "sla_days": v["sla_days"],
                "steps_es": v["steps_es"], "steps_en": v["steps_en"],
                "expected_es": v["expected_es"], "expected_en": v["expected_en"],
            }
            for k, v in PLAYBOOKS.items()
        ],
    }
