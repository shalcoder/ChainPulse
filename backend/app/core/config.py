"""
Central configuration — single source of truth for all constants and env vars.
Every module imports from here. Nothing is hardcoded elsewhere.
Uses pydantic-settings so values can be overridden via .env file or environment.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "AI Supply Chain Control Tower"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    # ── PostgreSQL ────────────────────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "scc_user"
    POSTGRES_PASSWORD: str = "scc_password"
    POSTGRES_DB: str = "scc_db"

    # Set by Render/Heroku directly
    DATABASE_URL: str | None = None

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        url = self.get_database_url()
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # ── Kafka ─────────────────────────────────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_CONSUMER_GROUP: str = "scc-control-tower"
    KAFKA_AUTO_OFFSET_RESET: str = "latest"

    # Topic names — must match topics.sh
    KAFKA_TOPIC_GPS: str = "gps-updates"
    KAFKA_TOPIC_WEATHER: str = "weather-alerts"
    KAFKA_TOPIC_ORDER: str = "order-events"
    KAFKA_TOPIC_WAREHOUSE: str = "warehouse-events"
    KAFKA_TOPIC_DECISIONS: str = "route-decisions"

    @property
    def KAFKA_ALL_TOPICS(self) -> list[str]:
        return [
            self.KAFKA_TOPIC_GPS,
            self.KAFKA_TOPIC_WEATHER,
            self.KAFKA_TOPIC_ORDER,
            self.KAFKA_TOPIC_WAREHOUSE,
        ]

    # ── Risk Score Weights ────────────────────────────────────────────────────
    # Must sum to 1.0
    # 0.45 delay — the single biggest factor: a delayed vehicle is the core problem
    # 0.25 anomaly — second most important: anomalies are early warnings
    # 0.20 SLA — business impact: some shipments have hard deadlines
    # 0.10 weather — external signal: informs but doesn't dominate
    RISK_WEIGHT_DELAY: float = 0.45
    RISK_WEIGHT_ANOMALY: float = 0.25
    RISK_WEIGHT_SLA: float = 0.20
    RISK_WEIGHT_WEATHER: float = 0.10

    # ── Risk Thresholds ───────────────────────────────────────────────────────
    HIGH_RISK_THRESHOLD: float = 0.70    # Triggers automatic re-optimization
    MEDIUM_RISK_THRESHOLD: float = 0.45  # Triggers alert only

    # ── Fleet & Simulation ────────────────────────────────────────────────────
    FLEET_SIZE: int = 20
    HUB_COUNT: int = 5
    SHIPMENT_COUNT: int = 100
    GPS_UPDATE_INTERVAL_SECONDS: float = 2.0

    # ── OR-Tools VRPTW ────────────────────────────────────────────────────────
    VRPTW_TIME_LIMIT_SECONDS: int = 10   # Hard limit: solver must return in 10s
    VRPTW_MAX_VEHICLES: int = 20
    VRPTW_DEPOT_INDEX: int = 0
    SLA_PENALTY_COEFFICIENT: int = 1000  # Cost multiplier for SLA violations

    # ── ML Models ────────────────────────────────────────────────────────────
    ETA_MODEL_PATH: str = "ml/models/eta_model.pkl"
    ANOMALY_MODEL_PATH: str = "ml/models/anomaly_model.pkl"
    SCALER_PATH: str = "ml/models/scaler.pkl"

    # ── WebSocket ─────────────────────────────────────────────────────────────
    WS_HEARTBEAT_INTERVAL: int = 30   # seconds

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["*"]

    # ── Mapbox ────────────────────────────────────────────────────────────────
    MAPBOX_ACCESS_TOKEN: str = ""
    MAPBOX_STYLE: str = "mapbox://styles/mapbox/dark-v11"

    # ── Feature Builder ───────────────────────────────────────────────────────
    ROLLING_WINDOW_SIZE: int = 10   # Number of recent events to consider
    ANOMALY_DWELL_THRESHOLD_MINUTES: int = 30  # Flag if stopped > 30 min
    GPS_JUMP_THRESHOLD_KM: float = 5.0  # Flag if position jumps > 5 km in 1 tick

    # ── Gemini ────────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""


@lru_cache()
def get_settings() -> Settings:
    """
    Returns a cached Settings instance.
    @lru_cache means environment variables are parsed exactly once per process.
    Use get_settings() everywhere instead of instantiating Settings() directly.
    """
    return Settings()


# Module-level shortcut so callers can do: from app.core.config import settings
settings = get_settings()