"""
FastAPI application entry point.

Lifespan handles startup and shutdown in order:
  Startup:  Redis → PostgreSQL tables → Kafka consumer (background task)
  Shutdown: Kafka consumer → Redis → PostgreSQL engine

All services have fallback behaviour so the app starts even if
Kafka or Redis are not yet ready (retries internally).
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup → yield → Shutdown pattern.
    Everything before yield runs at startup; everything after at shutdown.
    """
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # ── Startup ───────────────────────────────────────────────────────────
    # 1. Redis
    try:
        from app.db.redis_client import init_redis
        await init_redis()
        logger.info("Redis connected.")
    except Exception as e:
        logger.warning(f"Redis not available at startup: {e}. Will retry on first use.")

    # 2. PostgreSQL — create all tables
    try:
        from app.db.postgres import create_all_tables
        await create_all_tables()
        logger.info("PostgreSQL tables ready.")
    except Exception as e:
        logger.warning(f"PostgreSQL not available at startup: {e}")

    # 3. Kafka consumer — runs as background task
    # We don't await this — it runs indefinitely in the background
    try:
        from app.services.ingestion.kafka_consumer import consumer
        kafka_task = asyncio.create_task(consumer.start())
        logger.info("Kafka consumer started as background task.")
    except Exception as e:
        logger.warning(f"Kafka consumer failed to start: {e}")
        kafka_task = None

    yield  # ← Application is running and serving requests

    # ── Shutdown ──────────────────────────────────────────────────────────
    logger.info("Shutting down...")

    if kafka_task:
        try:
            from app.services.ingestion.kafka_consumer import consumer
            await consumer.stop()
            kafka_task.cancel()
        except Exception as e:
            logger.warning(f"Error stopping Kafka consumer: {e}")

    try:
        from app.db.redis_client import close_redis
        await close_redis()
        logger.info("Redis closed.")
    except Exception:
        pass

    try:
        from app.db.postgres import dispose_engine
        await dispose_engine()
        logger.info("PostgreSQL engine disposed.")
    except Exception:
        pass


# ── App instance ──────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Real-time AI Supply Chain Control Tower",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
from app.api.routes import dashboard, events, predict, optimize

app.include_router(dashboard.router, tags=["Dashboard"])
app.include_router(events.router, tags=["Events"])
app.include_router(predict.router, tags=["Predict"])
app.include_router(optimize.router, tags=["Optimize"])

# Load ML models at startup (after routes are registered)
from app.services.prediction import eta_model, anomaly_model
eta_model.load_model()
anomaly_model.load_model()

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint.
    Returns status of all downstream services.
    Used by Docker health checks and the frontend to verify connectivity.
    """
    status = {"status": "ok", "version": settings.APP_VERSION}

    # Check Redis
    try:
        from app.db.redis_client import get_redis
        await get_redis().ping()
        status["redis"] = "ok"
    except Exception:
        status["redis"] = "unavailable"

    # Check PostgreSQL
    try:
        from app.db.postgres import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["postgres"] = "ok"
    except Exception:
        status["postgres"] = "unavailable"

    return status


@app.get("/", tags=["Health"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }