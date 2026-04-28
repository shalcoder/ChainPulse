"""
Async PostgreSQL connection management using SQLAlchemy 2.0 async engine.

Two session patterns:
  1. get_db()      — FastAPI dependency injection (used in route handlers)
  2. get_session() — async context manager (used in background tasks)

create_all_tables() is called once at startup:
  - Enables PostGIS extension
  - Creates all ORM-mapped tables
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy import text

from app.core.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────
# pool_size=10: max 10 persistent connections — enough for 20 vehicles + API
# max_overflow=20: allow 20 extra connections during traffic spikes
# pool_pre_ping=True: test connections before use (avoids "connection closed" errors)
engine: AsyncEngine = create_async_engine(
    settings.get_database_url(),
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=settings.DEBUG,  # Log all SQL in debug mode
)

# Session factory — creates new AsyncSession instances
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Keep objects usable after commit
    autoflush=False,
    autocommit=False,
)


# ── FastAPI dependency ────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency. Yields a session and guarantees close on exit.

    Usage in route handler:
        async def my_route(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Background task context manager ──────────────────────────────────────────

@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for background tasks (Kafka consumer, etc.)

    Usage:
        async with get_session() as session:
            result = await session.execute(...)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Table creation ────────────────────────────────────────────────────────────

async def create_all_tables() -> None:
    """
    Called once at application startup (in main.py lifespan).

    1. Enables PostGIS extension — required for Geography columns
    2. Runs Base.metadata.create_all to create all ORM-mapped tables
       (Hub, Vehicle, Shipment, Route, RouteDecision, RiskAlert, AuditRecord)

    This is idempotent — safe to call even if tables already exist.
    """
    # Import all models so SQLAlchemy knows about them before create_all
    from app.models.entities import Base, Hub, Vehicle, Shipment, Route  # noqa: F401
    from app.models.decisions import RouteDecision, RiskAlert, AuditRecord  # noqa: F401

    async with engine.begin() as conn:
        # Enable PostGIS — must happen before create_all because
        # Geography type requires the extension to be present
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis_topology;"))

        # Create all tables defined in ORM models
        await conn.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    """Called at application shutdown to cleanly close all connections."""
    await engine.dispose()