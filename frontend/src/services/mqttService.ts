const API_URL = "http://127.0.0.1:8000";

export type MqttCreds = { host: string; port: number; username: string; password: string };

export async function testMqttConnect(creds: MqttCreds) {
  const res = await fetch(`${API_URL}/api/mqtt/test-connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "Error en conexión MQTT");
  }
  return res.json(); // {ok:true,...}
}

export function connectWebSocket(onMessage: (data: any) => void) {
  const ws = new WebSocket("ws://127.0.0.1:8000/ws");
  ws.onopen = () => console.log("WS conectado");
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); }
    catch { onMessage(e.data); } // por si llega texto plano
  };
  ws.onerror = (e) => console.error("WS error", e);
  ws.onclose = () => console.log("WS cerrado");
  return ws; // para poder cerrarlo desde el componente
}
