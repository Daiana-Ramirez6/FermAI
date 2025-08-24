from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..core.bridge import BRIDGE

router = APIRouter(tags=["ws"])

@router.websocket("/ws")
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
    client = BRIDGE.ensure_client(host, port, username, password)
    topic_list: List[str] = [t.strip() for t in (topics or "").split(",") if t.strip()]
    for t in topic_list:
        try: client.subscribe(t, qos=0)
        except Exception: pass
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        BRIDGE.detach_ws(ws)
