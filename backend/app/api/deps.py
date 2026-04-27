"""FastAPI dependency injection — DB session and WebSocket manager."""

from app.db.postgres import AsyncSessionLocal
from app.services.dispatch.websocket_manager import ws_manager


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def get_ws_manager():
    return ws_manager