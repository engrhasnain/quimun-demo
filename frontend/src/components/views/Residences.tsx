"use client";

import { useMemo, useState } from "react";

import PageHeader from "@/components/PageHeader";
import { useSettings } from "@/components/Settings";
import { Sparkline } from "@/components/charts";
import { Delta, IndexCell, ResidenceLink, RiskPill, StatusDot } from "@/components/ui";
import { STATUS_TONE, compact, n } from "@/lib/format";
import type { Meta, ResidenceRow, Status } from "@/lib/types";

type SortKey =
  | "name" | "index" | "trend_pct" | "events_28" | "intensity"
  | "active_users" | "modules_active" | "risk" | "days_to_renewal" | "signal_count";

const TONE_VAR: Record<string, string> = {
  good: "var(--good)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--critical)",
};

export default function Residences({
  rows,
  meta,
}: {
  rows: ResidenceRow[];
  meta: Meta;
}) {
  const { t, lang } = useSettings();
  const es = lang === "es";

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [plan, setPlan] = useState<string>("");
  const [band, setBand] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("index");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (needle && !(`${r.name} ${r.comuna} ${r.region_name}`.toLowerCase().includes(needle)))
        return false;
      if (status && r.status !== status) return false;
      if (region && r.region !== region) return false;
      if (plan && r.plan !== plan) return false;
      if (band && r.size_band !== band) return false;
      return true;
    });

    const get = (r: ResidenceRow): number | string => {
      switch (sort) {
        case "name": return r.name.toLowerCase();
        case "risk": return r.risk?.probability ?? -1;
        default: return (r as any)[sort] ?? 0;
      }
    };

    out = [...out].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, q, status, region, plan, band, sort, dir]);

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      // Names read naturally A→Z; every metric is more useful worst-first.
      setDir(k === "name" ? "asc" : k === "index" || k === "trend_pct" || k === "days_to_renewal" ? "asc" : "desc");
    }
  };

  const th = (k: SortKey, label: string, numeric = false, width?: number) => (
    <th
      className={`sortable ${numeric ? "n" : ""}`}
      onClick={() => toggleSort(k)}
      style={width ? { width } : undefined}
      aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      {sort === k && <span style={{ marginLeft: 4 }}>{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );

  const clearAll = () => {
    setQ(""); setStatus(""); setRegion(""); setPlan(""); setBand("");
  };
  const anyFilter = q || status || region || plan || band;

  return (
    <>
      <PageHeader
        title={t.residences.title}
        sub={t.residences.sub}
        actions={
          <span className="muted num" style={{ fontSize: 12 }}>
            {t.common.showing} {n(filtered.length, lang)} {t.common.of} {n(rows.length, lang)}
          </span>
        }
      />

      <div className="content">
        <div className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 8 }}>
            <input
              className="input"
              placeholder={t.common.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 230, flex: "0 1 260px" }}
            />
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t.common.state}: {t.common.all}</option>
              {meta.statuses.map((s) => (
                <option key={s.key} value={s.key}>{es ? s.name_es : s.name_en}</option>
              ))}
            </select>
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">{es ? "Región" : "Region"}: {t.common.all}</option>
              {meta.regions.map((r) => (
                <option key={r.key} value={r.key}>{r.name}</option>
              ))}
            </select>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">{t.residences.colPlan}: {t.common.allM}</option>
              {meta.plans.map((p) => (
                <option key={p.key} value={p.key}>{es ? p.name_es : p.name_en}</option>
              ))}
            </select>
            <select className="input" value={band} onChange={(e) => setBand(e.target.value)}>
              <option value="">{t.residences.colSize}: {t.common.allM}</option>
              {meta.size_bands.map((b) => (
                <option key={b.key} value={b.key}>{es ? b.name_es : b.name_en}</option>
              ))}
            </select>
            {anyFilter && (
              <button className="btn ghost sm" onClick={clearAll}>
                {t.common.clear}
              </button>
            )}
          </div>

          <div className="card-body-flush">
            {filtered.length === 0 ? (
              <div className="empty">{t.common.noResults}</div>
            ) : (
              <div className="tablewrap">
                <table className="data">
                  <thead>
                    <tr>
                      {th("name", t.residences.colName)}
                      <th>{t.common.state}</th>
                      {th("index", t.residences.colIndex, true, 108)}
                      {th("trend_pct", t.residences.colTrend, true, 92)}
                      <th style={{ width: 92 }}>{t.residences.colActivity}</th>
                      {th("events_28", t.residences.colEvents, true, 86)}
                      {th("intensity", t.residences.colIntensity, true, 92)}
                      {th("active_users", t.residences.colSeats, true, 84)}
                      {th("modules_active", t.residences.colModules, true, 80)}
                      {th("risk", t.residences.colRisk, true, 108)}
                      {th("signal_count", t.residences.colSignals, true, 78)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.slug}>
                        <td style={{ minWidth: 230 }}>
                          <ResidenceLink slug={r.slug} name={r.name} />
                          <div className="dim" style={{ fontSize: 11.5 }}>
                            {r.comuna} · {es
                              ? meta.plans.find((p) => p.key === r.plan)?.name_es
                              : meta.plans.find((p) => p.key === r.plan)?.name_en}{" "}
                            · {n(r.residents, lang)} {t.common.residents}
                          </div>
                        </td>
                        <td><StatusDot status={r.status} /></td>
                        <td className="n"><IndexCell value={r.index} status={r.status} /></td>
                        <td className="n"><Delta value={r.trend_pct} /></td>
                        <td>
                          <Sparkline
                            values={r.sparkline}
                            tone={TONE_VAR[STATUS_TONE[r.status as Status]]}
                          />
                        </td>
                        <td className="n">{compact(r.events_28, lang)}</td>
                        <td className="n" title={t.common.perResidentWeek}>
                          {n(r.intensity, lang, 1)}
                        </td>
                        <td className="n">
                          <span style={{ fontWeight: 550 }}>{r.active_users}</span>
                          <span className="dim">/{r.licensed_seats}</span>
                        </td>
                        <td className="n">
                          <span style={{ fontWeight: 550 }}>{r.modules_active}</span>
                          <span className="dim">/{r.modules_contracted}</span>
                        </td>
                        <td className="n">
                          {r.risk ? (
                            <RiskPill band={r.risk.band} probability={r.risk.probability} />
                          ) : (
                            <span className="dim">—</span>
                          )}
                        </td>
                        <td className="n">
                          {r.signal_count > 0 ? (
                            <span style={{ fontWeight: 600 }}>{r.signal_count}</span>
                          ) : (
                            <span className="dim">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
