"""Grounded reference data for the Quimun domain.

Everything in this file mirrors what Quimun actually sells and how Chilean
long-stay elderly residences (ELEAM) are actually staffed. Module names are the
ones used on quimun.com; roles, plans and geography follow Chilean convention
(SENAMA registry, regiones/comunas, RUT).
"""

# --- Module families -------------------------------------------------------
# The three product modules Quimun markets: Salud, Hotelería, Administración.

FAMILIES = [
    {
        "key": "salud",
        "name_es": "Salud",
        "name_en": "Health",
        "desc_es": "Seguimiento clínico integral del residente.",
        "desc_en": "End-to-end clinical monitoring of the resident.",
    },
    {
        "key": "hoteleria",
        "name_es": "Hotelería",
        "name_en": "Hospitality",
        "desc_es": "Ingresos, egresos, habitaciones y servicios.",
        "desc_en": "Admissions, discharges, rooms and services.",
    },
    {
        "key": "administracion",
        "name_es": "Administración",
        "name_en": "Administration",
        "desc_es": "Contratos, cobranza, reportería y auditoría.",
        "desc_en": "Contracts, billing, reporting and audit.",
    },
]

# --- Modules ---------------------------------------------------------------
# cadence: expected rhythm of legitimate use. A monthly module going quiet for
# a week is noise; a daily module going quiet for a week is a real signal.
#   weight      -> importance in the breadth/adoption pillar
#   compliance  -> evidence a SENAMA/Seremi inspection would ask for
#   min_plan    -> lowest plan that includes the module

MODULES = [
    {
        "key": "ficha_clinica",
        "name_es": "Ficha Clínica",
        "name_en": "Clinical Record",
        "family": "salud",
        "cadence": "daily",
        "weight": 10,
        "compliance": True,
        "min_plan": "esencial",
        "desc_es": "Historia clínica, diagnósticos y evolución diaria del residente.",
        "desc_en": "Clinical history, diagnoses and daily progress notes.",
    },
    {
        "key": "tratamientos",
        "name_es": "Tratamientos Médicos",
        "name_en": "Medical Treatments",
        "family": "salud",
        "cadence": "daily",
        "weight": 10,
        "compliance": True,
        "min_plan": "esencial",
        "desc_es": "Prescripción y registro de administración de medicamentos.",
        "desc_en": "Prescription and medication administration records.",
    },
    {
        "key": "checklist",
        "name_es": "Checklist de Turno",
        "name_en": "Shift Checklist",
        "family": "salud",
        "cadence": "daily",
        "weight": 8,
        "compliance": True,
        "min_plan": "esencial",
        "desc_es": "Verificación de cuidados por turno: aseo, movilización, hidratación.",
        "desc_en": "Per-shift care verification: hygiene, mobilisation, hydration.",
    },
    {
        "key": "evaluaciones",
        "name_es": "Evaluaciones",
        "name_en": "Assessments",
        "family": "salud",
        "cadence": "monthly",
        "weight": 7,
        "compliance": True,
        "min_plan": "profesional",
        "desc_es": "Pautas por perfil terapéutico: Barthel, MMSE, riesgo de caídas, UPP.",
        "desc_en": "Therapeutic-profile scales: Barthel, MMSE, fall risk, pressure ulcers.",
    },
    {
        "key": "ingresos_egresos",
        "name_es": "Ingresos y Egresos",
        "name_en": "Admissions & Discharges",
        "family": "hoteleria",
        "cadence": "weekly",
        "weight": 8,
        "compliance": False,
        "min_plan": "esencial",
        "desc_es": "Admisión, traslados, altas y fallecimientos de residentes.",
        "desc_en": "Admission, transfers, discharges and deaths of residents.",
    },
    {
        "key": "habitaciones",
        "name_es": "Habitaciones y Pisos",
        "name_en": "Rooms & Floors",
        "family": "hoteleria",
        "cadence": "weekly",
        "weight": 6,
        "compliance": False,
        "min_plan": "esencial",
        "desc_es": "Mapa de camas, ocupación y asignación por piso.",
        "desc_en": "Bed map, occupancy and floor assignment.",
    },
    {
        "key": "productos_servicios",
        "name_es": "Productos y Servicios",
        "name_en": "Products & Services",
        "family": "hoteleria",
        "cadence": "weekly",
        "weight": 5,
        "compliance": False,
        "min_plan": "profesional",
        "desc_es": "Servicios adicionales facturables: peluquería, podología, traslados.",
        "desc_en": "Billable extras: hairdressing, podiatry, transfers.",
    },
    {
        "key": "apoderados",
        "name_es": "Portal de Apoderados",
        "name_en": "Family Portal",
        "family": "hoteleria",
        "cadence": "weekly",
        "weight": 7,
        "compliance": False,
        "min_plan": "profesional",
        "desc_es": "Acceso de familias al estado del residente y estado de cuenta.",
        "desc_en": "Family access to resident status and account statement.",
    },
    {
        "key": "costos",
        "name_es": "Costos y Estados de Cuenta",
        "name_en": "Costs & Account Statements",
        "family": "administracion",
        "cadence": "monthly",
        "weight": 8,
        "compliance": False,
        "min_plan": "profesional",
        "desc_es": "Manejo de costos y estados de cuenta por residente.",
        "desc_en": "Cost management and per-resident account statements.",
    },
    {
        "key": "contratos",
        "name_es": "Contratos de Servicios",
        "name_en": "Service Contracts",
        "family": "administracion",
        "cadence": "weekly",
        "weight": 6,
        "compliance": True,
        "min_plan": "profesional",
        "desc_es": "Registro y gestión de contratos de servicio con la familia.",
        "desc_en": "Registration and management of service contracts with the family.",
    },
    {
        "key": "reporteria",
        "name_es": "Reportería",
        "name_en": "Reporting",
        "family": "administracion",
        "cadence": "monthly",
        "weight": 6,
        "compliance": False,
        "min_plan": "profesional",
        "desc_es": "Indicadores de operación, ocupación y cobranza.",
        "desc_en": "Operational, occupancy and billing indicators.",
    },
    {
        "key": "auditorias",
        "name_es": "Auditorías e Informes",
        "name_en": "Audits & Reports",
        "family": "administracion",
        "cadence": "monthly",
        "weight": 8,
        "compliance": True,
        "min_plan": "eleam_plus",
        "desc_es": "Informes instantáneos para fiscalización SENAMA/Seremi.",
        "desc_en": "Instant reports for SENAMA/Seremi inspection.",
    },
]

MODULE_BY_KEY = {m["key"]: m for m in MODULES}
DAILY_MODULES = [m["key"] for m in MODULES if m["cadence"] == "daily"]
COMPLIANCE_MODULES = [m["key"] for m in MODULES if m["compliance"]]

# --- Plans -----------------------------------------------------------------

PLANS = [
    {"key": "esencial", "name_es": "Esencial", "name_en": "Essential", "rank": 1, "clp_per_bed": 4900},
    {"key": "profesional", "name_es": "Profesional", "name_en": "Professional", "rank": 2, "clp_per_bed": 7400},
    {"key": "eleam_plus", "name_es": "ELEAM Plus", "name_en": "ELEAM Plus", "rank": 3, "clp_per_bed": 10200},
]

PLAN_RANK = {p["key"]: p["rank"] for p in PLANS}
PLAN_BY_KEY = {p["key"]: p for p in PLANS}


def modules_for_plan(plan_key: str) -> list[str]:
    """Modules contracted under a plan."""
    rank = PLAN_RANK[plan_key]
    return [m["key"] for m in MODULES if PLAN_RANK[m["min_plan"]] <= rank]


# --- Staff roles -----------------------------------------------------------
# `modules` is what the role legitimately touches. Used both to model realistic
# per-user activity and to detect "only the administrator is still logging in".

ROLES = [
    {
        "key": "direccion",
        "name_es": "Dirección",
        "name_en": "Director",
        "modules": ["reporteria", "auditorias", "costos", "contratos", "ingresos_egresos", "apoderados"],
    },
    {
        "key": "administrador",
        "name_es": "Administrador/a",
        "name_en": "Administrator",
        "modules": [
            "ingresos_egresos", "habitaciones", "productos_servicios",
            "apoderados", "reporteria", "auditorias", "costos", "contratos",
        ],
    },
    {
        "key": "enfermera_jefe",
        "name_es": "Enfermera/o Jefe",
        "name_en": "Head Nurse",
        "modules": ["ficha_clinica", "tratamientos", "checklist", "evaluaciones"],
    },
    {
        "key": "tens",
        "name_es": "TENS",
        "name_en": "Nursing Technician",
        "modules": ["checklist", "tratamientos", "ficha_clinica"],
    },
    {
        "key": "kinesiologo",
        "name_es": "Kinesiólogo/a",
        "name_en": "Physiotherapist",
        "modules": ["evaluaciones", "ficha_clinica"],
    },
    {
        "key": "nutricionista",
        "name_es": "Nutricionista",
        "name_en": "Dietitian",
        "modules": ["evaluaciones", "ficha_clinica"],
    },
    {
        "key": "terapeuta",
        "name_es": "Terapeuta Ocupacional",
        "name_en": "Occupational Therapist",
        "modules": ["evaluaciones", "ficha_clinica"],
    },
    {
        "key": "recepcion",
        "name_es": "Recepción",
        "name_en": "Front Desk",
        "modules": ["ingresos_egresos", "habitaciones", "apoderados", "contratos"],
    },
]

ROLE_BY_KEY = {r["key"]: r for r in ROLES}
CLINICAL_ROLES = {"enfermera_jefe", "tens", "kinesiologo", "nutricionista", "terapeuta"}

# --- Size bands ------------------------------------------------------------
# The brief calls out "very different customer profiles and sizes" - every
# intensity comparison in this product is made *within* a band, never across.

SIZE_BANDS = [
    {"key": "micro", "name_es": "Micro", "name_en": "Micro", "min_beds": 0, "max_beds": 20},
    {"key": "pequena", "name_es": "Pequeña", "name_en": "Small", "min_beds": 21, "max_beds": 40},
    {"key": "mediana", "name_es": "Mediana", "name_en": "Medium", "min_beds": 41, "max_beds": 70},
    {"key": "grande", "name_es": "Grande", "name_en": "Large", "min_beds": 71, "max_beds": 10000},
]

BAND_BY_KEY = {b["key"]: b for b in SIZE_BANDS}


def band_for_beds(beds: int) -> str:
    for b in SIZE_BANDS:
        if b["min_beds"] <= beds <= b["max_beds"]:
            return b["key"]
    return "grande"


# --- Chilean geography -----------------------------------------------------

REGIONS = [
    {"key": "rm", "name": "Región Metropolitana", "short": "RM"},
    {"key": "valparaiso", "name": "Valparaíso", "short": "V"},
    {"key": "biobio", "name": "Biobío", "short": "VIII"},
    {"key": "maule", "name": "Maule", "short": "VII"},
    {"key": "araucania", "name": "La Araucanía", "short": "IX"},
    {"key": "loslagos", "name": "Los Lagos", "short": "X"},
    {"key": "ohiggins", "name": "O’Higgins", "short": "VI"},
    {"key": "coquimbo", "name": "Coquimbo", "short": "IV"},
    {"key": "losrios", "name": "Los Ríos", "short": "XIV"},
    {"key": "antofagasta", "name": "Antofagasta", "short": "II"},
]

REGION_BY_KEY = {r["key"]: r for r in REGIONS}

COMUNAS = {
    "rm": [
        "Las Condes", "Providencia", "Ñuñoa", "La Reina", "Vitacura",
        "La Florida", "Maipú", "Santiago Centro", "Peñalolén", "San Miguel",
        "Puente Alto", "Macul", "Recoleta", "Independencia", "La Cisterna",
    ],
    "valparaiso": ["Viña del Mar", "Valparaíso", "Quilpué", "Concón", "Villa Alemana", "Limache"],
    "biobio": ["Concepción", "Talcahuano", "Chiguayante", "San Pedro de la Paz", "Los Ángeles"],
    "maule": ["Talca", "Curicó", "Linares"],
    "araucania": ["Temuco", "Villarrica", "Padre Las Casas"],
    "loslagos": ["Puerto Montt", "Osorno", "Puerto Varas"],
    "ohiggins": ["Rancagua", "San Fernando"],
    "coquimbo": ["La Serena", "Coquimbo", "Ovalle"],
    "losrios": ["Valdivia", "La Unión"],
    "antofagasta": ["Antofagasta", "Calama"],
}
