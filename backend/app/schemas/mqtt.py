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
