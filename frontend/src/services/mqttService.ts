// frontend/src/services/mqttService.ts
import { MqttCreds, SubscribeReq, SubscribeResp } from "../types";

export async function testMqttConnect(creds: MqttCreds) {
  const res = await fetch(`/api/mqtt/test-connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Error en conexión MQTT"));
  return res.json();
}

export function connectWebSocket(onMessage: (data: any) => void) {
  const ws = new WebSocket(`/ws`);
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      onMessage(e.data);
    }
  };
  return ws;
}

export async function subscribeTopics(req: SubscribeReq): Promise<SubscribeResp> {
  const res = await fetch(`/api/mqtt/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qos: 0, probe: true, timeout_ms: 2500, ...req }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Error en suscripción MQTT"));
  return res.json();
}

// ✅ Abre el WS pasando host/port/usuario/pass + topics por querystring (con logs para diagnosticar)
export function connectWebSocketWithParams(
  creds: MqttCreds,
  topics: string[],
  onMessage: (data: any) => void
) {
  const qs = new URLSearchParams({
    host: creds.host,
    port: String(creds.port),
    username: creds.username || "",
    password: creds.password || "",
    topics: topics.join(","),
  });

 const base = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
const ws = new WebSocket(`${base}/ws?${qs.toString()}`);


  // Logs de estado del WebSocket para ver si realmente conecta
  ws.onopen = () => console.log("[WS] open");
  ws.onerror = (e) => console.log("[WS] error", e);
  ws.onclose = (e) => console.log("[WS] close", (e as CloseEvent).code, (e as CloseEvent).reason);

  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      onMessage(e.data);
    }
  };

  return ws;
}
