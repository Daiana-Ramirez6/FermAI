// frontend/src/App.tsx
import React, { useMemo, useState } from "react";

type Step = 1 | 2;

type MqttCreds = {
  host: string;
  port: number | string;
  username: string;
  password: string;
};

type TopicRow = {
  id: string;
  kind: keyof typeof KIND_LABEL;
  topic: string;
};

const KIND_LABEL = {
  t_sonda: "temperatura sonda",
  t_amb: "temperatura ambiente",
  h_amb: "humedad ambiente",
  gases: "medición de gases",
} as const;

const API_URL = "";

export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(
    null
  );

  const [form, setForm] = useState<MqttCreds>({
    host: "",
    port: 1883,
    username: "",
    password: "",
  });

  const [rows, setRows] = useState<TopicRow[]>([
    { id: crypto.randomUUID?.() ?? String(Date.now()), kind: "t_sonda", topic: "" },
  ]);

  const canNext = useMemo(() => true, []);

  function handleNext() {
    setStep(2);
  }

  async function testLink() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/mqtt/test-connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: form.host,
          port: Number(form.port) || 1883,
          username: form.username,
          password: form.password,
        }),
      });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        ok: false,
        detail: "Vinculación fallida: no se pudo contactar el backend",
      });
    } finally {
      setLoading(false);
    }
  }

  function updateRow(id: string, patch: Partial<TopicRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() ?? String(Date.now() + prev.length + 1),
        kind: "t_sonda",
        topic: "",
      },
    ]);
  }

  return (
    <div className="center">
      <div className="card">
        {step === 1 ? (
          <section>
            <h1 className="h1-celeste">Bienvenido a FermAI</h1>
            <div style={{ display: "grid", placeItems: "center" }}>
              <button className="btn-primary" onClick={handleNext} disabled={!canNext}>
                siguiente
              </button>
            </div>
          </section>
        ) : (
          <section>
            <h1 className="h1-celeste">Vinculación Mosquitto</h1>

            <div className="row">
              <label style={{ width: 120 }}>host</label>
              <input
                placeholder="ej: broker.hivemq.com"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </div>
            <div className="row">
              <label style={{ width: 120 }}>usuario</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="row">
              <label style={{ width: 120 }}>pass</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="row">
              <label style={{ width: 120 }}>port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
              />
            </div>

            <div
              className="row"
              style={{ justifyContent: "space-between", marginTop: "1rem" }}
            >
              <button className="btn-primary" onClick={testLink} disabled={loading}>
                {loading ? "Verificando…" : "Probar vinculación"}
              </button>

              {status && (
                <span className={status.ok ? "status-ok" : "status-bad"}>
                  {status.detail}
                </span>
              )}
            </div>

            <hr className="hr" />

            <p className="note">
              Configura los tópicos (se habilitan desde el principio para que puedas ir
              completando):
            </p>

            {rows.map((r) => (
              <div className="row" key={r.id}>
                <select
                  value={r.kind}
                  onChange={(e) =>
                    updateRow(r.id, { kind: e.target.value as TopicRow["kind"] })
                  }
                  style={{ flex: 0.8 }}
                >
                  {Object.entries(KIND_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="ej: tempeh/t_sonda"
                  value={r.topic}
                  onChange={(e) => updateRow(r.id, { topic: e.target.value })}
                />
              </div>
            ))}

            <div style={{ marginTop: ".75rem" }}>
              <button className="btn-ghost" onClick={addRow}>
                + agregar tópico
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
