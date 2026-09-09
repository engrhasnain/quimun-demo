export type Status = "saludable" | "observacion" | "en_riesgo" | "critico";
export type Severity = "critica" | "alta" | "media" | "baja" | "oportunidad";
export type RiskBand = "alto" | "medio" | "bajo";
export type Tone = "good" | "warning" | "serious" | "critical" | "muted" | "brand";

export interface RiskSummary {
  probability: number;
  band: RiskBand;
  top_driver_es: string | null;
  top_driver_en: string | null;
}

export interface ResidenceRow {
  id: number;
  slug: string;
  name: string;
  region: string;
  region_name: string;
  comuna: string;
  plan: string;
  beds: number;
  residents: number;
  size_band: string;
  owner: string;
  mrr_clp: number;
  days_to_renewal: number;
  tenure_days: number;
  index: number;
  status: Status;
  trend_pct: number;
  events_28: number;
  intensity: number;
  active_users: number;
  licensed_seats: number;
  modules_active: number;
  modules_contracted: number;
  days_since_activity: number;
  last_activity: string | null;
  open_tickets: number;
  sparkline: number[];
  risk: RiskSummary | null;
  signal_count: number;
  top_signal: string | null;
}

export interface Contribution {
  key: string;
  label_es: string;
  label_en: string;
  raw: number;
  standardized: number;
  coef: number;
  contribution: number;
}

export interface RiskFull {
  probability: number;
  log_odds: number;
  band: RiskBand;
  drivers: Contribution[];
  protective: Contribution[];
  all_contributions: Contribution[];
  model_version: string;
}

export interface Playbook {
  key: string;
  title_es: string;
  title_en: string;
  objective_es: string;
  objective_en: string;
  owner: string;
  channel: string;
  sla_days: number;
  steps_es: string[];
  steps_en: string[];
  expected_es: string;
  expected_en: string;
  draft_es: string;
  draft_en: string;
}

export interface Signal {
  id: string;
  key: string;
  severity: Severity;
  module: string | null;
  title_es: string;
  title_en: string;
  detail_es: string;
  detail_en: string;
  evidence: Record<string, unknown>;
  detected_on: string;
  playbook: Playbook;
  residence_id: number;
  residence_slug: string;
  residence_name: string;
  mrr_clp: number;
  owner: string;
  priority: number;
  triage?: {
    status: string;
    assignee: string | null;
    note: string | null;
    snoozed_until: string | null;
    updated_at: string | null;
  };
}

export interface Pillar {
  key: "intensity" | "breadth" | "coverage" | "consistency";
  value: number;
  weight: number;
  evidence: Record<string, any>;
}

export interface ModuleRow {
  key: string;
  name_es: string;
  name_en: string;
  family: string;
  cadence: string;
  compliance: boolean;
  events_28: number;
  events_prev: number;
  delta_pct: number;
  active_days: number;
  lifetime: number;
  last_seen: string | null;
  days_silent: number | null;
  state: "activo" | "inactivo" | "nunca" | "bajo";
}

export interface ForecastPoint {
  week_start: string;
  point: number;
  low: number;
  high: number;
}

export interface Forecast {
  available: boolean;
  history?: { week_start: string; actual: number }[];
  projection?: ForecastPoint[];
  weekly_trend?: number;
  projected_30d?: number;
  recent_30d?: number;
  change_pct?: number;
}

export interface Changepoint {
  day: string;
  shift_pct: number;
  robust_z: number;
  before_median: number;
  after_median: number;
}

export interface ResidenceDetail extends ResidenceRow {
  legal_name: string;
  rut: string;
  contact_name: string;
  contact_role: string;
  whatsapp_group: string;
  pipedrive_id: string;
  onboarded_at: string;
  renewal_at: string;
  score: { index: number; status: Status; trend_pct: number; pillars: Pillar[] };
  risk_full: RiskFull | null;
  signals: Signal[];
  series_daily: { day: string; events: number }[];
  series_family: Record<string, number[]>;
  series_start: string;
  modules: ModuleRow[];
  users: { id: number; name: string; role: string; events: number; last_seen: string }[];
  tickets: {
    opened_at: string; closed_at: string | null; module: string | null;
    subject_es: string; subject_en: string; priority: string; status: string;
  }[];
  interactions: {
    day: string; channel: string; direction: string; author: string;
    summary_es: string; summary_en: string;
  }[];
  forecast: Forecast;
  changepoint: Changepoint | null;
  peer_median_intensity: number;
  band_percentile: number;
}

export interface PortfolioSummary {
  as_of: string;
  has_model: boolean;
  residences: number;
  residents: number;
  beds: number;
  status_counts: Partial<Record<Status, number>>;
  avg_index: number;
  median_index: number;
  mrr_clp: number;
  mrr_at_risk_clp: number;
  attention_count: number;
  watch_count: number;
  events_28: number;
  events_prev: number;
  events_trend_pct: number;
  active_users: number;
  licensed_seats: number;
  open_tickets: number;
  weekly_activity: { week_start: string; events: number }[];
  modules: {
    key: string; name_es: string; name_en: string; family: string;
    cadence: string; compliance: boolean; contracted: number; active: number;
    never: number; adoption_pct: number; events_28: number; events_prev: number;
    delta_pct: number;
  }[];
  decliners: { slug: string; name: string; trend_pct: number; index: number; status: Status; events_28: number }[];
  risers: { slug: string; name: string; trend_pct: number; index: number; status: Status; events_28: number }[];
  regions: { key: string; name: string; residences: number; avg_index: number; mrr_clp: number; attention: number }[];
  bands: { key: string; residences: number; avg_index: number; median_intensity: number }[];
  signal_counts: Record<string, number>;
  signal_severity: Partial<Record<Severity, number>>;
  signal_total: number;
  risk_bands: Partial<Record<RiskBand, number>>;
  early_warning: {
    slug: string; name: string; index: number; trend_pct: number;
    probability: number; driver_es: string | null; driver_en: string | null; mrr_clp: number;
  }[];
}

export interface AdoptionCell {
  module: string;
  state: "activo" | "inactivo" | "nunca" | "no_contratado";
  value: number | null;
  events?: number;
}

export interface Adoption {
  as_of: string;
  families: { key: string; name_es: string; name_en: string; desc_es: string; desc_en: string; events_28: number; events_prev: number; delta_pct: number }[];
  modules: { key: string; name_es: string; name_en: string; family: string; cadence: string; compliance: boolean; weight: number; desc_es: string; desc_en: string }[];
  matrix: {
    slug: string; name: string; plan: string; size_band: string;
    residents: number; status: Status; index: number; cells: AdoptionCell[];
  }[];
}

export interface ModelCard {
  available: boolean;
  reason?: string;
  version?: string;
  algorithm?: string;
  trained_at?: string;
  target?: string;
  target_en?: string;
  horizon_days?: number;
  metrics?: Record<string, number>;
  roc?: { fpr: number; tpr: number }[];
  calibration?: { bin: string; predicted: number; actual: number; n: number }[];
  confusion?: { tp: number; fp: number; fn: number; tn: number };
  thresholds?: { high: number; medium: number; precision_threshold?: number | null };
  coefficients?: { key: string; label_es: string; label_en: string; coef: number; mean: number; scale: number }[];
  training?: Record<string, any>;
  live?: {
    scored: number;
    distribution: { bin: string; n: number }[];
    by_band: Record<string, number>;
  };
}

export interface Meta {
  snapshot_date: string;
  families: { key: string; name_es: string; name_en: string; desc_es: string; desc_en: string }[];
  modules: { key: string; name_es: string; name_en: string; family: string; cadence: string; compliance: boolean; weight: number; desc_es: string; desc_en: string }[];
  plans: { key: string; name_es: string; name_en: string; rank: number }[];
  regions: { key: string; name: string; short: string }[];
  roles: { key: string; name_es: string; name_en: string }[];
  size_bands: { key: string; name_es: string; name_en: string }[];
  statuses: { key: Status; name_es: string; name_en: string; tone: Tone }[];
  severities: { key: Severity; name_es: string; name_en: string; tone: Tone }[];
  pillars: { key: string; name_es: string; name_en: string; desc_es: string; desc_en: string }[];
  channels: { key: string; name_es: string; name_en: string }[];
  owner_teams: { key: string; name_es: string; name_en: string }[];
  playbooks: Playbook[];
}
