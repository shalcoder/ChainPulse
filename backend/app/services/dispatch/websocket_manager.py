"""
WebSocket connection manager.

Maintains a registry of all active frontend connections.
Broadcasts JSON messages to every connected client.
Thread-safe via asyncio — no locks needed since FastAPI is single-threaded async.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self._connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self._connections)}")

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send message to all connected clients. Dead connections are removed."""
        if not self._connections:
            return

        data = json.dumps(message, default=str)
        dead: list[WebSocket] = []

        for ws in self._connections:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(ws)

    async def send_to(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        """Send message to a single connection."""
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception:
            self.disconnect(websocket)

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Module-level singleton — imported everywhere
ws_manager = WebSocketManager()