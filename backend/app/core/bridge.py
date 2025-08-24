import time, json, threading
from typing import Optional, Set, List
import paho.mqtt.client as mqtt
from fastapi import WebSocket, WebSocketDisconnect

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
            try:
                self.client and self.client.disconnect()
            except Exception:
                pass

            c = mqtt.Client(client_id=f"fermai-bridge-{int(time.time())}")
            if username or password:
                c.username_pw_set(username, password)

            def on_message(client, userdata, msg):
                payload_txt = msg.payload.decode("utf-8", errors="ignore")
                try:
                    payload = json.loads(payload_txt)
                except Exception:
                    try:
                        payload = float(payload_txt) if "." in payload_txt else int(payload_txt)
                    except Exception:
                        payload = payload_txt
                data = {"topic": msg.topic, "payload": payload, "ts": int(time.time())}

                import anyio
                dead = []
                for ws in list(self.ws_pool):
                    try:
                        anyio.from_thread.run(ws.send_text, json.dumps(data))
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    self.ws_pool.discard(ws)

            c.on_message = on_message
            c.connect(cfg[0], cfg[1], keepalive=30)
            if not self.loop_started:
                c.loop_start()
                self.loop_started = True

            self.client = c
            self.connected_cfg = cfg
            return c

    def attach_ws(self, ws: WebSocket):  self.ws_pool.add(ws)
    def detach_ws(self, ws: WebSocket):  self.ws_pool.discard(ws)

BRIDGE = Bridge()  # singleton sencillo
