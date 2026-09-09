"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import PageHeader from "@/components/PageHeader";
import { useSettings } from "@/components/Settings";
import { ChannelIcon, CopyButton, Icon, SeverityPill } from "@/components/ui";
import { clpCompact, n, shortDate, whatsappLink } from "@/lib/format";
import type { Meta, Severity, Signal } from "@/lib/types";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const SEVERITY_ORDER: Severity[] = ["critica", "alta", "media", "baja", "oportunidad"];

export default function Signals({ items, meta }: { items: Signal[]; meta: Meta }) {
  const { t, lang } = useSettings();
  const es = lang === "es";
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [owner, setOwner] = useState("");
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null);
  const [saving, setSaving] = useState<string | null>(null);

  const types = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of items) seen.set(s.key, es ? s.title_es : s.title_en);
    return [...seen.entries()];
  }, [items, es]);

  const owners = useMemo(
    () => [...new Set(items.map((s) => s.owner))].sort(),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((s) => {
        if (severity && s.severity !== severity) return false;
        if (type && s.key !== type) return false;
        if (owner && s.owner !== owner) return false;
        return true;
      }),
    [items, severity, type, owner],
  );

  const active = filtered.find((s) => s.id === selected) ?? filtered[0] ?? null;

  async function triage(s: Signal, status: string) {
    setSaving(s.id);
    try {
      await fetch(`${API}/api/signals/triage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          residence_slug: s.residence_slug,
          signal_key: s.key,
          module: s.module,
          status,
        }),
      });
      startTransition(() => router.refresh());
    } catch {
      /* the row simply stays as-is */
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader
        title={t.signals.title}
        sub={t.signals.sub}
        actions={
          <span className="muted num" style={{ fontSize: 12 }}>
            {n(filtered.length, lang)} {t.signals.total}
          </span>
        }
      />

      <div className="content">
        <div className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 8 }}>
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">{t.signals.allSeverities}</option>
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>{t.severity[s]}</option>
              ))}
            </select>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 240 }}>
              <option value="">{t.signals.allTypes}</option>
              {types.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">{t.residences.colOwner}: {t.common.all}</option>
              {owners.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            {(severity || type || owner) && (
              <button
                className="btn ghost sm"
                onClick={() => { setSeverity(""); setType(""); setOwner(""); }}
              >
                {t.common.clear}
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty">{t.signals.empty}</div>
          </div>
        ) : (
          <div className="split side-main">
            {/* queue */}
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="card-head">
                <h2 className="card-title">{t.overview.queueTitle}</h2>
              </div>
              <div style={{ maxHeight: 720, overflowY: "auto" }}>
                {filtered.map((s) => {
                  const isActive = active?.id === s.id;
                  const resolved = s.triage?.status === "resuelta";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelected(s.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 13px",
                        border: 0,
                        borderBottom: "1px solid var(--line-2)",
                        borderLeft: `2px solid ${isActive ? "var(--brand)" : "transparent"}`,
                        background: isActive ? "var(--brand-wash)" : "transparent",
                        cursor: "pointer",
                        opacity: resolved ? 0.55 : 1,
                      }}
                    >
                      <div className="row" style={{ gap: 7, marginBottom: 3 }}>
                        <SeverityPill severity={s.severity} />
                        <span className="num dim" style={{ marginLeft: "auto", fontSize: 11 }}>
                          {n(s.priority, lang)}
                        </span>
                      </div>
                      <div className="truncate" style={{ fontWeight: 600, fontSize: 12.5 }}>
                        {s.residence_name}
                      </div>
                      <div className="truncate" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {es ? s.title_es : s.title_en}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* detail */}
            {active && (
              <div className="card">
                <div className="card-head" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                      <SeverityPill severity={active.severity} />
                      <Link href={`/residencias/${active.residence_slug}`} className="rowlink" style={{ fontWeight: 600 }}>
                        {active.residence_name}
                      </Link>
                      <span className="tag">{clpCompact(active.mrr_clp, lang)} MRR</span>
                      <span className="tag">{active.owner}</span>
                    </div>
                    <h2 className="card-title">{es ? active.title_es : active.title_en}</h2>
                    <p className="card-note">{es ? active.detail_es : active.detail_en}</p>
                  </div>
                  <div className="card-actions">
                    <Link href={`/residencias/${active.residence_slug}`} className="btn sm">
                      {es ? "Ver ficha" : "Open record"}
                      <Icon name="arrow" size={12} />
                    </Link>
                  </div>
                </div>

                <div className="card-body stack">
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="eyebrow">{t.detail.playbook}</span>
                    <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                      {es ? active.playbook.title_es : active.playbook.title_en}
                    </span>
                    <span className="pill brand">
                      <ChannelIcon channel={active.playbook.channel} />
                      {t.channel[active.playbook.channel as keyof typeof t.channel] ?? active.playbook.channel}
                    </span>
                    <span className="tag">
                      {t.team[active.playbook.owner as keyof typeof t.team] ?? active.playbook.owner}
                    </span>
                    <span className="tag">
                      {t.detail.sla}: {active.playbook.sla_days} {t.common.days}
                    </span>
                    <span className="tag">
                      {es ? "Detectada" : "Detected"} {shortDate(active.detected_on, lang)}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>
                    {es ? active.playbook.objective_es : active.playbook.objective_en}
                  </p>

                  <div>
                    <div className="eyebrow" style={{ marginBottom: 5 }}>{t.detail.steps}</div>
                    <ol className="steps">
                      {(es ? active.playbook.steps_es : active.playbook.steps_en).map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <div className="row" style={{ marginBottom: 5 }}>
                      <span className="eyebrow">{t.detail.draft}</span>
                      <span className="card-actions">
                        <CopyButton text={es ? active.playbook.draft_es : active.playbook.draft_en} />
                        <a
                          className="btn sm"
                          href={whatsappLink(es ? active.playbook.draft_es : active.playbook.draft_en)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Icon name="whatsapp" size={12} />
                          {t.common.openWhatsapp}
                        </a>
                      </span>
                    </div>
                    <div className="draft">
                      {es ? active.playbook.draft_es : active.playbook.draft_en}
                    </div>
                  </div>

                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                    <span className="eyebrow">{t.detail.expected}</span>{" "}
                    {es ? active.playbook.expected_es : active.playbook.expected_en}
                  </div>

                  <hr className="hr" />

                  <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                    <span className="eyebrow">{es ? "Triaje" : "Triage"}</span>
                    {[
                      { k: "abierta", es: "Abierta", en: "Open" },
                      { k: "en_curso", es: "En curso", en: "In progress" },
                      { k: "resuelta", es: "Resuelta", en: "Resolved" },
                      { k: "descartada", es: "Descartada", en: "Dismissed" },
                    ].map((o) => (
                      <button
                        key={o.k}
                        type="button"
                        className="btn sm"
                        aria-pressed={(active.triage?.status ?? "abierta") === o.k}
                        disabled={saving === active.id || pending}
                        onClick={() => triage(active, o.k)}
                      >
                        {es ? o.es : o.en}
                      </button>
                    ))}
                    {active.triage?.updated_at && (
                      <span className="dim" style={{ fontSize: 11 }}>
                        {es ? "actualizado" : "updated"}{" "}
                        {shortDate(active.triage.updated_at.slice(0, 10), lang)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
