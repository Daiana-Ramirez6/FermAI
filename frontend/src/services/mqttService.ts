import { MqttCreds } from "../types";
import { SubscribeReq, SubscribeResp } from "../types";

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
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { onMessage(e.data); } };
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