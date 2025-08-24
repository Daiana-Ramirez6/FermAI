import time
import uuid      # ➕ agregado
import threading # ➕ agregado
import paho.mqtt.client as mqtt
from typing import Dict, List  # ➕ agregado

from ..schemas.mqtt import MqttCreds, TestResult, SubscribeReq  # ➕ agregado

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

    # ➕ agregado: cliente efímero para suscribir y (opcional) verificar recepción
    @staticmethod
    def subscribe_and_probe(req: SubscribeReq) -> Dict:
        """
        No toca el cliente global del bridge. Crea un cliente temporal:
        - Conecta
        - Suscribe a los topics => lee SUBACK (QoS concedido o 128 si rechazado)
        - (Opcional) Hace un loopback publicando/recibiendo en un tópico efímero
        - Cierra
        """
        cid = f"fermai-subcheck-{int(time.time())}"
        c = mqtt.Client(client_id=cid, clean_session=True)

        if req.username or req.password:
            c.username_pw_set(req.username, req.password)

        connected = threading.Event()
        subacked  = threading.Event()
        probe_ok_ev = threading.Event()
        granted: Dict[str, int] = {}

        probe_topic = f"fermAI/_probe/{uuid.uuid4().hex}"

        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                connected.set()

        def on_subscribe(client, userdata, mid, qos_list):
            # Mapear QoS concedidos a los topics en el mismo orden
            for t, q in zip(req.topics, qos_list or []):
                granted[t] = q
            subacked.set()

        def on_message(client, userdata, msg):
            if msg.topic == probe_topic and msg.payload == b"ok":
                probe_ok_ev.set()

        c.on_connect = on_connect
        c.on_subscribe = on_subscribe
        c.on_message = on_message

        try:
            c.connect(req.host, int(req.port), keepalive=20)
        except Exception:
            return {"ok": False, "granted": {}, "probe_ok": None}

        c.loop_start()

        # Espera conexión
        if not connected.wait(req.timeout_ms / 1000.0):
            c.loop_stop(); c.disconnect()
            return {"ok": False, "granted": {}, "probe_ok": None}

        # Suscripción y SUBACK
        if req.topics:
            try:
                c.subscribe([(t, int(req.qos)) for t in req.topics])
            except Exception:
                # Si hay error al pedir la suscripción
                pass
            subacked.wait(req.timeout_ms / 1000.0)

        # Loopback opcional (verifica recepción real)
        if req.probe:
            try:
                c.subscribe(probe_topic, 0)
                c.publish(probe_topic, "ok")
            except Exception:
                pass
            probe_ok_ev.wait(req.timeout_ms / 1000.0)

        c.loop_stop(); c.disconnect()

        ok = bool(granted) and all(q in (0, 1, 2, 128) for q in granted.values())
        return {
            "ok": ok,
            "granted": granted,
            "probe_ok": probe_ok_ev.is_set() if req.probe else None,
        }
