# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import paho.mqtt.client as mqtt
import time, json
import threading
from app.schemas.mqtt import SubscribeReq, SubscribeResp   # ➕
from app.services.mqtt_service import MqttService as MqttSvc  # ➕ alias para no chocar con tu clase local

from typing import Optional, List, Set

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
                self.client and self.client.disconnect()
            except Exception:
                pass

            c = mqtt.Client(client_id=f"fermAI-bridge-{int(time.time())}")
            if username or password:
                c.username_pw_set(username, password)

            # callbacks
            def on_connect(client, userdata, flags, rc):
                # suscribiremos después desde cada WS
                pass

            def on_message(client, userdata, msg):
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
                # broadcast seguro desde hilo de paho
                import anyio
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

# (Opcional) publicar comandos desde el front
@app.post("/api/mqtt/publish")
def mqtt_publish(
    msg: PublishMsg = Body(...),
    host: str = "127.0.0.1",
    port: int = 1883,
    username: str = "",
    password: str = "",
):
    c = BRIDGE.ensure_client(host, port, username, password)
    # Pequeña lista/regex de seguridad si quieres restringir tópicos:
    # if not msg.topic.startswith(("tempeh/", "hongo/")): raise HTTPException(400, "topic no permitido")
    c.publish(msg.topic, msg.payload)
    return {"ok": True}

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
    await ws.accept()
    BRIDGE.attach_ws(ws)

    # asegurar conexión MQTT y suscribir
    client = BRIDGE.ensure_client(host, port, username, password)
    topic_list: List[str] = [t.strip() for t in (topics or "").split(",") if t.strip()]
    for t in topic_list:
        try:
            client.subscribe(t, qos=0)
        except Exception:
            pass

    try:
        # mantener vivo; si querés recibir mensajes del front, léelos aquí
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        BRIDGE.detach_ws(ws)

@app.post("/api/mqtt/subscribe", response_model=SubscribeResp)   # ➕
def mqtt_subscribe(req: SubscribeReq) -> SubscribeResp:
    data = MqttSvc.subscribe_and_probe(req)
    return SubscribeResp(**data)
