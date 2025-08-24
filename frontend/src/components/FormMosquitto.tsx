import { useRef, useState } from "react";
import { testMqttConnect, connectWebSocket, type MqttCreds } from "../services/mqttService";

export default function PasoMosquitto() {
  const [form, setForm] = useState<MqttCreds>({ host: "", port: 1883, username: "", password: "" });
  const [status, setStatus] = useState<string>("");
  const [lastMsg, setLastMsg] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Probando conexión...");
    try {
      const resp = await testMqttConnect(form);
      setStatus("Conexión OK ✅");
      // Abrir WS si no está abierto
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        wsRef.current = connectWebSocket((data) => setLastMsg(data));
      }
    } catch (err: any) {
      setStatus("Conexión fallida ❌ " + (err?.message || ""));
    }
  }

  function onCleanup() {
    wsRef.current?.close();
    wsRef.current = null;
  }

  return (
    <form onSubmit={onSubmit}>
      <input value={form.host} onChange={(e)=>setForm({...form,host:e.target.value})} placeholder="host" />
      <input value={form.port} onChange={(e)=>setForm({...form,port:Number(e.target.value)})} type="number" placeholder="port" />
      <input value={form.username} onChange={(e)=>setForm({...form,username:e.target.value})} placeholder="usuario" />
      <input value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} type="password" placeholder="password" />
      <button type="submit">Probar vinculación</button>
      <button type="button" onClick={onCleanup}>Cerrar WS</button>

      <p>{status}</p>
      {lastMsg && <pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(lastMsg,null,2)}</pre>}
    </form>
  );
}
