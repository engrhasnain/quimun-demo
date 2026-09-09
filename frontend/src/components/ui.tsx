"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { useSettings } from "@/components/Settings";
import {
  RISK_TONE,
  SEVERITY_TONE,
  STATUS_TONE,
  n,
  probabilityLabel,
  signedPct,
  trendArrow,
  trendClass,
} from "@/lib/format";
import type { RiskBand, Severity, Status, Tone } from "@/lib/types";

/* --- status / severity / risk ------------------------------------------- */

export function StatusDot({ status, label = true }: { status: Status; label?: boolean }) {
  const { t } = useSettings();
  return (
    <span className="stat">
      <span className={`dot ${STATUS_TONE[status]}`} aria-hidden />
      {label && <span>{t.status[status]}</span>}
    </span>
  );
}

export function SeverityPill({ severity }: { severity: Severity }) {
  const { t } = useSettings();
  return (
    <span className={`pill ${SEVERITY_TONE[severity]}`}>
      <span className={`dot ${SEVERITY_TONE[severity]}`} aria-hidden />
      {t.severity[severity]}
    </span>
  );
}

export function RiskPill({ band, probability }: { band: RiskBand; probability: number }) {
  const { t, lang } = useSettings();
  return (
    <span className={`pill ${RISK_TONE[band]}`} title={`p = ${probability.toFixed(3)}`}>
      <span className={`dot ${RISK_TONE[band]}`} aria-hidden />
      {t.risk[band]} · {probabilityLabel(probability, lang)}
    </span>
  );
}

/* --- numbers ------------------------------------------------------------- */

export function Delta({ value, digits = 0 }: { value: number; digits?: number }) {
  const { lang } = useSettings();
  const cls = trendClass(value);
  return (
    <span className={`delta ${cls}`}>
      <span aria-hidden>{trendArrow(value)}</span>
      {signedPct(value, lang, digits)}
    </span>
  );
}

export function Meter({
  value,
  max = 100,
  tone = "brand",
  width = 56,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  /** Number = px. Use "100%" to fill the parent without blowing out a grid. */
  width?: number | string;
}) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className={`meter ${tone}`} style={{ width, display: "inline-block" }}>
      <span style={{ width: `${w}%` }} />
    </span>
  );
}

/** The index reads as a number plus a bar - never as a bare colour. */
export function IndexCell({ value, status }: { value: number; status: Status }) {
  const { lang } = useSettings();
  return (
    <span className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
      <span className="num" style={{ fontWeight: 600, minWidth: 30, textAlign: "right" }}>
        {n(value, lang, 0)}
      </span>
      <Meter value={value} tone={STATUS_TONE[status]} width={44} />
    </span>
  );
}

/* --- disclosure ----------------------------------------------------------- */

/**
 * A small "?" that reveals the methodology behind a number.
 *
 * Every card used to carry a paragraph explaining itself. That is the right
 * information and the wrong place for it: it doubles the reading on every
 * screen and makes the product feel like it is justifying itself. Behind a
 * hint, the explanation is one hover away when someone actually asks "how is
 * this calculated?" - which is rarely, and never twice.
 */
export function InfoHint({ text }: { text: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="hint"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="hint-dot"
        aria-label="?"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && <span className="hint-pop">{text}</span>}
    </span>
  );
}

/* --- layout -------------------------------------------------------------- */

export function Card({
  title,
  note,
  actions,
  children,
  flush = false,
  className = "",
  style,
}: {
  title?: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <header className="card-head">
          <div style={{ minWidth: 0 }} className="row">
            {title && <h2 className="card-title">{title}</h2>}
            {note && <InfoHint text={note} />}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? "card-body-flush" : "card-body"}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  unit,
  foot,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  foot?: ReactNode;
  hint?: string;
  /** Colour of the tile's top bar. Decorative - the label carries the meaning. */
  accent?: string;
}) {
  return (
    <div className="kpi" style={accent ? ({ "--kpi-accent": accent } as React.CSSProperties) : undefined}>
      <div className="kpi-label" title={hint}>
        {label}
      </div>
      <div className="kpi-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function ResidenceLink({ slug, name }: { slug: string; name: string }) {
  return (
    <Link href={`/residencias/${slug}`} className="rowlink">
      {name}
    </Link>
  );
}

/* --- interaction --------------------------------------------------------- */

export function CopyButton({ text, small = true }: { text: string; small?: boolean }) {
  const { t } = useSettings();
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className={`btn ghost ${small ? "sm" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked - nothing useful to do */
        }
      }}
    >
      {done ? t.common.copied : t.common.copy}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --- icons ---------------------------------------------------------------
   Hand-drawn on a 16px grid, 1.5px stroke, so they sit at the same optical
   weight as the type. No icon library - a dependency for nine glyphs is not
   worth the bundle.
   ----------------------------------------------------------------------- */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", className: "nav-icon" };
  switch (name) {
    case "portfolio":
      return (
        <svg {...common} aria-hidden>
          <rect x="1.75" y="2.25" width="5" height="5" rx="1" {...S} />
          <rect x="9.25" y="2.25" width="5" height="5" rx="1" {...S} />
          <rect x="1.75" y="8.75" width="5" height="5" rx="1" {...S} />
          <rect x="9.25" y="8.75" width="5" height="5" rx="1" {...S} />
        </svg>
      );
    case "residences":
      return (
        <svg {...common} aria-hidden>
          <path d="M2 14V6.2l6-4 6 4V14" {...S} />
          <path d="M6.2 14V9.4h3.6V14" {...S} />
        </svg>
      );
    case "signals":
      return (
        <svg {...common} aria-hidden>
          <path d="M8 1.9 14.6 13.4H1.4L8 1.9Z" {...S} />
          <path d="M8 6.4v3.1" {...S} />
          <circle cx="8" cy="11.4" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      );
    case "modules":
      return (
        <svg {...common} aria-hidden>
          <path d="M8 1.6 14 5v6L8 14.4 2 11V5l6-3.4Z" {...S} />
          <path d="M2 5l6 3.4L14 5" {...S} />
          <path d="M8 8.4v6" {...S} />
        </svg>
      );
    case "model":
      return (
        <svg {...common} aria-hidden>
          <circle cx="4" cy="4" r="1.9" {...S} />
          <circle cx="12" cy="7" r="1.9" {...S} />
          <circle cx="5.5" cy="12.2" r="1.9" {...S} />
          <path d="M5.7 5.1 10.3 6M10.9 8.6 7 10.9" {...S} />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common} aria-hidden>
          <path d="M2.4 13.6l.85-3.05a5.4 5.4 0 1 1 2.1 2.06L2.4 13.6Z" {...S} />
        </svg>
      );
    case "phone":
      return (
        <svg {...common} aria-hidden>
          <path d="M5.1 2.4 6.6 5.2 5.2 6.5a7 7 0 0 0 4 4l1.3-1.4 2.8 1.5-.5 2a1.3 1.3 0 0 1-1.4.95C6.6 13.1 2.9 9.4 2.5 4.3a1.3 1.3 0 0 1 .95-1.4l1.65-.5Z" {...S} />
        </svg>
      );
    case "visit":
      return (
        <svg {...common} aria-hidden>
          <path d="M8 14.2s4.6-4 4.6-7.5a4.6 4.6 0 1 0-9.2 0C3.4 10.2 8 14.2 8 14.2Z" {...S} />
          <circle cx="8" cy="6.6" r="1.7" {...S} />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common} aria-hidden>
          <path d="M2 5.4V3.6h12v1.8a1.6 1.6 0 0 0 0 3.2v3.8H2V8.6a1.6 1.6 0 0 0 0-3.2Z" {...S} />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common} aria-hidden>
          <path d="M3.4 8h9.2M9 4.4 12.6 8 9 11.6" {...S} />
        </svg>
      );
    case "sun":
      return (
        <svg {...common} aria-hidden>
          <circle cx="8" cy="8" r="3" {...S} />
          <path d="M8 1.4v1.4M8 13.2v1.4M1.4 8h1.4M13.2 8h1.4M3.3 3.3l1 1M11.7 11.7l1 1M12.7 3.3l-1 1M4.3 11.7l-1 1" {...S} />
        </svg>
      );
    case "moon":
      return (
        <svg {...common} aria-hidden>
          <path d="M13.2 9.4A5.6 5.6 0 0 1 6.6 2.8a5.6 5.6 0 1 0 6.6 6.6Z" {...S} />
        </svg>
      );
    default:
      return null;
  }
}

export function ChannelIcon({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    whatsapp: "whatsapp",
    llamada: "phone",
    visita: "visit",
    ticket: "ticket",
    email: "ticket",
  };
  return <Icon name={map[channel] ?? "whatsapp"} size={13} />;
}
