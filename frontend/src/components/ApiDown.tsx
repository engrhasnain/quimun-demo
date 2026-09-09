"use client";

import { useSettings } from "@/components/Settings";

export default function ApiDown({ base, detail }: { base: string; detail?: string }) {
  const { lang } = useSettings();
  const es = lang === "es";

  return (
    <div className="content">
      <section className="card" style={{ maxWidth: 620 }}>
        <div className="card-head">
          <div>
            <h2 className="card-title">
              {es ? "No se puede conectar con la API" : "Cannot reach the API"}
            </h2>
            <p className="card-note">
              {es
                ? "El dashboard está corriendo, pero el backend FastAPI no responde."
                : "The dashboard is running, but the FastAPI backend is not responding."}
            </p>
          </div>
        </div>
        <div className="card-body stack">
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
            {es ? "Intentando conectar a" : "Trying to reach"}{" "}
            <code className="mono" style={{ color: "var(--ink)" }}>
              {base}
            </code>
          </div>
          {detail && (
            <div className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>
              {detail}
            </div>
          )}
          <hr className="hr" />
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
            {es ? "Para levantarlo:" : "To start it:"}
          </div>
          <pre
            className="mono"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              margin: 0,
              overflowX: "auto",
              lineHeight: 1.7,
            }}
          >
{`cd backend
python -m scripts.seed          # ${es ? "genera la base de datos" : "build the database"}
python -m ml.train_model        # ${es ? "entrena el modelo" : "train the model"}
uvicorn app.main:app --reload   # ${es ? "levanta la API" : "start the API"}`}
          </pre>
        </div>
      </section>
    </div>
  );
}
