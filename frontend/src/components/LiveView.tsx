// frontend/src/components/LiveView.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { connectWebSocketWithParams } from "../services/mqttService";
import type { MqttCreds } from "../types";

export default function LiveView() {
  const search = window.location.search;
  const params = new URLSearchParams(search);

  const creds: MqttCreds = {
    host: params.get("host") || "",
    port: Number(params.get("port") || "1883"),
    username: params.get("username") || "",
    password: params.get("password") || "",
  };

  const topics = useMemo(
    () =>
      (params.get("topics") || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [search]
  );

  const wsRef = useRef<WebSocket | null>(null);
  const [live, setLive] = useState<Record<string, { val: any; ts: number }>>(
    {}
  );

  // Clave estable: si cambia host/port/user o la lista de topics, reabrimos el WS.
  const wsKey = useMemo(
    () => JSON.stringify({ h: creds.host, p: creds.port, u: creds.username, t: topics }),
    [creds.host, creds.port, creds.username, topics]
  );

  useEffect(() => {
    // Abrimos la conexión
    wsRef.current = connectWebSocketWithParams(creds, topics, (msg) => {
      const { topic, payload, ts } = msg;
      setLive((prev) => ({ ...prev, [topic]: { val: payload, ts } }));
    });

    // Cerramos solo al desmontar o cuando cambian los parámetros (wsKey)
    return () => {
      try {
        wsRef.current?.close();
      } finally {
        wsRef.current = null;
      }
    };
  }, [wsKey]);

  return (
    <div className="center">
      <div className="card">
        <h1 className="h1-celeste">Datos en vivo</h1>
        <p><b>Broker:</b> {creds.host}:{creds.port}</p>
        <p><b>Tópicos:</b> {topics.join(", ") || "—"}</p>
        <hr className="hr" />
        <ul>
          {Object.entries(live).map(([topic, { val, ts }]) => (
            <li key={topic}>
              <code>{topic}</code>: {String(val)}{" "}
              <small>{new Date(ts * 1000).toLocaleTimeString()}</small>
            </li>
          ))}
          {Object.keys(live).length === 0 && <li>Esperando mensajes…</li>}
        </ul>
      </div>
    </div>
  );
}
