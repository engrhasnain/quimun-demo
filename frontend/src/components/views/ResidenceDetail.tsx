"use client";

import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import { useSettings } from "@/components/Settings";
import {
  DivergingBars,
  FamilySmallMultiples,
  ForecastChart,
  StackedFamilyArea,
} from "@/components/charts";
import {
  Card,
  ChannelIcon,
  CopyButton,
  Delta,
  Icon,
  Meter,
  SeverityPill,
  StatusDot,
} from "@/components/ui";
import {
  FAMILY_VAR,
  STATUS_TONE,
  clp,
  compact,
  longDate,
  n,
  pct,
  probabilityLabel,
  shortDate,
  whatsappLink,
} from "@/lib/format";
import type { Meta, Pillar, ResidenceDetail as Detail, Signal } from "@/lib/types";

export default function ResidenceDetail({
  d,
  meta,
  peers,
}: {
  d: Detail;
  meta: Meta;
  peers: { band: string; peers: { slug: string; name: string; intensity: number; index: number; residents: number; is_self: boolean }[] };
}) {
  const { t, lang } = useSettings();
  const es = lang === "es";

  const planName = meta.plans.find((p) => p.key === d.plan);
  const bandName = meta.size_bands.find((b) => b.key === d.size_band);
  const families = meta.families.map((f) => ({
    key: f.key,
    label: es ? f.name_es : f.name_en,
  }));

  return (
    <>
      <PageHeader
        title={d.name}
        sub={`${d.comuna} · ${d.region_name} · ${es ? planName?.name_es : planName?.name_en} · ${n(d.residents, lang)} ${t.common.residents}`}
        actions={
          <>
            <Link href="/residencias" className="btn sm">
              {t.common.back}
            </Link>
            <a
              className="btn sm"
              href={whatsappLink(`${d.whatsapp_group}: `)}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="whatsapp" size={13} />
              WhatsApp
            </a>
            <span className="pill">{d.pipedrive_id}</span>
          </>
        }
      />

      <div className="content">
        {/* --- headline numbers ---------------------------------------- */}
        <div className="kpis">
          <div
            className="kpi"
            style={{ "--kpi-accent": "var(--brand)" } as React.CSSProperties}
          >
            <div className="kpi-label">{t.detail.indexTitle}</div>
            <div className="kpi-value">
              {n(d.index, lang, 1)}
              <small>/100</small>
            </div>
            <div className="kpi-foot">
              <StatusDot status={d.status} />
            </div>
          </div>
          <div
            className="kpi"
            style={{ "--kpi-accent": "var(--s-salud)" } as React.CSSProperties}
          >
            <div className="kpi-label">{t.residences.colTrend}</div>
            <div className="kpi-value">
              <Delta value={d.trend_pct} digits={1} />
            </div>
            <div className="kpi-foot muted">{t.common.vsPrev}</div>
          </div>
          <div
            className="kpi"
            style={{ "--kpi-accent": "var(--s-admin)" } as React.CSSProperties}
          >
            <div className="kpi-label">{t.residences.colEvents}</div>
            <div className="kpi-value">{compact(d.events_28, lang)}</div>
            <div className="kpi-foot muted">
              {n(d.intensity, lang, 1)} {t.common.perResidentWeek}
            </div>
          </div>
          <div
            className="kpi"
            style={{ "--kpi-accent": "var(--s-5)" } as React.CSSProperties}
          >
            <div className="kpi-label">{es ? "Percentil en su tramo" : "Percentile in size band"}</div>
            <div className="kpi-value">
              {n(d.band_percentile, lang)}
              <small>%</small>
            </div>
            <div className="kpi-foot muted">
              {es ? "mediana del tramo" : "band median"} {n(d.peer_median_intensity, lang, 1)}
            </div>
          </div>
          <div
            className="kpi"
            style={{ "--kpi-accent": "var(--s-hoteleria)" } as React.CSSProperties}
          >
            <div className="kpi-label">{t.residences.colSeats}</div>
            <div className="kpi-value">
              {d.active_users}
              <small>/{d.licensed_seats}</small>
            </div>
            <div className="kpi-foot muted">
              {d.modules_active}/{d.modules_contracted} {t.common.modules}
            </div>
          </div>
          <div
            className="kpi"
            style={{ "--kpi-accent": "var(--serious-solid)" } as React.CSSProperties}
          >
            <div className="kpi-label">{t.residences.colRenewal}</div>
            <div className="kpi-value">
              {n(d.days_to_renewal, lang)}
              <small>{es ? " días" : " days"}</small>
            </div>
            <div className="kpi-foot muted">{clp(d.mrr_clp, lang)} MRR</div>
          </div>
        </div>

        {/* --- signals + risk ------------------------------------------ */}
        <div className="split main-side">
          <Card
            title={t.detail.signalsTitle}
            note={t.detail.signalsNote}
            actions={
              d.signals.length > 0 ? (
                <Link href="/senales" className="btn sm">
                  {es ? "Ver pasos" : "See steps"}
                </Link>
              ) : null
            }
          >
            {d.signals.length === 0 ? (
              <div className="empty">{t.detail.noSignals}</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {d.signals.map((s) => (
                  <SignalCard key={s.id} s={s} />
                ))}
              </div>
            )}
          </Card>

          <div className="stack">
            {d.risk_full && (
              <Card title={t.detail.riskTitle} note={t.detail.riskNote}>
                <div className="row" style={{ gap: 12, marginBottom: 12 }}>
                  <div
                    className="num"
                    style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}
                  >
                    {probabilityLabel(d.risk_full.probability, lang)}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.4 }}>
                    {es
                      ? "de uso degradado dentro de 30 días"
                      : "chance of degraded usage within 30 days"}
                    <br />
                    <span className="dim">
                      {es ? "modelo" : "model"} {d.risk_full.model_version}
                    </span>
                  </div>
                </div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  {t.detail.pushesUp} / {t.detail.pushesDown}
                </div>
                <DivergingBars
                  items={d.risk_full.all_contributions
                    .slice(0, 7)
                    .map((c) => ({
                      label: es ? c.label_es : c.label_en,
                      value: c.contribution,
                      hint: `${es ? "valor" : "value"} ${c.raw} · z ${c.standardized} · coef ${c.coef}`,
                    }))}
                  labelWidth={158}
                />
              </Card>
            )}

            <Card title={t.detail.contractFacts}>
              <dl className="facts">
                <dt>{es ? "Razón social" : "Legal name"}</dt>
                <dd style={{ textAlign: "right" }}>{d.legal_name}</dd>
                <dt>RUT</dt>
                <dd className="mono">{d.rut}</dd>
                <dt>{es ? "Contacto" : "Contact"}</dt>
                <dd style={{ textAlign: "right" }}>
                  {d.contact_name}
                  <div className="dim" style={{ fontSize: 11 }}>{d.contact_role}</div>
                </dd>
                <dt>{es ? "Responsable" : "Owner"}</dt>
                <dd style={{ textAlign: "right" }}>{d.owner}</dd>
                <dt>{es ? "Tramo" : "Size band"}</dt>
                <dd>{es ? bandName?.name_es : bandName?.name_en}</dd>
                <dt>{es ? "Camas" : "Beds"}</dt>
                <dd>{n(d.beds, lang)}</dd>
                <dt>{es ? "Alta" : "Onboarded"}</dt>
                <dd>{longDate(d.onboarded_at, lang)}</dd>
                <dt>{t.residences.colRenewal}</dt>
                <dd>{longDate(d.renewal_at, lang)}</dd>
                <dt>{es ? "Tickets abiertos" : "Open tickets"}</dt>
                <dd>{d.open_tickets || "—"}</dd>
              </dl>
            </Card>
          </div>
        </div>

        {/* --- index breakdown ----------------------------------------- */}
        <Card title={t.detail.indexTitle} note={t.detail.indexNote}>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {d.score.pillars.map((p) => (
              <PillarRow key={p.key} p={p} />
            ))}
          </div>
        </Card>

        {/* --- activity ------------------------------------------------ */}
        <Card
          title={t.detail.activityTitle}
          note={t.detail.activityNote}
          actions={
            d.changepoint ? (
              <span className="pill serious" title={t.detail.changepointNote}>
                <span className="dot serious" aria-hidden />
                {t.detail.changepoint}: {shortDate(d.changepoint.day, lang)} ({n(d.changepoint.shift_pct, lang, 0)}%)
              </span>
            ) : null
          }
        >
          <div className="split main-side">
            <StackedFamilyArea
              series={d.series_family}
              start={d.series_start}
              families={families}
              height={240}
            />
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {es ? "Cada familia en su propia escala" : "Each family on its own scale"}
              </div>
              <FamilySmallMultiples
                series={d.series_family}
                start={d.series_start}
                families={families}
              />
            </div>
          </div>
        </Card>

        {/* --- forecast + peers ---------------------------------------- */}
        <div className="split c2">
          <Card
            title={t.detail.forecastTitle}
            note={t.detail.forecastNote}
            actions={
              d.forecast.available && d.forecast.change_pct !== undefined ? (
                <Delta value={d.forecast.change_pct} digits={1} />
              ) : null
            }
          >
            {d.forecast.available && d.forecast.history && d.forecast.projection ? (
              <ForecastChart history={d.forecast.history} projection={d.forecast.projection} />
            ) : (
              <div className="empty">{es ? "Historial insuficiente." : "Not enough history."}</div>
            )}
          </Card>

          <Card title={t.detail.peersTitle} note={t.detail.peersNote} flush>
            <div className="tablewrap" style={{ maxHeight: 292, overflowY: "auto" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.residences.colName}</th>
                    <th className="n">{t.residences.colResidents}</th>
                    <th className="n">{t.residences.colIntensity}</th>
                    <th className="n">{t.residences.colIndex}</th>
                  </tr>
                </thead>
                <tbody>
                  {peers.peers.map((p) => (
                    <tr
                      key={p.slug}
                      style={
                        p.is_self
                          ? { background: "var(--brand-wash)", fontWeight: 600 }
                          : undefined
                      }
                    >
                      <td className="truncate" style={{ maxWidth: 190 }}>
                        {p.is_self ? (
                          p.name
                        ) : (
                          <Link href={`/residencias/${p.slug}`} className="rowlink">
                            {p.name}
                          </Link>
                        )}
                      </td>
                      <td className="n">{n(p.residents, lang)}</td>
                      <td className="n">{n(p.intensity, lang, 1)}</td>
                      <td className="n">{n(p.index, lang, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* --- modules + team ------------------------------------------ */}
        <div className="split main-side">
          <Card title={t.detail.moduleTitle} note={t.detail.moduleNote} flush>
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.common.module}</th>
                    <th style={{ width: 108 }}>{t.common.state}</th>
                    <th className="n" style={{ width: 84 }}>{t.residences.colEvents}</th>
                    <th className="n" style={{ width: 84 }}>{es ? "Cambio" : "Change"}</th>
                    <th className="n" style={{ width: 96 }}>{es ? "Días activos" : "Active days"}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.modules.map((m) => (
                    <tr key={m.key}>
                      <td>
                        <div className="row" style={{ gap: 7 }}>
                          <span
                            style={{
                              width: 3,
                              height: 15,
                              borderRadius: 2,
                              background: FAMILY_VAR[m.family],
                              flex: "none",
                            }}
                          />
                          <span style={{ fontWeight: 550 }}>{es ? m.name_es : m.name_en}</span>
                          {m.compliance && (
                            <span className="tag" title={es ? "Evidencia de fiscalización" : "Inspection evidence"}>
                              {es ? "Fiscalización" : "Compliance"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td><ModuleState state={m.state} daysSilent={m.days_silent} /></td>
                      <td className="n">{n(m.events_28, lang)}</td>
                      <td className="n">
                        {m.events_prev || m.events_28 ? <Delta value={m.delta_pct} /> : <span className="dim">—</span>}
                      </td>
                      <td className="n">
                        <span className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                          <span>{m.active_days}/28</span>
                          <Meter value={m.active_days} max={28} tone="brand" width={38} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={t.detail.teamTitle} note={t.detail.teamNote} flush>
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{es ? "Usuario" : "User"}</th>
                    <th className="n" style={{ width: 108 }}>{t.common.events}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.users.length === 0 && (
                    <tr>
                      <td colSpan={2} className="empty">
                        {es ? "Ningún usuario registró actividad." : "No user recorded activity."}
                      </td>
                    </tr>
                  )}
                  {d.users.map((u) => {
                    const share = d.events_28 ? u.events / d.events_28 : 0;
                    const role = meta.roles.find((r) => r.key === u.role);
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 550 }}>{u.name}</div>
                          <div className="dim" style={{ fontSize: 11.5 }}>
                            {es ? role?.name_es : role?.name_en} · {es ? "último" : "last"}{" "}
                            {shortDate(u.last_seen, lang)}
                          </div>
                        </td>
                        <td className="n">
                          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                            <span style={{ fontWeight: 550 }}>{pct(share * 100, lang)}</span>
                            <Meter
                              value={share * 100}
                              tone={share > 0.65 ? "critical" : share > 0.5 ? "warning" : "brand"}
                              width={40}
                            />
                          </div>
                          <div className="dim num" style={{ fontSize: 11 }}>{n(u.events, lang)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* --- history ------------------------------------------------- */}
        <div className="split c2">
          <Card title={t.detail.interactionsTitle} flush>
            <div className="card-body">
              {d.interactions.length === 0 ? (
                <div className="empty">—</div>
              ) : (
                <div className="timeline">
                  {d.interactions.map((i, idx) => (
                    <div className="tl-item" key={`${i.day}-${idx}`}>
                      <span className="tl-date">{shortDate(i.day, lang)}</span>
                      <span>
                        <span className="row" style={{ gap: 6, marginBottom: 1 }}>
                          <ChannelIcon channel={i.channel} />
                          <span className="dim" style={{ fontSize: 11 }}>
                            {meta.channels.find((c) => c.key === i.channel)?.[es ? "name_es" : "name_en"] ?? i.channel}
                          </span>
                        </span>
                        <span style={{ color: "var(--ink-2)" }}>{es ? i.summary_es : i.summary_en}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title={t.detail.ticketsTitle} flush>
            <div className="card-body">
              {d.tickets.length === 0 ? (
                <div className="empty">—</div>
              ) : (
                <div className="timeline">
                  {d.tickets.map((tk, idx) => (
                    <div className="tl-item" key={`${tk.opened_at}-${idx}`}>
                      <span className="tl-date">{shortDate(tk.opened_at, lang)}</span>
                      <span>
                        <span style={{ color: "var(--ink-2)" }}>{es ? tk.subject_es : tk.subject_en}</span>
                        <span className="row" style={{ gap: 6, marginTop: 3 }}>
                          <span className={`pill ${tk.status === "abierto" ? "serious" : ""}`}>
                            {tk.status === "abierto" ? (es ? "Abierto" : "Open") : (es ? "Cerrado" : "Closed")}
                          </span>
                          {tk.module && (
                            <span className="tag">
                              {es
                                ? meta.modules.find((m) => m.key === tk.module)?.name_es
                                : meta.modules.find((m) => m.key === tk.module)?.name_en}
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- pieces */

function ModuleState({ state, daysSilent }: { state: string; daysSilent: number | null }) {
  const { t, lang } = useSettings();
  const es = lang === "es";
  if (state === "nunca") return <span className="pill">{t.common.never}</span>;
  if (state === "inactivo")
    return (
      <span className="pill serious">
        <span className="dot serious" aria-hidden />
        {daysSilent != null ? `${daysSilent} ${es ? "d sin uso" : "d silent"}` : t.common.inactive}
      </span>
    );
  if (state === "bajo")
    return (
      <span className="pill warning">
        <span className="dot warning" aria-hidden />
        {t.common.low}
      </span>
    );
  return (
    <span className="stat">
      <span className="dot good" aria-hidden />
      {t.common.active}
    </span>
  );
}

function PillarRow({ p }: { p: Pillar }) {
  const { t, lang } = useSettings();
  const es = lang === "es";
  const ev = p.evidence;

  const tone = p.value >= 75 ? "good" : p.value >= 55 ? "warning" : p.value >= 40 ? "serious" : "critical";

  let line = "";
  if (p.key === "intensity") {
    line = es
      ? `${n(ev.events_per_resident_week, lang, 1)} ${t.common.perResidentWeek} · percentil ${ev.band_percentile} entre ${ev.peers} pares de su tamaño`
      : `${n(ev.events_per_resident_week, lang, 1)} ${t.common.perResidentWeek} · ${ev.band_percentile}th percentile among ${ev.peers} same-size peers`;
  } else if (p.key === "breadth") {
    line = es
      ? `${ev.modules_active} de ${ev.modules_contracted} módulos contratados en uso`
      : `${ev.modules_active} of ${ev.modules_contracted} contracted modules in use`;
  } else if (p.key === "coverage") {
    line = es
      ? `${ev.active_users} de ${ev.licensed_seats} licencias activas · ${ev.top_user_share}% concentrado en ${String(ev.top_user).split(" ")[0]}`
      : `${ev.active_users} of ${ev.licensed_seats} licences active · ${ev.top_user_share}% concentrated in ${String(ev.top_user).split(" ")[0]}`;
  } else {
    line = es
      ? `${ev.active_days} de ${ev.window} días con actividad · ${ev.daily_module_rate}% de cumplimiento diario${ev.clinical_gap_days ? ` · ${ev.clinical_gap_days} días sin registro clínico` : ""}`
      : `${ev.active_days} of ${ev.window} days active · ${ev.daily_module_rate}% daily adherence${ev.clinical_gap_days ? ` · ${ev.clinical_gap_days} days without clinical recording` : ""}`;
  }

  const meta = t.pillars[p.key];

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div className="row">
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{meta}</span>
        <span className="tag">{Math.round(p.weight * 100)}%</span>
        <span className="num" style={{ marginLeft: "auto", fontWeight: 600, fontSize: 15 }}>
          {n(p.value, lang, 1)}
        </span>
      </div>
      <Meter value={p.value} tone={tone as any} width="100%" />
      <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>{line}</div>
      {p.key === "breadth" && Array.isArray(ev.never_used) && ev.never_used.length > 0 && (
        <div className="wrap" style={{ gap: 5 }}>
          {(ev.never_used as string[]).map((m) => (
            <span className="tag" key={m}>
              {t.common.never}: {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalCard({ s }: { s: Signal }) {
  const { t, lang } = useSettings();
  const es = lang === "es";
  const pb = s.playbook;
  const draft = es ? pb.draft_es : pb.draft_en;

  // Deliberately a summary. The full playbook - objective, steps, expected
  // outcome - lives on the Señales page. Repeating all of it here, five times
  // over for an account with five signals, buries the one thing you act on.
  return (
    <article
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        background: "var(--surface-2)",
      }}
    >
      <div style={{ padding: "10px 12px", background: "var(--surface)", borderBottom: "1px solid var(--line-2)" }}>
        <div className="row" style={{ gap: 8, marginBottom: 3 }}>
          <SeverityPill severity={s.severity} />
          <span style={{ fontWeight: 600, fontSize: 12.5 }}>{es ? s.title_es : s.title_en}</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
          {es ? s.detail_es : s.detail_en}
        </p>
      </div>

      <div style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
        <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 12.5 }}>{es ? pb.title_es : pb.title_en}</span>
          <span className="pill brand">
            <ChannelIcon channel={pb.channel} />
            {t.channel[pb.channel as keyof typeof t.channel] ?? pb.channel}
          </span>
          <span className="tag">{pb.sla_days} {t.common.days}</span>
          <span className="card-actions">
            <CopyButton text={draft} />
            <a className="btn sm" href={whatsappLink(draft)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={12} />
              {t.common.openWhatsapp}
            </a>
          </span>
        </div>
        <div className="draft">{draft}</div>
      </div>
    </article>
  );
}
