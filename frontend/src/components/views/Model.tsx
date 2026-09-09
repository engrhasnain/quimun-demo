"use client";

import PageHeader from "@/components/PageHeader";
import { useSettings } from "@/components/Settings";
import { BarList, CalibrationChart, DivergingBars, RocChart } from "@/components/charts";
import { Card, Kpi } from "@/components/ui";
import { n, pct } from "@/lib/format";
import type { ModelCard } from "@/lib/types";

export default function Model({ card }: { card: ModelCard }) {
  const { t, lang } = useSettings();
  const es = lang === "es";

  if (!card.available) {
    return (
      <>
        <PageHeader title={t.model.title} sub={t.model.sub} />
        <div className="content">
          <Card>
            <div className="empty">{card.reason ?? t.model.unavailable}</div>
          </Card>
        </div>
      </>
    );
  }

  const m = card.metrics ?? {};
  const c = card.confusion ?? { tp: 0, fp: 0, fn: 0, tn: 0 };
  const tr = card.training ?? {};

  return (
    <>
      <PageHeader
        title={t.model.title}
        sub={t.model.sub}
        actions={<span className="pill brand">v{card.version}</span>}
      />

      <div className="content">
        <div className="kpis">
          <Kpi label={t.model.auc} value={n(m.auc ?? 0, lang, 3)} foot={<span className="muted">{es ? "fuera de muestra" : "held-out"}</span>} />
          <Kpi label={t.model.ap} value={n(m.average_precision ?? 0, lang, 3)} foot={<span className="muted">{t.model.baseRate} {n((m.base_rate ?? 0) * 100, lang, 1)}%</span>} />
          <Kpi label={t.model.precision} value={pct((m.precision ?? 0) * 100, lang, 1)} />
          <Kpi label={t.model.recall} value={pct((m.recall ?? 0) * 100, lang, 1)} />
          <Kpi label={t.model.brier} value={n(m.brier ?? 0, lang, 4)} foot={<span className="muted">{es ? "menor es mejor" : "lower is better"}</span>} />
          <Kpi
            label={es ? "Filas de entrenamiento" : "Training rows"}
            value={n(m.n_train ?? 0, lang)}
            foot={<span className="muted">{n(m.n_test ?? 0, lang)} {es ? "de prueba" : "test"}</span>}
          />
        </div>

        <Card title={t.model.cardTitle}>
          <dl className="facts" style={{ gridTemplateColumns: "170px 1fr" }}>
            <dt>{t.model.target}</dt>
            <dd style={{ textAlign: "left" }}>{(es ? card.target : card.target_en) ?? card.target}</dd>
            <dt>{t.model.algorithm}</dt>
            <dd style={{ textAlign: "left" }} className="mono">{card.algorithm}</dd>
            <dt>{t.model.split}</dt>
            <dd style={{ textAlign: "left" }}>
              {tr.split} · {es ? "entrena" : "train"} {tr.train_from} → {tr.train_to} · {es ? "prueba" : "test"} {tr.test_from} → {tr.test_to}
            </dd>
            <dt>{es ? "Horizonte" : "Horizon"}</dt>
            <dd style={{ textAlign: "left" }}>{card.horizon_days} {t.common.days}</dd>
            <dt>{es ? "Bandas mostradas" : "Display bands"}</dt>
            <dd style={{ textAlign: "left" }}>
              {t.risk.alto} ≥ {n((card.thresholds?.high ?? 0) * 100, lang)}% · {t.risk.medio} ≥{" "}
              {n((card.thresholds?.medium ?? 0) * 100, lang)}%
            </dd>
            <dt>{es ? "Corte de precisión" : "Precision cut"}</dt>
            <dd style={{ textAlign: "left" }}>
              {card.thresholds?.precision_threshold != null
                ? `${n(card.thresholds.precision_threshold * 100, lang)}%`
                : "—"}{" "}
              <span className="dim">
                {es
                  ? "— el corte más bajo que aún da ≥80% de precisión. Se usa para ordenar la cola, no para pintar bandas."
                  : "— the lowest cut still giving ≥80% precision. Used to rank the queue, not to colour bands."}
              </span>
            </dd>
            <dt>{t.model.trained}</dt>
            <dd style={{ textAlign: "left" }}>{card.trained_at}</dd>
          </dl>

          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderLeft: "2px solid var(--warning)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 4 }}>{t.model.honesty}</div>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
              {t.model.honestyBody}
            </p>
          </div>
        </Card>

        <div className="split c3">
          <Card title={t.model.rocTitle} note={t.model.rocNote}>
            <RocChart points={card.roc ?? []} auc={m.auc ?? 0} />
          </Card>

          <Card title={t.model.calTitle} note={t.model.calNote}>
            <CalibrationChart bins={card.calibration ?? []} />
          </Card>

          <Card title={t.model.confusionTitle} note={`${es ? "En" : "On"} ${n(m.n_test ?? 0, lang)} ${es ? "filas de prueba" : "test rows"}`}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 1fr",
                gap: 1,
                fontSize: 12,
                background: "var(--line)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
              }}
            >
              <Cell head />
              <Cell head label={es ? "Pred. sí" : "Pred. yes"} />
              <Cell head label={es ? "Pred. no" : "Pred. no"} />
              <Cell head label={es ? "Real sí" : "Actual yes"} />
              <Cell value={c.tp} tone="good" sub={es ? "aciertos" : "hits"} />
              <Cell value={c.fn} tone="critical" sub={es ? "perdidos" : "missed"} />
              <Cell head label={es ? "Real no" : "Actual no"} />
              <Cell value={c.fp} tone="warning" sub={es ? "falsa alarma" : "false alarm"} />
              <Cell value={c.tn} sub={es ? "correctos" : "correct"} />
            </div>
            <p className="card-note" style={{ marginTop: 10 }}>
              {es
                ? `De cada 100 residencias que el modelo marca, ${Math.round((m.precision ?? 0) * 100)} efectivamente se degradan. Detecta ${Math.round((m.recall ?? 0) * 100)}% de las que sí lo hacen.`
                : `Of every 100 residences the model flags, ${Math.round((m.precision ?? 0) * 100)} genuinely degrade. It catches ${Math.round((m.recall ?? 0) * 100)}% of those that do.`}
            </p>
          </Card>
        </div>

        <div className="split main-side">
          <Card title={t.model.coefTitle} note={t.model.coefNote}>
            <DivergingBars
              items={(card.coefficients ?? []).map((co) => ({
                label: es ? co.label_es : co.label_en,
                value: co.coef,
                hint: `mean ${co.mean} · scale ${co.scale}`,
              }))}
              labelWidth={210}
            />
          </Card>

          <Card title={t.model.liveTitle} note={t.model.liveNote}>
            <BarList
              items={(card.live?.distribution ?? []).map((b) => ({ label: b.bin, value: b.n }))}
              labelWidth={72}
              color="var(--s-5)"
            />
            <hr className="hr" />
            <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
              {(["alto", "medio", "bajo"] as const).map((b) => (
                <span key={b} className="row" style={{ gap: 6 }}>
                  <span className={`dot ${b === "alto" ? "critical" : b === "medio" ? "warning" : "good"}`} />
                  <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{t.risk[b]}</span>
                  <span className="num" style={{ fontWeight: 600 }}>
                    {n(card.live?.by_band?.[b] ?? 0, lang)}
                  </span>
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Cell({
  head,
  label,
  value,
  sub,
  tone,
}: {
  head?: boolean;
  label?: string;
  value?: number;
  sub?: string;
  tone?: "good" | "warning" | "critical";
}) {
  const toneVar =
    tone === "good" ? "var(--good)" : tone === "warning" ? "var(--warning)" : tone === "critical" ? "var(--critical)" : "var(--ink)";
  return (
    <div
      style={{
        background: head ? "var(--surface-2)" : "var(--surface)",
        padding: "9px 10px",
        textAlign: head ? "left" : "right",
      }}
    >
      {head ? (
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          {label}
        </span>
      ) : (
        <>
          <div className="num" style={{ fontSize: 17, fontWeight: 600, color: toneVar }}>
            {value}
          </div>
          <div className="dim" style={{ fontSize: 10.5 }}>{sub}</div>
        </>
      )}
    </div>
  );
}
