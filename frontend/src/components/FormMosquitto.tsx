// frontend/src/components/FormMosquitto.tsx
import React, { useState } from "react";
import { MqttCreds, TopicRow, KIND_LABEL, SubscribeResp } from "../types";
import { testMqttConnect, subscribeTopics } from "../services/mqttService";

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

  // estados de suscripción
  const [subscribing, setSubscribing] = useState(false);
  const [subResult, setSubResult] = useState<SubscribeResp | null>(null);

  const updateRow = (id: string, patch: Partial<TopicRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [
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
    setSubResult(null); // limpia cualquier resultado previo de suscripción
    try {
      const data = await testMqttConnect(form);
      setStatus(data);
      // se mantiene tu flujo original
      if (data.ok) onConnected(form, rows);
    } catch (e: any) {
      setStatus({ ok: false, detail: e?.message || "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe() {
    const topics = rows.map((r) => r.topic.trim()).filter(Boolean);
    if (topics.length === 0) return;

    setSubscribing(true);
    try {
      const res = await subscribeTopics({
        ...form,
        topics,
        qos: 0,
        probe: true,
        timeout_ms: 2500,
      });
      setSubResult(res);
      // si querés mover el avance aquí:
      // if (res.ok && res.probe_ok) onConnected(form, rows);
    } catch (e: any) {
      setSubResult({ ok: false, granted: {}, probe_ok: null });
      setStatus({ ok: false, detail: e?.message || "Error al suscribirse" });
    } finally {
      setSubscribing(false);
    }
  }

  // abre nueva pestaña con la vista de datos en vivo
  function openLiveTab() {
    const topics = rows.map((r) => r.topic.trim()).filter(Boolean);
    const qs = new URLSearchParams({
      live: "1",
      host: form.host,
      port: String(form.port),
      username: form.username || "",
      password: form.password || "",
      topics: topics.join(","),
    });
    window.open(`/?${qs.toString()}`, "_blank");
  }

  return (
    <section>
      <h1 className="h1-celeste">Vinculación Mosquitto</h1>

      <div className="form">
        <div className="row">
          <label>host</label>
          <input
            placeholder="ej: matucesari.servehttp.com"
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
          <button
            className="btn-primary"
            onClick={handleTest}
            disabled={loading || !form.host.trim()}
          >
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
              onChange={(e) =>
                updateRow(r.id, { kind: e.target.value as TopicRow["kind"] })
              }
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

        {/* Suscribirse (habilitado tras vinculación OK) */}
        <div className="btn-row" style={{ marginTop: ".75rem" }}>
          <button
            className="btn-primary"
            onClick={handleSubscribe}
            disabled={subscribing || !status?.ok}
            title={!status?.ok ? "Primero probá la vinculación" : ""}
          >
            {subscribing ? "Suscribiendo…" : "Suscribirse"}
          </button>
        </div>

        {/* Resultados de suscripción */}
        {subResult && (
          <div className="result" style={{ marginTop: ".5rem" }}>
            <p className="note">Resultado de suscripción:</p>
            <ul>
              {Object.entries(subResult.granted).map(([topic, q]) => (
                <li key={topic}>
                  {q === 128 ? (
                    <>
                      ❌ <code>{topic}</code> (rechazado por ACL)
                    </>
                  ) : (
                    <>
                      ✅ <code>{topic}</code> (QoS {q})
                    </>
                  )}
                </li>
              ))}
            </ul>
            {subResult.probe_ok !== undefined && subResult.probe_ok !== null && (
              <p className={subResult.probe_ok ? "status-ok" : "status-bad"}>
                {subResult.probe_ok
                  ? "✅ Recepción verificada"
                  : "⚠️ No se pudo verificar recepción"}
              </p>
            )}
          </div>
        )}

        {/* Siguiente: solo si suscripción OK + probe OK */}
        {subResult?.ok && subResult?.probe_ok && (
          <div className="btn-row" style={{ marginTop: ".75rem" }}>
            <button className="btn-primary" onClick={openLiveTab}>
              Siguiente
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

