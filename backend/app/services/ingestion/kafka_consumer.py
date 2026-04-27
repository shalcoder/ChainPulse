"""
Async Kafka consumer — the real-time heart of the control tower.

Subscribes to all 4 topics simultaneously:
  gps-updates, weather-alerts, order-events, warehouse-events

For each message:
  1. Deserialize JSON
  2. Validate against typed Pydantic schema
  3. Route to topic-specific handler
  4. Update Redis hot cache
  5. Build ML features
  6. Trigger risk scoring pipeline

Runs as a background asyncio task started in main.py lifespan.
Retries indefinitely on connection failure — the demo must never stop.
"""

import asyncio
import json
import logging
from typing import Optional

from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaConnectionError, KafkaError

from app.core.config import settings
from app.models.events import (
    GPSEvent, WeatherEvent, OrderEvent, WarehouseEvent,
    EventType, parse_event
)
from app.db import redis_client
from app.services.ingestion.feature_builder import FeatureBuilder

logger = logging.getLogger(__name__)

# Module-level feature builder — maintains rolling state across events
_feature_builder = FeatureBuilder()


class KafkaEventConsumer:
    """
    Wraps AIOKafkaConsumer with automatic reconnect and per-topic handlers.
    """

    def __init__(self) -> None:
        self._consumer: Optional[AIOKafkaConsumer] = None
        self._running = False

    async def start(self) -> None:
        """Start consuming — called from main.py lifespan."""
        self._running = True
        await self._consume_loop()

    async def stop(self) -> None:
        """Gracefully stop — called from main.py lifespan shutdown."""
        self._running = False
        if self._consumer:
            await self._consumer.stop()
            logger.info("Kafka consumer stopped.")

    async def _consume_loop(self) -> None:
        """
        Main loop with retry logic.
        If Kafka is not ready yet (Docker still starting), we wait and retry.
        This means the demo works even if you start the backend before Kafka.
        """
        retry_delay = 5  # seconds
        while self._running:
            try:
                await self._connect_and_consume()
            except KafkaConnectionError as e:
                logger.warning(
                    f"Kafka not reachable: {e}. Retrying in {retry_delay}s..."
                )
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 60)  # exponential backoff, cap 60s
            except Exception as e:
                logger.error(f"Unexpected consumer error: {e}", exc_info=True)
                await asyncio.sleep(retry_delay)

    async def _connect_and_consume(self) -> None:
        """Create consumer, subscribe, and process messages."""
        self._consumer = AIOKafkaConsumer(
            *settings.KAFKA_ALL_TOPICS,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=settings.KAFKA_CONSUMER_GROUP,
            auto_offset_reset=settings.KAFKA_AUTO_OFFSET_RESET,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            # Commit offsets every 5 seconds — prevents reprocessing after restart
            enable_auto_commit=True,
            auto_commit_interval_ms=5000,
            # Fetch up to 50 messages at once to reduce round trips
            max_poll_records=50,
            session_timeout_ms=30000,
            heartbeat_interval_ms=10000,
        )

        await self._consumer.start()
        logger.info(
            f"Kafka consumer connected. "
            f"Topics: {settings.KAFKA_ALL_TOPICS}"
        )

        async for msg in self._consumer:
            if not self._running:
                break
            await self._dispatch(msg.topic, msg.value)

    async def _dispatch(self, topic: str, raw: dict) -> None:
        """Route message to the correct handler based on topic."""
        try:
            if topic == settings.KAFKA_TOPIC_GPS:
                await self._handle_gps(raw)
            elif topic == settings.KAFKA_TOPIC_WEATHER:
                await self._handle_weather(raw)
            elif topic == settings.KAFKA_TOPIC_ORDER:
                await self._handle_order(raw)
            elif topic == settings.KAFKA_TOPIC_WAREHOUSE:
                await self._handle_warehouse(raw)
            else:
                logger.warning(f"Unknown topic: {topic}")
        except Exception as e:
            logger.error(
                f"Error processing message from {topic}: {e}",
                extra={"raw": raw},
                exc_info=True,
            )
            # We swallow the error — one bad message must not stop the consumer

    # ── Per-topic handlers ────────────────────────────────────────────────────

    async def _handle_gps(self, raw: dict) -> None:
        """
        GPS events are the most frequent — keep this handler fast.
        1. Validate schema
        2. Update Redis position cache
        3. Build features for ML
        4. Trigger risk scoring (imported lazily to avoid circular import)
        """
        event = GPSEvent(**raw)

        # Update hot cache — this is what the map reads
        await redis_client.set_vehicle_position(event.vehicle_id, {
            "vehicle_id": event.vehicle_id,
            "latitude": event.latitude,
            "longitude": event.longitude,
            "speed_kmh": event.speed_kmh,
            "heading_degrees": event.heading_degrees,
            "status": event.status,
            "fuel_level_pct": event.fuel_level_pct,
            "timestamp": event.timestamp.isoformat(),
        })

        # Build ML features from this GPS event
        features = await _feature_builder.build_gps_features(event)

        # Trigger risk scoring pipeline (Phase 2 will flesh this out)
        await _trigger_risk_pipeline(event.vehicle_id, features, event)

    async def _handle_weather(self, raw: dict) -> None:
        """
        Weather events affect risk scores for all vehicles in the region.
        Store in Redis so risk scorer can look up active weather.
        """
        event = WeatherEvent(**raw)

        await redis_client.set_active_weather(event.region_id, {
            "region_id": event.region_id,
            "severity": event.severity,
            "severity_score": event.severity_score,
            "condition": event.condition,
            "affected_hub_ids": event.affected_hub_ids,
            "latitude": event.latitude,
            "longitude": event.longitude,
            "radius_km": event.radius_km,
            "expected_duration_minutes": event.expected_duration_minutes,
            "timestamp": event.timestamp.isoformat(),
        })

        logger.info(
            f"Weather event: {event.condition} severity={event.severity_score:.2f} "
            f"region={event.region_id}"
        )

    async def _handle_order(self, raw: dict) -> None:
        """
        Order events update SLA criticality.
        We store the latest order state so the risk scorer has fresh SLA data.
        """
        event = OrderEvent(**raw)

        # Cache SLA criticality for this shipment
        redis = redis_client.get_redis()
        await redis.setex(
            f"shipment:sla:{event.shipment_id}",
            3600,
            json.dumps({
                "shipment_id": event.shipment_id,
                "sla_criticality": event.sla_criticality,
                "priority": event.priority,
                "sla_deadline": event.sla_deadline.isoformat(),
                "status": event.status,
                "vehicle_id": event.vehicle_id,
            }),
        )

        logger.debug(
            f"Order event: {event.order_id} status={event.status} "
            f"sla_criticality={event.sla_criticality:.3f}"
        )

    async def _handle_warehouse(self, raw: dict) -> None:
        """
        Warehouse events update hub congestion scores.
        High congestion → vehicles should route away from that hub.
        """
        event = WarehouseEvent(**raw)

        await redis_client.set_hub_congestion(
            event.hub_id, event.congestion_score
        )

        logger.debug(
            f"Warehouse event: hub={event.hub_id} "
            f"congestion={event.congestion_score:.2f} "
            f"type={event.warehouse_event_type}"
        )


# ── Risk pipeline trigger ─────────────────────────────────────────────────────

async def _trigger_risk_pipeline(
    vehicle_id: str,
    features: dict,
    event: GPSEvent,
) -> None:
    """
    Calls the risk scoring pipeline after every GPS event.
    In Phase 2, this will call XGBoost + IsolationForest + RiskScorer.
    In Phase 1, we store a placeholder so the consumer is runnable.
    """
    try:
        # Phase 2 will replace this import with real model calls
        from app.services.prediction.risk_scorer import compute_risk_score
        risk_data = await compute_risk_score(vehicle_id, features)
        await redis_client.set_vehicle_risk(vehicle_id, risk_data)
    except ImportError:
        # Phase 1 fallback — risk scorer not yet implemented
        pass
    except Exception as e:
        logger.error(f"Risk pipeline error for {vehicle_id}: {e}")


# ── Module-level singleton ────────────────────────────────────────────────────

consumer = KafkaEventConsumer()