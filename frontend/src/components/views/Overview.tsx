"use client";

import Link from "next/link";
import { useState } from "react";

import PageHeader from "@/components/PageHeader";
import { useSettings } from "@/components/Settings";
import { BarList, StatusRibbon, TrendArea } from "@/components/charts";
import { Card, Delta, Icon, Kpi, ResidenceLink, Segmented, SeverityPill, StatusDot } from "@/components/ui";
import {
  FAMILY_VAR,
  STATUS_TONE,
  clpCompact,
  compact,
  n,
  pct,
  probabilityLabel,
} from "@/lib/format";
import type { PortfolioSummary, Signal, Status } from "@/lib/types";

const STATUS_ORDER: Status[] = ["saludable", "observacion", "en_riesgo", "critico"];

const TONE_VAR: Record<string, string> = {
  good: "var(--good)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--critical)",
};

export default function Overview({
  data,
  queue,
}: {
  data: PortfolioSummary;
  queue: Signal[];
}) {
  const { t, lang } = useSettings();
  const es = lang === "es";
  const [movers, setMovers] = useState<"down" | "up">("down");

  const seatPct = data.licensed_seats
    ? (data.active_users / data.licensed_seats) * 100
    : 0;

  const statusLabels = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, t.status[s]]),
  ) as Record<string, string>;
  const statusTones = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, TONE_VAR[STATUS_TONE[s]]]),
  ) as Record<string, string>;

  return (
    <>
      <PageHeader
        title={t.overview.title}
        sub={t.overview.sub}
        actions={
          <Link href="/senales" className="btn primary">
            {t.nav.signals}
            <Icon name="arrow" size={13} />
          </Link>
        }
      />

      <div className="content">
        {/* --- KPI row ------------------------------------------------ */}
        <div className="kpis">
          <Kpi
            label={t.overview.kpiResidences}
            accent="var(--brand)"
            value={n(data.residences, lang)}
            foot={
              <span className="muted">
                {n(data.residents, lang)} {t.common.residents} · {n(data.beds, lang)}{" "}
                {t.common.beds}
              </span>
            }
          />
          <Kpi
            label={t.overview.kpiIndex}
            accent="var(--s-salud)"
            value={n(data.avg_index, lang, 1)}
            unit="/100"
            foot={
              <span className="muted">
                {es ? "mediana" : "median"} {n(data.median_index, lang, 1)}
              </span>
            }
          />
          <Kpi
            label={t.overview.kpiActivity}
            accent="var(--s-admin)"
            value={compact(data.events_28, lang)}
            foot={
              <>
                <Delta value={data.events_trend_pct} digits={1} />
                <span className="muted">{t.common.vsPrev}</span>
              </>
            }
          />
          <Kpi
            label={t.overview.kpiAttention}
            accent="var(--serious-solid)"
            value={n(data.attention_count, lang)}
            foot={
              <span className="muted">
                +{n(data.watch_count, lang)} {es ? "en observación" : "on watch"}
              </span>
            }
          />
          <Kpi
            label={t.overview.kpiSeats}
            accent="var(--s-5)"
            value={pct(seatPct, lang)}
            foot={
              <span className="muted">
                {n(data.active_users, lang)} / {n(data.licensed_seats, lang)}
              </span>
            }
          />
          <Kpi
            label={t.overview.kpiMrrRisk}
            accent="var(--critical-solid)"
            value={clpCompact(data.mrr_at_risk_clp, lang)}
            foot={
              <span className="muted">
                {es ? "de" : "of"} {clpCompact(data.mrr_clp, lang)} MRR
              </span>
            }
          />
        </div>

        {/* --- activity + distribution -------------------------------- */}
        <div className="split main-side">
          <Card title={t.overview.activityTitle} note={t.overview.activityNote}>
            <TrendArea
              data={data.weekly_activity}
              label={es ? "Eventos" : "Events"}
              color="var(--s-salud)"
              baseline="fit"
            />
          </Card>

          <Card title={t.overview.distributionTitle} note={t.overview.distributionNote}>
            <StatusRibbon
              counts={data.status_counts as Record<string, number>}
              order={STATUS_ORDER}
              labels={statusLabels}
              tones={statusTones}
            />
          </Card>
        </div>

        {/* --- early warning + attention queue ------------------------ */}
        <div className="split main-side">
          <Card
            title={t.overview.queueTitle}
            note={t.overview.queueNote}
            actions={
              <Link href="/senales" className="btn sm">
                {t.common.viewAll}
              </Link>
            }
            flush
          >
            {queue.length === 0 ? (
              <div className="empty">{t.signals.empty}</div>
            ) : (
              <div className="tablewrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.residences.colName}</th>
                      <th>{es ? "Señal" : "Signal"}</th>
                      <th style={{ width: 110 }}>{es ? "Severidad" : "Severity"}</th>
                      <th className="n" style={{ width: 88 }}>
                        {t.signals.priority}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.slice(0, 8).map((s) => (
                      <tr key={s.id}>
                        <td style={{ maxWidth: 220 }}>
                          <ResidenceLink slug={s.residence_slug} name={s.residence_name} />
                        </td>
                        <td style={{ maxWidth: 300 }}>
                          <div className="truncate">{es ? s.title_es : s.title_en}</div>
                          <div className="truncate dim" style={{ fontSize: 11.5 }}>
                            {es ? s.playbook.title_es : s.playbook.title_en}
                          </div>
                        </td>
                        <td>
                          <SeverityPill severity={s.severity} />
                        </td>
                        <td className="n" style={{ fontWeight: 600 }}>
                          {n(s.priority, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={t.overview.earlyTitle} note={t.overview.earlyNote}>
            {data.early_warning.length === 0 ? (
              <div className="empty">{t.overview.noEarly}</div>
            ) : (
              <div className="stack">
                {data.early_warning.map((e) => (
                  <div
                    key={e.slug}
                    style={{
                      display: "grid",
                      gap: 3,
                      paddingBottom: 9,
                      borderBottom: "1px solid var(--line-2)",
                    }}
                  >
                    <div className="row">
                      <ResidenceLink slug={e.slug} name={e.name} />
                      <span
                        className="num"
                        style={{ marginLeft: "auto", fontWeight: 600, color: "var(--critical)" }}
                      >
                        {probabilityLabel(e.probability, lang)}
                      </span>
                    </div>
                    <div className="row dim" style={{ fontSize: 11.5, gap: 6 }}>
                      <span>
                        {es ? "Índice" : "Index"} {n(e.index, lang, 1)}
                      </span>
                      <span>·</span>
                      <span className="truncate">{es ? e.driver_es : e.driver_en}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* --- movers -------------------------------------------------- */}
        <div className="split main-side">
          <Card
            title={movers === "down" ? t.overview.decliners : t.overview.risers}
            note={t.overview.declinersNote}
            actions={
              <Segmented
                value={movers}
                onChange={setMovers}
                options={[
                  { value: "down", label: es ? "Caídas" : "Declines" },
                  { value: "up", label: es ? "Alzas" : "Gains" },
                ]}
              />
            }
            flush
          >
            <MoversTable rows={movers === "down" ? data.decliners : data.risers} />
          </Card>

          <Card title={t.overview.regionTitle} flush>
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{es ? "Región" : "Region"}</th>
                    <th className="n">{es ? "Resid." : "Resid."}</th>
                    <th className="n">{es ? "Índice" : "Index"}</th>
                    <th className="n">{es ? "Atención" : "Attention"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.regions.map((r) => (
                    <tr key={r.key}>
                      <td className="truncate" style={{ maxWidth: 160 }}>{r.name}</td>
                      <td className="n">{n(r.residences, lang)}</td>
                      <td className="n">{n(r.avg_index, lang, 1)}</td>
                      <td className="n">
                        {r.attention > 0 ? (
                          <span style={{ color: "var(--serious)", fontWeight: 600 }}>
                            {n(r.attention, lang)}
                          </span>
                        ) : (
                          <span className="dim">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* --- adoption ------------------------------------------------ */}
        <Card
          title={t.overview.adoptionTitle}
          note={t.overview.adoptionNote}
          actions={
            <Link href="/modulos" className="btn sm">
              {t.common.viewAll}
            </Link>
          }
        >
          <BarList
            items={data.modules
              .slice()
              .sort((a, b) => b.adoption_pct - a.adoption_pct)
              .map((m) => ({
                label: es ? m.name_es : m.name_en,
                value: m.adoption_pct,
                color: FAMILY_VAR[m.family],
              }))}
            format={(v) => pct(v, lang)}
            color="var(--s-salud)"
            labelWidth={172}
          />
          <div className="legend" style={{ marginTop: 12 }}>
            {[
              ["salud", es ? "Salud" : "Health"],
              ["hoteleria", es ? "Hotelería" : "Hospitality"],
              ["administracion", es ? "Administración" : "Administration"],
            ].map(([k, label]) => (
              <span className="legend-item" key={k}>
                <span className="legend-swatch" style={{ background: FAMILY_VAR[k] }} />
                {label}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function MoversTable({
  rows,
}: {
  rows: { slug: string; name: string; trend_pct: number; index: number; status: Status; events_28: number }[];
}) {
  const { t, lang } = useSettings();
  return (
    <div className="tablewrap">
      <table className="data">
        <thead>
          <tr>
            <th>{t.residences.colName}</th>
            <th style={{ width: 120 }}>{t.common.state}</th>
            <th className="n" style={{ width: 78 }}>
              {t.residences.colEvents}
            </th>
            <th className="n" style={{ width: 86 }}>
              {t.residences.colTrend}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug}>
              <td style={{ maxWidth: 210 }}>
                <ResidenceLink slug={r.slug} name={r.name} />
              </td>
              <td>
                <StatusDot status={r.status} />
              </td>
              <td className="n">{compact(r.events_28, lang)}</td>
              <td className="n">
                <Delta value={r.trend_pct} digits={1} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
