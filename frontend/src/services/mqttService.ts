import { MqttCreds } from "../types";

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
