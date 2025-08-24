from fastapi import APIRouter, Body
from ..schemas.mqtt import PublishMsg, MqttCreds, TestResult
from ..services.mqtt_service import MqttService
from ..core.bridge import BRIDGE

router = APIRouter(prefix="/api/mqtt", tags=["mqtt"])

@router.post("/test-connect", response_model=TestResult)
def test_connect(creds: MqttCreds):
    return MqttService.test_connect(creds)

@router.post("/publish")
def mqtt_publish(
    msg: PublishMsg = Body(...),
    host: str = "127.0.0.1",
    port: int = 1883,
    username: str = "",
    password: str = "",
):
    c = BRIDGE.ensure_client(host, port, username, password)
    # Ej: whitelist de tópicos aquí si lo necesitas
    c.publish(msg.topic, msg.payload)
    return {"ok": True}
