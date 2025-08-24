# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import paho.mqtt.client as mqtt
import time

app = FastAPI(title="FermAI API", version="0.1.0")

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

# ------------ Service ------------
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

# ------------ Routes ------------
@app.get("/api/health")
def health():
    return {"ok": True, "service": "FermAI API"}

@app.post("/api/mqtt/test-connect", response_model=TestResult)
def test_connect(creds: MqttCreds):
    return MqttService.test_connect(creds)
