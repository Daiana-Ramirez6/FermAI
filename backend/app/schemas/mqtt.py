from typing import List, Dict, Optional  # ➕ agregado
from pydantic import BaseModel, Field

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

# ➕ agregado: request/response para suscripción y verificación
class SubscribeReq(MqttCreds):
    topics: List[str]
    qos: int = Field(0, description="QoS solicitado (0/1/2)")
    probe: bool = Field(True, description="Hacer loopback para verificar recepción real")
    timeout_ms: int = Field(2500, description="Timeout de espera a SUBACK/probe en milisegundos")

class SubscribeResp(BaseModel):
    ok: bool
    granted: Dict[str, int]                 # {topic: 0|1|2} o 128 si broker lo rechazó
    probe_ok: Optional[bool] = None         # True si se recibió el loopback

