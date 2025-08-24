import time, paho.mqtt.client as mqtt
from . .schemas.mqtt import MqttCreds, TestResult

class MqttService:
    @staticmethod
    def test_connect(creds: MqttCreds) -> TestResult:
        client = mqtt.Client(client_id=f"fermai-{int(time.time())}")
        if creds.username or creds.password:
            client.username_pw_set(creds.username, creds.password)
        try:
            client.connect(creds.host, int(creds.port), keepalive=10)
            client.loop_start(); client.loop_stop()
            client.disconnect()
            return TestResult(ok=True, detail="Vinculación exitosa")
        except Exception as e:
            return TestResult(ok=False, detail=f"Vinculación fallida: {e}")
