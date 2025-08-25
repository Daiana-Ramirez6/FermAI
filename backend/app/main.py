# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import paho.mqtt.client as mqtt
import time, json, threading
from typing import Optional, List, Set
import anyio  # para pequeño sleep anti-carrera y keepalive

# ➕ para /api/mqtt/subscribe (usa tu service existente)
from app.schemas.mqtt import SubscribeReq, SubscribeResp
from app.services.mqtt_service import MqttService as MqttSvc  # alias para no chocar con la clase local

app = FastAPI(title="FermAI API", version="0.3.0")

# ---- CORS para Vite ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------ Models ------------
class MqttCreds(BaseModel):
    host: str = Field(..., description="Host del broker MQTT")
    port: int = Field(1883, description="Puerto del broker")
    username: str = Field("", description="Usuario MQTT")
    password: str = Field("", description="Password MQTT")

class TestResult(BaseModel):
    ok: bool
    detail: str

class PublishMsg(BaseModel):
    topic: str
    payload: str

# ------------ Service (test) ------------
class MqttService:
    @staticmethod
    def test_connect(creds: MqttCreds) -> TestResult:
        client = mqtt.Client(client_id=f"fermAI-{int(time.time())}")
        if creds.username or creds.password:
            client.username_pw_set(creds.username, creds.password)
        try:
            client.connect(creds.host, int(creds.port), keepalive=10)
            client.loop_start()
            time.sleep(0.2)
            client.loop_stop()
            client.disconnect()
            return TestResult(ok=True, detail="Vinculación exitosa")
        except Exception as e:
            return TestResult(ok=False, detail=f"Vinculación fallida: {e}")

# ------------ MQTT bridge sencillo ------------
class Bridge:
    def __init__(self):
        self.client: Optional[mqtt.Client] = None
        self.ws_pool: Set[WebSocket] = set()
        self.lock = threading.RLock()
        self.loop_started = False
        self.connected_cfg = None  # (host, port, user, pass)

    def ensure_client(self, host: str, port: int, username: str, password: str):
        cfg = (host, int(port), username or "", password or "")
        with self.lock:
            if self.client and self.connected_cfg == cfg:
                return self.client

            # cerrar anterior si existía
            try:
                if self.client is not None:
                    self.client.disconnect()
            except Exception:
                pass

            c = mqtt.Client(client_id=f"fermAI-bridge-{int(time.time())}")
            if username or password:
                c.username_pw_set(username, password)

            # callbacks
            def on_connect(client, userdata, flags, rc):
                # suscribiremos después desde cada WS
                print(f"[MQTT] on_connect rc={rc}")

            def on_message(client, userdata, msg):
                # DEBUG: ver que realmente llega del broker
                print("[MQTT] RX", msg.topic, msg.payload[:80])

                payload_txt = msg.payload.decode("utf-8", errors="ignore")
                # intentar JSON; si no, enviar como texto/num
                try:
                    payload = json.loads(payload_txt)
                except Exception:
                    try:
                        payload = float(payload_txt) if "." in payload_txt else int(payload_txt)
                    except Exception:
                        payload = payload_txt

                data = {"topic": msg.topic, "payload": payload, "ts": int(time.time())}
                # broadcast seguro desde el hilo de paho
                dead = []
                for ws in list(self.ws_pool):
                    try:
                        anyio.from_thread.run(ws.send_text, json.dumps(data))
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    self.ws_pool.discard(ws)

            c.on_connect = on_connect
            c.on_message = on_message
            # puede lanzar excepción si host/puerto/credenciales están mal
            c.connect(cfg[0], cfg[1], keepalive=30)

            if not self.loop_started:
                c.loop_start()
                self.loop_started = True

            self.client = c
            self.connected_cfg = cfg
            return c

    def attach_ws(self, ws: WebSocket):
        with self.lock:
            self.ws_pool.add(ws)

    def detach_ws(self, ws: WebSocket):
        with self.lock:
            self.ws_pool.discard(ws)

BRIDGE = Bridge()

# ------------ Routes ------------
@app.get("/api/health")
def health():
    return {"ok": True, "service": "FermAI API"}

@app.post("/api/mqtt/test-connect", response_model=TestResult)
def test_connect(creds: MqttCreds):
    return MqttService.test_connect(creds)

# Publicar comandos desde el front (para pruebas/manual)
@app.post("/api/mqtt/publish")
def mqtt_publish(
    msg: PublishMsg = Body(...),
    host: str = "127.0.0.1",
    port: int = 1883,
    username: str = "",
    password: str = "",
):
    c = BRIDGE.ensure_client(host, port, username, password)
    c.publish(msg.topic, msg.payload)
    return {"ok": True}

# ➕ endpoint para la verificación de suscripción (usa tu service)
@app.post("/api/mqtt/subscribe", response_model=SubscribeResp)
def mqtt_subscribe(req: SubscribeReq) -> SubscribeResp:
    data = MqttSvc.subscribe_and_probe(req)
    return SubscribeResp(**data)

# WebSocket: recibe credenciales por query y lista de topics separados por coma
@app.websocket("/ws")
async def ws_stream(
    ws: WebSocket,
    host: str = "127.0.0.1",
    port: int = 1883,
    username: str = "",
    password: str = "",
    topics: str = "tempeh/#,t/esp32,h/esp32,tsonda/esp32",
):
    # DEBUG: ver qué parámetros llegaron desde el front
    print("[WS] accept params:", {"host": host, "port": port, "user": username, "topics": topics})

    await ws.accept()
    BRIDGE.attach_ws(ws)

    # ---- asegurar conexión MQTT ----
    try:
        client = BRIDGE.ensure_client(host, port, username, password)
    except Exception as e:
        # Evita cierre 1011/1006 en el cliente: informa y cierra limpio
        err = str(e)
        print(f"[WS] mqtt connect error: {e!r}")
        try:
            await ws.send_json({"type": "error", "where": "ensure_client", "detail": err})
        finally:
            await ws.close(code=1011, reason="mqtt_connect_failed")
            BRIDGE.detach_ws(ws)
        return

    # evitar carrera: damos un respiro al connect antes de pedir SUBSCRIBE
    await anyio.sleep(0.3)

    # ---- suscripciones ----
    topic_list: List[str] = [t.strip() for t in (topics or "").split(",") if t.strip()]
    print("[WS] subscribe ->", topic_list)
    for t in topic_list:
        try:
            rc, mid = client.subscribe(t, qos=0)
            print(f"[WS] sub rc={rc} mid={mid} topic={t}")  # rc==0 OK
        except Exception as e:
            print(f"[WS] sub error topic={t} err={e}")

    # ---- loop del WS (mantener vivo con keepalive) ----
    try:
        while True:
            # Espera mensajes del front con timeout suave
            with anyio.move_on_after(60):  # 60 s sin mensajes -> enviamos keepalive
                _ = await ws.receive_text()
                continue  # si hubo mensaje, seguimos esperando

            # Si no llegó nada en 60s, mandamos un keepalive al cliente
            try:
                await ws.send_json({"type": "keepalive", "ts": int(time.time())})
            except Exception:
                # Si falla el envío, el cliente probablemente se desconectó
                break
    except WebSocketDisconnect:
        pass
    finally:
        BRIDGE.detach_ws(ws)
