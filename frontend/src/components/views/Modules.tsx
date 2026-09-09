"use client";

import { useMemo, useState } from "react";

import PageHeader from "@/components/PageHeader";
import { useSettings } from "@/components/Settings";
import { BarList, HeatMatrix } from "@/components/charts";
import { Card, Delta, StatusDot } from "@/components/ui";
import { FAMILY_VAR, SEQ, compact, n, pct } from "@/lib/format";
import type { Adoption, PortfolioSummary } from "@/lib/types";

export default function Modules({
  data,
  summary,
}: {
  data: Adoption;
  summary: PortfolioSummary;
}) {
  const { t, lang } = useSettings();
  const es = lang === "es";
  const [family, setFamily] = useState("");

  const columns = useMemo(
    () =>
      data.modules
        .filter((m) => !family || m.family === family)
        .map((m) => ({ key: m.key, label: es ? m.name_es : m.name_en })),
    [data.modules, family, es],
  );

  const rows = useMemo(
    () =>
      data.matrix.map((r) => ({
        key: r.slug,
        label: r.name,
        meta: (
          <span className="dim" style={{ fontSize: 11 }}>
            {n(r.residents, lang)} {t.common.residents} · {es ? "índice" : "index"} {n(r.index, lang, 1)}
          </span>
        ),
      })),
    [data.matrix, lang, es, t],
  );

  const byRow = useMemo(
    () => Object.fromEntries(data.matrix.map((r) => [r.slug, r])),
    [data.matrix],
  );
  const byModule = useMemo(
    () => Object.fromEntries(data.modules.map((m) => [m.key, m])),
    [data.modules],
  );

  return (
    <>
      <PageHeader title={t.modules.title} sub={t.modules.sub} />

      <div className="content">
        <div className="split c3">
          {data.families.map((f) => (
            <Card key={f.key} title={es ? f.name_es : f.name_en} note={es ? f.desc_es : f.desc_en}>
              <div className="row" style={{ gap: 10 }}>
                <span
                  style={{ width: 4, height: 30, borderRadius: 2, background: FAMILY_VAR[f.key] }}
                />
                <div>
                  <div className="num" style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em" }}>
                    {compact(f.events_28, lang)}
                  </div>
                  <div className="dim" style={{ fontSize: 11 }}>{t.common.window28}</div>
                </div>
                <span style={{ marginLeft: "auto" }}>
                  <Delta value={f.delta_pct} digits={1} />
                </span>
              </div>
            </Card>
          ))}
        </div>

        <div className="split c2">
          <Card title={t.overview.adoptionTitle} note={t.overview.adoptionNote}>
            <BarList
              items={summary.modules
                .slice()
                .sort((a, b) => b.adoption_pct - a.adoption_pct)
                .map((m) => ({
                  label: es ? m.name_es : m.name_en,
                  value: m.adoption_pct,
                  color: FAMILY_VAR[m.family],
                }))}
              format={(v) => pct(v, lang)}
              labelWidth={176}
            />
          </Card>

          <Card
            title={es ? "Volumen por módulo" : "Volume by module"}
            note={es ? "Eventos en 28 días, con variación respecto al período anterior." : "Events over 28 days, with change against the previous period."}
            flush
          >
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.common.module}</th>
                    <th className="n">{t.common.events}</th>
                    <th className="n">{es ? "Cambio" : "Change"}</th>
                    <th className="n">{es ? "Nunca usado" : "Never used"}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.modules.map((m) => (
                    <tr key={m.key}>
                      <td>
                        <div className="row" style={{ gap: 7 }}>
                          <span
                            style={{ width: 3, height: 14, borderRadius: 2, background: FAMILY_VAR[m.family] }}
                          />
                          {es ? m.name_es : m.name_en}
                          {m.compliance && (
                            <span className="tag">{es ? "Fiscalización" : "Compliance"}</span>
                          )}
                        </div>
                      </td>
                      <td className="n">{compact(m.events_28, lang)}</td>
                      <td className="n"><Delta value={m.delta_pct} digits={1} /></td>
                      <td className="n">
                        {m.never > 0 ? (
                          <span style={{ color: "var(--serious)", fontWeight: 600 }}>{m.never}</span>
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

        <Card
          title={t.modules.matrixTitle}
          note={t.modules.matrixNote}
          actions={
            <select className="input" value={family} onChange={(e) => setFamily(e.target.value)}>
              <option value="">{t.modules.familyTitle}: {t.common.allM}</option>
              {data.families.map((f) => (
                <option key={f.key} value={f.key}>{es ? f.name_es : f.name_en}</option>
              ))}
            </select>
          }
          flush
        >
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: "var(--surface-3)", border: "1px solid var(--line)" }} />
                {t.modules.legendNever} / {t.modules.legendInactive}
              </span>
              <span className="legend-item" style={{ gap: 3 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{t.modules.legendLow}</span>
                {SEQ.map((c) => (
                  <span key={c} className="legend-swatch" style={{ background: c, borderRadius: 1 }} />
                ))}
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{t.modules.legendHigh}</span>
              </span>
            </div>
          </div>
          <div style={{ maxHeight: 620, overflowY: "auto" }}>
            <HeatMatrix
              rows={rows}
              columns={columns}
              rowLabel={t.residences.colName}
              rowHref={(slug) => `/residencias/${slug}`}
              cellFor={(rowKey, colKey) => {
                const cell = byRow[rowKey]?.cells.find((c) => c.module === colKey);
                return cell
                  ? { state: cell.state, value: cell.value, events: cell.events }
                  : { state: "no_contratado", value: null };
              }}
              onCellTip={(rowKey, colKey) => {
                const r = byRow[rowKey];
                const cell = r?.cells.find((c) => c.module === colKey);
                const m = byModule[colKey];
                const stateLabel =
                  cell?.state === "no_contratado"
                    ? t.common.notContracted
                    : cell?.state === "nunca"
                      ? t.common.never
                      : cell?.state === "inactivo"
                        ? t.common.inactive
                        : t.common.active;
                return (
                  <>
                    <div className="tip-head">{r?.name}</div>
                    <div className="tip-row">
                      <span
                        className="swatch"
                        style={{ background: FAMILY_VAR[m?.family ?? "salud"] }}
                      />
                      <span className="k">{es ? m?.name_es : m?.name_en}</span>
                    </div>
                    <div className="tip-row">
                      <span className="k" style={{ marginLeft: 15 }}>{t.common.state}</span>
                      <span className="v">{stateLabel}</span>
                    </div>
                    {cell?.events !== undefined && (
                      <div className="tip-row">
                        <span className="k" style={{ marginLeft: 15 }}>{t.common.events}</span>
                        <span className="v">{n(cell.events, lang)}</span>
                      </div>
                    )}
                  </>
                );
              }}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
