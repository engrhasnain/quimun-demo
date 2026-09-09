import type { Lang } from "@/i18n/dictionary";
import type { RiskBand, Severity, Status, Tone } from "./types";

const LOCALE: Record<Lang, string> = { es: "es-CL", en: "en-GB" };

export function n(value: number, lang: Lang = "es", digits = 0): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Chilean pesos have no decimal part in practice. */
export function clp(value: number, lang: Lang = "es"): string {
  return `$${new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0 }).format(value)}`;
}

export function clpCompact(value: number, lang: Lang = "es"): string {
  if (value >= 1_000_000) return `$${n(value / 1_000_000, lang, 1)}M`;
  if (value >= 1_000) return `$${n(Math.round(value / 1_000), lang)}K`;
  return clp(value, lang);
}

export function compact(value: number, lang: Lang = "es"): string {
  if (Math.abs(value) >= 1_000_000) return `${n(value / 1_000_000, lang, 1)}M`;
  if (Math.abs(value) >= 10_000) return `${n(Math.round(value / 1_000), lang)}K`;
  if (Math.abs(value) >= 1_000) return `${n(value / 1_000, lang, 1)}K`;
  return n(value, lang);
}

export function pct(value: number, lang: Lang = "es", digits = 0): string {
  return `${n(value, lang, digits)}%`;
}

export function signedPct(value: number, lang: Lang = "es", digits = 0): string {
  const s = value > 0 ? "+" : "";
  return `${s}${n(value, lang, digits)}%`;
}

export function shortDate(iso: string, lang: Lang = "es"): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "2-digit", month: "short" }).format(d);
}

export function longDate(iso: string, lang: Lang = "es"): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function monthLabel(iso: string, lang: Lang = "es"): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(LOCALE[lang], { month: "short" }).format(d).replace(".", "");
}

export const STATUS_TONE: Record<Status, Tone> = {
  saludable: "good",
  observacion: "warning",
  en_riesgo: "serious",
  critico: "critical",
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  critica: "critical",
  alta: "serious",
  media: "warning",
  baja: "muted",
  oportunidad: "good",
};

export const RISK_TONE: Record<RiskBand, Tone> = {
  alto: "critical",
  medio: "warning",
  bajo: "good",
};

/** Trend direction, with a dead band so ±3% does not read as movement. */
export function trendClass(v: number): "up" | "down" | "flat" {
  if (v > 3) return "up";
  if (v < -3) return "down";
  return "flat";
}

export function trendArrow(v: number): string {
  if (v > 3) return "↑";
  if (v < -3) return "↓";
  return "→";
}

export const FAMILY_VAR: Record<string, string> = {
  salud: "var(--s-salud)",
  hoteleria: "var(--s-hoteleria)",
  administracion: "var(--s-admin)",
};

/** Sequential ramp used by the adoption heatmap (continuous magnitude). */
export const SEQ = [
  "var(--seq-1)",
  "var(--seq-2)",
  "var(--seq-3)",
  "var(--seq-4)",
  "var(--seq-5)",
  "var(--seq-6)",
  "var(--seq-7)",
];

export function seqColor(v: number): string {
  const i = Math.min(SEQ.length - 1, Math.max(0, Math.round(v * (SEQ.length - 1))));
  return SEQ[i];
}

/** A cell dark enough that white text is the readable choice. */
export function seqNeedsLightText(v: number): boolean {
  return v >= 0.62;
}

/**
 * Probabilities are shown clamped to 1-99%.
 *
 * The model separates these classes cleanly enough to emit 0.9997, and the
 * calibration curve says the top bin is honest (predicted 0.92 vs observed
 * 0.93). But "100%" asserts certainty about a residence's future, which no
 * model has earned - and a single visible "100%" costs more credibility in a
 * demo than the rounding costs in accuracy. The exact value stays in the
 * tooltip.
 */
export function probabilityLabel(p: number, lang: Lang = "es"): string {
  const clamped = Math.min(99, Math.max(1, Math.round(p * 100)));
  return `${n(clamped, lang)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
