"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useSettings } from "@/components/Settings";
import { FAMILY_VAR, compact, monthLabel, n, seqColor, shortDate } from "@/lib/format";

/* ------------------------------------------------------------------ utils */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(680);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const next = Math.round(e.contentRect.width);
      if (next > 0) setW(next);
    });
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width) || 680);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  const pad = 14;
  const style: React.CSSProperties = {
    left: Math.min(tip.x + pad, (typeof window !== "undefined" ? window.innerWidth : 1200) - 220),
    top: Math.max(8, tip.y - 12),
  };
  return (
    <div className="tip" style={style} role="tooltip">
      {tip.content}
    </div>
  );
}

function niceTicks(max: number, count = 4, min = 0): number[] {
  if (max <= min) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max * 1.0001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

/** Month labels repeat when consecutive picks land in the same month. */
function dedupeLabels(labels: (string | null)[]): (string | null)[] {
  let prev: string | null = null;
  return labels.map((l) => {
    if (l && l === prev) return null;
    if (l) prev = l;
    return l;
  });
}

function linePath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
}

/* ------------------------------------------------------------- sparkline */

/**
 * Row-level micro chart. No axes, no tooltip layer - it is a shape, read
 * alongside the number in the adjacent column, with a native title for the
 * exact values.
 */
export function Sparkline({
  values,
  width = 90,
  height = 26,
  tone,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: string;
}) {
  const { lang } = useSettings();
  if (!values.length) return <span className="dim">—</span>;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const dx = values.length > 1 ? (width - 2) / (values.length - 1) : 0;
  const pts: [number, number][] = values.map((v, i) => [
    1 + i * dx,
    height - 2 - ((v - min) / span) * (height - 4),
  ]);

  const stroke = tone ?? "var(--ink-3)";
  const last = pts[pts.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${values.length} ${lang === "es" ? "semanas" : "weeks"}`}
    >
      <title>
        {values.map((v) => n(v, lang)).join(" · ")}
      </title>
      <path d={linePath(pts)} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={stroke} />
    </svg>
  );
}

/* ------------------------------------------------------- weekly area line */

export function TrendArea({
  data,
  height = 190,
  color = "var(--s-salud)",
  label,
  baseline = "zero",
}: {
  data: { week_start: string; events: number }[];
  height?: number;
  color?: string;
  label: string;
  /**
   * "zero" draws a filled area from a zero baseline - correct when the reader
   * should judge magnitude. "fit" scales to the data range and drops the fill,
   * because a filled shape above a non-zero baseline overstates the change.
   * Use "fit" when the series is stable and the week-to-week shape is the story.
   */
  baseline?: "zero" | "fit";
}) {
  const { lang } = useSettings();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const pad = { t: 12, r: 14, b: 22, l: 44 };
  const iw = Math.max(120, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;

  const rawMax = Math.max(...data.map((d) => d.events), 1);
  const rawMin = Math.min(...data.map((d) => d.events), rawMax);
  const fitted = baseline === "fit";
  const lo = fitted ? Math.max(0, rawMin - (rawMax - rawMin) * 0.35) : 0;
  // A fitted domain can land on a small step and produce a ladder of gridlines.
  // Thin them out: five horizontal rules is plenty to read a level against.
  let ticks = niceTicks(rawMax, fitted ? 3 : 4, lo);
  while (ticks.length > 6) ticks = ticks.filter((_, i) => i % 2 === 0);
  const top = ticks[ticks.length - 1] || rawMax;
  const bottom = ticks[0] ?? 0;
  const span = top - bottom || 1;

  const x = (i: number) => pad.l + (data.length > 1 ? (i * iw) / (data.length - 1) : iw / 2);
  const y = (v: number) => pad.t + ih - ((v - bottom) / span) * ih;

  const pts: [number, number][] = data.map((d, i) => [x(i), y(d.events)]);
  const area = `${linePath(pts)} L${x(data.length - 1)} ${pad.t + ih} L${x(0)} ${pad.t + ih} Z`;
  const monthLabels = dedupeLabels(
    data.map((d, i) => (i % 3 === 0 ? monthLabel(d.week_start, lang) : null)),
  );

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const rel = e.clientX - rect.left - pad.l;
      const i = Math.max(0, Math.min(data.length - 1, Math.round((rel / iw) * (data.length - 1))));
      setHover(i);
      setTip({
        x: e.clientX,
        y: e.clientY,
        content: (
          <>
            <div className="tip-head">
              {lang === "es" ? "Semana del" : "Week of"} {shortDate(data[i].week_start, lang)}
            </div>
            <div className="tip-row">
              <span className="swatch" style={{ background: color }} />
              <span className="k">{label}</span>
              <span className="v">{n(data[i].events, lang)}</span>
            </div>
          </>
        ),
      });
    },
    [data, iw, lang, color, label, pad.l],
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setTip(null);
          setHover(null);
        }}
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id="ta-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.26} />
            <stop offset="100%" stopColor={color} stopOpacity={0.015} />
          </linearGradient>
        </defs>

        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(tk)} y2={y(tk)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(tk) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-4)" className="num">
              {compact(tk, lang)}
            </text>
          </g>
        ))}

        {!fitted && <path d={area} fill="url(#ta-fill)" />}
        <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={2.75} strokeLinejoin="round" strokeLinecap="round" />

        {monthLabels.map((lbl, i) =>
          lbl ? (
            <text key={data[i].week_start} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--ink-4)">
              {lbl}
            </text>
          ) : null,
        )}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--ink-4)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover].events)} r={5.5} fill={color} stroke="var(--surface)" strokeWidth={2.5} />
          </g>
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* --------------------------------------------------- stacked family areas */

export function StackedFamilyArea({
  series: rawSeries,
  start,
  height = 220,
  families,
  smooth = 7,
}: {
  series: Record<string, number[]>;
  start: string;
  height?: number;
  families: { key: string; label: string }[];
  /**
   * Trailing-mean window. Raw daily counts here swing enormously by weekday
   * (administrative modules essentially stop on Sundays), which reads as noise
   * and buries the trend. A 7-day mean removes exactly one weekly cycle.
   * Set to 1 to plot raw days.
   */
  smooth?: number;
}) {
  const { lang } = useSettings();

  const series = useMemo(() => {
    if (smooth <= 1) return rawSeries;
    const out: Record<string, number[]> = {};
    for (const [k, arr] of Object.entries(rawSeries)) {
      out[k] = arr.map((_, i) => {
        const from = Math.max(0, i - smooth + 1);
        const win = arr.slice(from, i + 1);
        return win.reduce((a, b) => a + b, 0) / win.length;
      });
    }
    return out;
  }, [rawSeries, smooth]);
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const keys = families.map((f) => f.key).filter((k) => series[k]);
  const len = keys.length ? series[keys[0]].length : 0;

  const pad = { t: 12, r: 14, b: 22, l: 44 };
  const iw = Math.max(120, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;

  const totals = useMemo(() => {
    const out: number[] = new Array(len).fill(0);
    for (const k of keys) series[k].forEach((v, i) => (out[i] += v));
    return out;
  }, [keys, series, len]);

  const max = Math.max(...totals, 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || max;

  const x = (i: number) => pad.l + (len > 1 ? (i * iw) / (len - 1) : iw / 2);
  const y = (v: number) => pad.t + ih - (v / top) * ih;

  // Cumulative boundaries, bottom band first.
  const bounds = useMemo(() => {
    const acc: number[][] = [];
    const running = new Array(len).fill(0);
    for (const k of keys) {
      series[k].forEach((v, i) => (running[i] += v));
      acc.push([...running]);
    }
    return acc;
  }, [keys, series, len]);

  const startDate = useMemo(() => new Date(`${start}T00:00:00`), [start]);
  const dayLabel = (i: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  };

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const rel = e.clientX - rect.left - pad.l;
      const i = Math.max(0, Math.min(len - 1, Math.round((rel / iw) * (len - 1))));
      setHover(i);
      setTip({
        x: e.clientX,
        y: e.clientY,
        content: (
          <>
            <div className="tip-head">{shortDate(dayLabel(i), lang)}</div>
            {keys.map((k, ki) => (
              <div className="tip-row" key={k}>
                <span className="swatch" style={{ background: FAMILY_VAR[k] }} />
                <span className="k">{families[ki]?.label ?? k}</span>
                <span className="v">{n(series[k][i], lang, smooth > 1 ? 1 : 0)}</span>
              </div>
            ))}
            <div className="tip-row" style={{ borderTop: "1px solid var(--line-2)", marginTop: 4, paddingTop: 4 }}>
              <span className="k" style={{ marginLeft: 15 }}>
                Total
              </span>
              <span className="v">{n(totals[i], lang, smooth > 1 ? 1 : 0)}</span>
            </div>
          </>
        ),
      });
    },
    [len, iw, keys, series, families, lang, totals, pad.l, startDate],
  );

  if (!len) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setTip(null);
          setHover(null);
        }}
      >
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(tk)} y2={y(tk)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(tk) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-4)" className="num">
              {compact(tk, lang)}
            </text>
          </g>
        ))}

        {keys.map((k, ki) => {
          const upper = bounds[ki];
          const lower = ki === 0 ? new Array(len).fill(0) : bounds[ki - 1];
          const up: [number, number][] = upper.map((v, i) => [x(i), y(v)] as [number, number]);
          const down: [number, number][] = lower
            .map((v: number, i: number) => [x(i), y(v)] as [number, number])
            .reverse();
          const d = `${linePath(up)} L${down.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L")} Z`;
          return (
            <g key={k}>
              <path d={d} fill={FAMILY_VAR[k]} fillOpacity={0.9} />
              {/* 2px surface gap so adjacent bands never bleed into each other */}
              <path d={linePath(up)} fill="none" stroke="var(--surface)" strokeWidth={2} />
            </g>
          );
        })}

        {dedupeLabels(
          Array.from({ length: 7 }, (_, k) => Math.round((k * (len - 1)) / 6)).map((i) =>
            monthLabel(dayLabel(i), lang),
          ),
        ).map((lbl, k) => {
          const i = Math.round((k * (len - 1)) / 6);
          return lbl ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--ink-4)">
              {lbl}
            </text>
          ) : null;
        })}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </svg>
      <Tooltip tip={tip} />
      <div className="legend" style={{ marginTop: 8 }}>
        {families.map((f) => (
          <span className="legend-item" key={f.key}>
            <span className="legend-swatch" style={{ background: FAMILY_VAR[f.key] }} />
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- forecast */

export function ForecastChart({
  history,
  projection,
  height = 190,
}: {
  history: { week_start: string; actual: number }[];
  projection: { week_start: string; point: number; low: number; high: number }[];
  height?: number;
}) {
  const { lang, t } = useSettings();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);

  const pad = { t: 12, r: 14, b: 22, l: 44 };
  const iw = Math.max(120, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;

  const total = history.length + projection.length;
  const max = Math.max(...history.map((h) => h.actual), ...projection.map((p) => p.high), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || max;

  const x = (i: number) => pad.l + (total > 1 ? (i * iw) / (total - 1) : iw / 2);
  const y = (v: number) => pad.t + ih - (v / top) * ih;

  const hp: [number, number][] = history.map((h, i) => [x(i), y(h.actual)]);
  const anchor = hp[hp.length - 1];
  const pp: [number, number][] = projection.map((p, i) => [x(history.length + i), y(p.point)]);
  const upper: [number, number][] = projection.map((p, i) => [x(history.length + i), y(p.high)]);
  const lower: [number, number][] = projection.map((p, i) => [x(history.length + i), y(p.low)]);

  const bandPath = `${linePath([anchor, ...upper])} L${[...lower].reverse().map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L")} L${anchor[0].toFixed(2)} ${anchor[1].toFixed(2)} Z`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = e.clientX - rect.left - pad.l;
          const i = Math.max(0, Math.min(total - 1, Math.round((rel / iw) * (total - 1))));
          const isProj = i >= history.length;
          const p = isProj ? projection[i - history.length] : null;
          const h = !isProj ? history[i] : null;
          setTip({
            x: e.clientX,
            y: e.clientY,
            content: (
              <>
                <div className="tip-head">
                  {lang === "es" ? "Semana del" : "Week of"}{" "}
                  {shortDate(isProj ? p!.week_start : h!.week_start, lang)}
                </div>
                {isProj ? (
                  <>
                    <div className="tip-row">
                      <span className="swatch" style={{ background: "var(--s-5)" }} />
                      <span className="k">{lang === "es" ? "Proyectado" : "Projected"}</span>
                      <span className="v">{n(p!.point, lang)}</span>
                    </div>
                    <div className="tip-row">
                      <span className="k" style={{ marginLeft: 15 }}>
                        {lang === "es" ? "Rango 95%" : "95% range"}
                      </span>
                      <span className="v">
                        {n(p!.low, lang)}–{n(p!.high, lang)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="tip-row">
                    <span className="swatch" style={{ background: "var(--s-salud)" }} />
                    <span className="k">{lang === "es" ? "Real" : "Actual"}</span>
                    <span className="v">{n(h!.actual, lang)}</span>
                  </div>
                )}
              </>
            ),
          });
        }}
        onMouseLeave={() => setTip(null)}
      >
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(tk)} y2={y(tk)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(tk) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-4)" className="num">
              {compact(tk, lang)}
            </text>
          </g>
        ))}

        <path d={bandPath} fill="var(--s-5)" fillOpacity={0.2} />
        <path d={linePath(hp)} fill="none" stroke="var(--s-salud)" strokeWidth={2.75} strokeLinejoin="round" />
        <path
          d={linePath([anchor, ...pp])}
          fill="none"
          stroke="var(--s-5)"
          strokeWidth={2.75}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
        <line x1={anchor[0]} x2={anchor[0]} y1={pad.t} y2={pad.t + ih} stroke="var(--line-strong)" strokeWidth={1} />
        <circle cx={anchor[0]} cy={anchor[1]} r={3} fill="var(--s-salud)" stroke="var(--surface)" strokeWidth={2} />

        {dedupeLabels(
          history.map((h, i) => (i % 3 === 0 ? monthLabel(h.week_start, lang) : null)),
        ).map((lbl, i) =>
          lbl ? (
            <text key={history[i].week_start} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--ink-4)">
              {lbl}
            </text>
          ) : null,
        )}
        {projection.length > 0 && (
          <text x={x(total - 1)} y={height - 6} textAnchor="end" fontSize={10} fill="var(--ink-4)">
            {monthLabel(projection[projection.length - 1].week_start, lang)}
          </text>
        )}
      </svg>
      <Tooltip tip={tip} />
      <div className="legend" style={{ marginTop: 8 }}>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--s-salud)" }} />
          {lang === "es" ? "Real" : "Actual"}
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--s-5)" }} />
          {lang === "es" ? "Proyección (banda 95%)" : "Projection (95% band)"}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- status ribbon */

export function StatusRibbon({
  counts,
  order,
  labels,
  tones,
}: {
  counts: Record<string, number>;
  order: string[];
  labels: Record<string, string>;
  tones: Record<string, string>;
}) {
  const { lang } = useSettings();
  const total = order.reduce((s, k) => s + (counts[k] ?? 0), 0) || 1;

  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 }}>
        {order.map((k) => {
          const v = counts[k] ?? 0;
          if (!v) return null;
          return (
            <div
              key={k}
              title={`${labels[k]}: ${v}`}
              style={{ width: `${(v / total) * 100}%`, background: tones[k], borderRadius: 2 }}
            />
          );
        })}
      </div>
      <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
        {order.map((k) => {
          const v = counts[k] ?? 0;
          return (
            <div key={k} className="row" style={{ fontSize: 12.5 }}>
              <span className="dot" style={{ background: tones[k] }} aria-hidden />
              <span style={{ color: "var(--ink-2)" }}>{labels[k]}</span>
              <span className="num" style={{ marginLeft: "auto", fontWeight: 600 }}>
                {n(v, lang)}
              </span>
              <span className="num dim" style={{ width: 42, textAlign: "right" }}>
                {n((v / total) * 100, lang)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------ diverging contribution */

/**
 * Signed bars around a zero axis. Used for model coefficients and for a single
 * residence's risk drivers - the arithmetic of a logistic model is a sum, so
 * this chart *is* the explanation, not an approximation of it.
 */
export function DivergingBars({
  items,
  height = 26,
  labelWidth = 190,
  valueFormat,
}: {
  items: { label: string; value: number; hint?: string }[];
  height?: number;
  labelWidth?: number;
  valueFormat?: (v: number) => string;
}) {
  const { lang } = useSettings();
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0.001);
  const fmt = valueFormat ?? ((v: number) => (v > 0 ? "+" : "") + n(v, lang, 2));

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {items.map((it, i) => {
        const w = (Math.abs(it.value) / max) * 50;
        const positive = it.value >= 0;
        return (
          <div
            key={`${it.label}-${i}`}
            style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 1fr 58px`, alignItems: "center", gap: 10 }}
            title={it.hint}
          >
            <span
              style={{
                fontSize: 11.5,
                color: "var(--ink-2)",
                lineHeight: 1.25,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {it.label}
            </span>
            <div style={{ position: "relative", height }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line-strong)" }} />
              <div
                style={{
                  position: "absolute",
                  top: height / 2 - 5,
                  height: 10,
                  borderRadius: 3,
                  background: positive ? "var(--critical)" : "var(--s-salud)",
                  opacity: 0.85,
                  left: positive ? "50%" : `${50 - w}%`,
                  width: `${w}%`,
                }}
              />
            </div>
            <span className="num" style={{ fontSize: 11.5, textAlign: "right", color: "var(--ink-2)", fontWeight: 550 }}>
              {fmt(it.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- heatmap */

export function HeatMatrix({
  rows,
  columns,
  cellFor,
  onCellTip,
  rowLabel,
  rowHref,
}: {
  rows: { key: string; label: string; meta?: ReactNode }[];
  columns: { key: string; label: string }[];
  cellFor: (rowKey: string, colKey: string) => { state: string; value: number | null; events?: number };
  onCellTip: (rowKey: string, colKey: string) => ReactNode;
  rowLabel: string;
  rowHref?: (rowKey: string) => string;
}) {
  const [tip, setTip] = useState<TipState | null>(null);

  return (
    <div style={{ position: "relative", overflowX: "auto" }}>
      <table className="data" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th style={{ minWidth: 210, position: "sticky", left: 0, zIndex: 3 }}>{rowLabel}</th>
            {columns.map((c) => (
              <th key={c.key} className="n" style={{ minWidth: 62 }}>
                <span style={{ display: "inline-block", fontSize: 10 }}>{c.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ position: "sticky", left: 0, background: "var(--surface)", zIndex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {rowHref ? (
                    <a href={rowHref(r.key)} className="rowlink">
                      {r.label}
                    </a>
                  ) : (
                    <span style={{ fontWeight: 550 }}>{r.label}</span>
                  )}
                  {r.meta}
                </div>
              </td>
              {columns.map((c) => {
                const cell = cellFor(r.key, c.key);
                let bg = "transparent";
                let border = "1px solid var(--line-2)";
                if (cell.state === "nunca") bg = "var(--surface-3)";
                else if (cell.state === "inactivo") bg = "var(--surface-3)";
                else if (cell.state === "activo") {
                  bg = seqColor(cell.value ?? 0);
                  border = "1px solid transparent";
                }
                return (
                  <td
                    key={c.key}
                    style={{ padding: 3 }}
                    onMouseEnter={(e) =>
                      setTip({ x: e.clientX, y: e.clientY, content: onCellTip(r.key, c.key) })
                    }
                    onMouseMove={(e) =>
                      setTip({ x: e.clientX, y: e.clientY, content: onCellTip(r.key, c.key) })
                    }
                    onMouseLeave={() => setTip(null)}
                  >
                    <div
                      style={{
                        height: 22,
                        borderRadius: 3,
                        background: bg,
                        border,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {cell.state === "nunca" && (
                        <span style={{ fontSize: 10, color: "var(--ink-4)" }}>—</span>
                      )}
                      {cell.state === "inactivo" && (
                        <span style={{ fontSize: 9, color: "var(--serious)", fontWeight: 700 }}>!</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ---------------------------------------------------------- ROC + calib */

export function RocChart({ points, auc, size = 220 }: { points: { fpr: number; tpr: number }[]; auc: number; size?: number }) {
  const { lang } = useSettings();
  const pad = 28;
  const inner = size - pad * 2;
  const x = (v: number) => pad + v * inner;
  const y = (v: number) => pad + inner - v * inner;
  const pts: [number, number][] = points.map((p) => [x(p.fpr), y(p.tpr)]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`ROC, AUC ${auc}`}
      style={{ width: "100%", maxWidth: 300, height: "auto", margin: "0 auto" }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={x(0)} x2={x(1)} y1={y(g)} y2={y(g)} stroke="var(--grid)" strokeWidth={1} />
          <line x1={x(g)} x2={x(g)} y1={y(0)} y2={y(1)} stroke="var(--grid)" strokeWidth={1} />
        </g>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-4)" strokeWidth={1} strokeDasharray="4 3" />
      <path d={`${linePath(pts)} L${x(1)} ${y(0)} Z`} fill="var(--s-salud)" fillOpacity={0.1} />
      <path d={linePath(pts)} fill="none" stroke="var(--s-salud)" strokeWidth={2.75} strokeLinejoin="round" />
      <text x={x(0.55)} y={y(0.22)} fontSize={12} fill="var(--ink-2)" fontWeight={600} className="num">
        AUC {n(auc, lang, 3)}
      </text>
      <text x={x(0.5)} y={size - 6} textAnchor="middle" fontSize={10} fill="var(--ink-4)">
        {lang === "es" ? "Falsos positivos" : "False positive rate"}
      </text>
      <text x={10} y={y(0.5)} fontSize={10} fill="var(--ink-4)" transform={`rotate(-90 10 ${y(0.5)})`} textAnchor="middle">
        {lang === "es" ? "Verdaderos positivos" : "True positive rate"}
      </text>
    </svg>
  );
}

export function CalibrationChart({
  bins,
  size = 220,
}: {
  bins: { bin: string; predicted: number; actual: number; n: number }[];
  size?: number;
}) {
  const { lang } = useSettings();
  const [tip, setTip] = useState<TipState | null>(null);
  const pad = 28;
  const inner = size - pad * 2;
  const x = (v: number) => pad + v * inner;
  const y = (v: number) => pad + inner - v * inner;
  const maxN = Math.max(...bins.map((b) => b.n), 1);

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: "100%", maxWidth: 300, height: "auto", margin: "0 auto" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={x(0)} x2={x(1)} y1={y(g)} y2={y(g)} stroke="var(--grid)" strokeWidth={1} />
            <line x1={x(g)} x2={x(g)} y1={y(0)} y2={y(1)} stroke="var(--grid)" strokeWidth={1} />
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-4)" strokeWidth={1} strokeDasharray="4 3" />
        <path
          d={linePath(bins.map((b) => [x(b.predicted), y(b.actual)] as [number, number]))}
          fill="none"
          stroke="var(--s-admin)"
          strokeWidth={2.75}
        />
        {bins.map((b) => (
          <circle
            key={b.bin}
            cx={x(b.predicted)}
            cy={y(b.actual)}
            r={4 + (b.n / maxN) * 4}
            fill="var(--s-admin)"
            stroke="var(--surface)"
            strokeWidth={2}
            onMouseEnter={(e) =>
              setTip({
                x: e.clientX,
                y: e.clientY,
                content: (
                  <>
                    <div className="tip-head">{b.bin}</div>
                    <div className="tip-row">
                      <span className="k">{lang === "es" ? "Predicho" : "Predicted"}</span>
                      <span className="v">{n(b.predicted * 100, lang, 1)}%</span>
                    </div>
                    <div className="tip-row">
                      <span className="k">{lang === "es" ? "Observado" : "Observed"}</span>
                      <span className="v">{n(b.actual * 100, lang, 1)}%</span>
                    </div>
                    <div className="tip-row">
                      <span className="k">n</span>
                      <span className="v">{b.n}</span>
                    </div>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTip(null)}
          />
        ))}
        <text x={x(0.5)} y={size - 6} textAnchor="middle" fontSize={10} fill="var(--ink-4)">
          {lang === "es" ? "Probabilidad predicha" : "Predicted probability"}
        </text>
        <text x={10} y={y(0.5)} fontSize={10} fill="var(--ink-4)" transform={`rotate(-90 10 ${y(0.5)})`} textAnchor="middle">
          {lang === "es" ? "Frecuencia real" : "Observed frequency"}
        </text>
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ---------------------------------------------------------- simple bars */

export function BarList({
  items,
  height = 22,
  color = "var(--s-salud)",
  labelWidth = 168,
  format,
}: {
  items: { label: string; value: number; sub?: string; color?: string }[];
  height?: number;
  color?: string;
  labelWidth?: number;
  format?: (v: number) => string;
}) {
  const { lang } = useSettings();
  const max = Math.max(...items.map((i) => i.value), 1);
  const fmt = format ?? ((v: number) => n(v, lang));

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {items.map((it) => (
        <div
          key={it.label}
          style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 1fr auto`, gap: 10, alignItems: "center" }}
        >
          <span className="truncate" style={{ fontSize: 12, color: "var(--ink-2)" }} title={it.label}>
            {it.label}
          </span>
          <div style={{ background: "var(--surface-3)", borderRadius: 3, height }}>
            <div
              style={{
                width: `${(it.value / max) * 100}%`,
                height: "100%",
                background: it.color ?? color,
                borderRadius: 3,
                minWidth: it.value > 0 ? 3 : 0,
              }}
            />
          </div>
          <span className="num" style={{ fontSize: 12, fontWeight: 550, minWidth: 44, textAlign: "right" }}>
            {fmt(it.value)}
          </span>
        </div>
      ))}
    </div>
  );
}


/* ------------------------------------------------------- small multiples */

/**
 * One mini chart per module family, each on ITS OWN y-scale.
 *
 * Clinical recording runs roughly seventy times the volume of the
 * administrative modules - three shifts a day for every resident. Stacked on a
 * shared axis, Hotelería and Administración are invisible lines along the
 * baseline. Faceting with independent scales is the honest way to show shape
 * when magnitudes differ this much; a second y-axis would not be.
 */
export function FamilySmallMultiples({
  series,
  start,
  families,
  height = 96,
}: {
  series: Record<string, number[]>;
  start: string;
  families: { key: string; label: string }[];
  height?: number;
}) {
  const { lang } = useSettings();
  const [tip, setTip] = useState<TipState | null>(null);
  const startDate = useMemo(() => new Date(`${start}T00:00:00`), [start]);

  return (
    <div style={{ position: "relative", display: "grid", gap: 12 }}>
      {families.map((f) => {
        const raw = series[f.key] ?? [];
        if (!raw.length) return null;
        // Weekly buckets: daily clinical data is dominated by weekday shape.
        const weeks: number[] = [];
        for (let i = 0; i < raw.length; i += 7) weeks.push(raw.slice(i, i + 7).reduce((a, b) => a + b, 0));
        const max = Math.max(...weeks, 1);
        const w = 100;
        const dx = weeks.length > 1 ? w / (weeks.length - 1) : 0;
        const pts: [number, number][] = weeks.map((v, i) => [i * dx, height - 6 - (v / max) * (height - 16)]);
        const total = raw.slice(-28).reduce((a, b) => a + b, 0);

        return (
          <div key={f.key}>
            <div className="row" style={{ marginBottom: 3 }}>
              <span className="legend-swatch" style={{ background: FAMILY_VAR[f.key] }} />
              <span style={{ fontSize: 12, fontWeight: 550 }}>{f.label}</span>
              <span className="num dim" style={{ marginLeft: "auto", fontSize: 11.5 }}>
                {compact(total, lang)} · {lang === "es" ? "máx" : "peak"} {compact(max, lang)}/{lang === "es" ? "sem" : "wk"}
              </span>
            </div>
            <svg
              width="100%"
              height={height}
              viewBox={`0 0 ${w} ${height}`}
              preserveAspectRatio="none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const i = Math.max(0, Math.min(weeks.length - 1, Math.round(((e.clientX - rect.left) / rect.width) * (weeks.length - 1))));
                const d = new Date(startDate);
                d.setDate(d.getDate() + i * 7);
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  content: (
                    <>
                      <div className="tip-head">{shortDate(d.toISOString().slice(0, 10), lang)}</div>
                      <div className="tip-row">
                        <span className="swatch" style={{ background: FAMILY_VAR[f.key] }} />
                        <span className="k">{f.label}</span>
                        <span className="v">{n(weeks[i], lang)}</span>
                      </div>
                    </>
                  ),
                });
              }}
              onMouseLeave={() => setTip(null)}
            >
              <path
                d={`${linePath(pts)} L${w} ${height - 6} L0 ${height - 6} Z`}
                fill={FAMILY_VAR[f.key]}
                fillOpacity={0.2}
              />
              <path
                d={linePath(pts)}
                fill="none"
                stroke={FAMILY_VAR[f.key]}
                strokeWidth={2.2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
              <line x1={0} x2={w} y1={height - 6} y2={height - 6} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        );
      })}
      <Tooltip tip={tip} />
    </div>
  );
}
