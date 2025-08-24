// frontend/src/components/FormMosquitto.tsx
import React, { useState } from "react";
import { MqttCreds, TopicRow, KIND_LABEL } from "../types";
import { testMqttConnect } from "../services/mqttService";

type Props = {
  onConnected: (creds: MqttCreds, topics: TopicRow[]) => void;
};

export default function FormMosquitto({ onConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(null);

  const [form, setForm] = useState<MqttCreds>({
    host: "",
    port: 1883,
    username: "",
    password: "",
  });

  const [rows, setRows] = useState<TopicRow[]>([
    { id: crypto.randomUUID?.() ?? String(Date.now()), kind: "t_sonda", topic: "" },
  ]);

  const updateRow = (id: string, patch: Partial<TopicRow>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows(prev => [
      ...prev,
      {
        id: crypto.randomUUID?.() ?? String(Date.now() + prev.length + 1),
        kind: "t_sonda",
        topic: "",
      },
    ]);

  async function handleTest() {
    setLoading(true);
    setStatus(null);
    try {
      const data = await testMqttConnect(form);
      setStatus(data);
      if (data.ok) onConnected(form, rows);
    } catch (e: any) {
      setStatus({ ok: false, detail: e?.message || "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h1 className="h1-celeste">Vinculación Mosquitto</h1>

      <div className="form">
        <div className="row">
          <label>host</label>
          <input
            placeholder="ej: broker.hivemq.com"
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
          />
        </div>

        <div className="row">
          <label>usuario</label>
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </div>

        <div className="row">
          <label>pass</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <div className="row">
          <label>port</label>
          <input
            type="number"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
          />
        </div>

        {/* Botón centrado */}
        <div className="btn-row">
          <button className="btn-primary" onClick={handleTest} disabled={loading || !form.host.trim()}>
            {loading ? "Verificando…" : "Probar vinculación"}
          </button>
        </div>

        {/* Estado debajo del botón */}
        {status && (
          <span className={status.ok ? "status-ok" : "status-bad"}>
            {status.detail}
          </span>
        )}

        <hr className="hr" />

        <p className="note">Configura los tópicos:</p>

        {rows.map((r) => (
          <div className="row topic" key={r.id}>
            <select
              value={r.kind}
              onChange={(e) => updateRow(r.id, { kind: e.target.value as TopicRow["kind"] })}
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

        <div className="btn-row" style={{ marginTop: ".75rem" }}>
          <button className="btn-ghost" onClick={addRow}>
            + agregar tópico
          </button>
        </div>
      </div>
    </section>
  );
}
