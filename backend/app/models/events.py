"""
Pydantic event schemas for all Kafka message types.

Every message on every Kafka topic is validated against one of these schemas
before it enters the processing pipeline. This gives us:
  - Type safety throughout the codebase
  - Automatic rejection of malformed events
  - Clear documentation of exactly what each event contains

Event hierarchy:
  BaseEvent
  ├── GPSEvent         (topic: gps-updates)
  ├── WeatherEvent     (topic: weather-alerts)
  ├── OrderEvent       (topic: order-events)
  └── WarehouseEvent   (topic: warehouse-events)
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator


# ── Enumerations ──────────────────────────────────────────────────────────────

class EventType(str, Enum):
    GPS = "gps"
    WEATHER = "weather"
    ORDER = "order"
    WAREHOUSE = "warehouse"


class VehicleStatus(str, Enum):
    MOVING = "moving"
    IDLE = "idle"
    LOADING = "loading"
    UNLOADING = "unloading"
    BREAKDOWN = "breakdown"
    REROUTING = "rerouting"


class WeatherSeverity(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class OrderStatus(str, Enum):
    CREATED = "created"
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WarehouseEventType(str, Enum):
    SCAN_IN = "scan_in"
    SCAN_OUT = "scan_out"
    CONGESTION = "congestion"
    CAPACITY_WARNING = "capacity_warning"
    DOCK_BLOCKED = "dock_blocked"


# ── Base Event ────────────────────────────────────────────────────────────────

class BaseEvent(BaseModel):
    """All Kafka events share these fields."""
    event_id: str = Field(..., description="Unique event identifier (UUID)")
    event_type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(default="simulator", description="Origin of the event")

    model_config = {"use_enum_values": True}


# ── GPS Event ─────────────────────────────────────────────────────────────────

class GPSEvent(BaseEvent):
    """
    Published every GPS_UPDATE_INTERVAL_SECONDS by each vehicle.
    This is the highest-volume event type (20 vehicles × 0.5 Hz = 10 msg/s).
    """
    event_type: EventType = EventType.GPS
    vehicle_id: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    speed_kmh: float = Field(..., ge=0.0, le=200.0)
    heading_degrees: float = Field(..., ge=0.0, le=360.0)
    status: VehicleStatus = VehicleStatus.MOVING
    fuel_level_pct: float = Field(..., ge=0.0, le=100.0)
    odometer_km: float = Field(..., ge=0.0)
    current_hub_id: Optional[str] = None
    destination_hub_id: Optional[str] = None
    active_shipment_ids: list[str] = Field(default_factory=list)

    @field_validator("speed_kmh")
    @classmethod
    def speed_must_be_zero_when_not_moving(cls, v: float) -> float:
        # We allow this — the consumer will flag inconsistencies as anomalies
        return round(v, 2)


# ── Weather Event ─────────────────────────────────────────────────────────────

class WeatherEvent(BaseEvent):
    """
    Published when weather conditions change in a region.
    Low volume but high impact — directly affects risk scores.
    """
    event_type: EventType = EventType.WEATHER
    region_id: str
    condition: str = Field(..., description="e.g. heavy_rain, fog, cyclone")
    severity: WeatherSeverity
    severity_score: float = Field(..., ge=0.0, le=1.0,
                                   description="0.0=clear, 1.0=impassable")
    affected_hub_ids: list[str] = Field(default_factory=list)
    affected_route_ids: list[str] = Field(default_factory=list)
    wind_speed_kmh: float = Field(default=0.0, ge=0.0)
    visibility_km: float = Field(default=10.0, ge=0.0)
    expected_duration_minutes: int = Field(default=60, ge=0)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: float = Field(default=50.0, ge=0.0)


# ── Order Event ───────────────────────────────────────────────────────────────

class OrderEvent(BaseEvent):
    """
    Published on order lifecycle transitions.
    Used to update SLA criticality scores.
    """
    event_type: EventType = EventType.ORDER
    order_id: str
    shipment_id: str
    status: OrderStatus
    vehicle_id: Optional[str] = None
    origin_hub_id: str
    destination_hub_id: str
    sla_deadline: datetime
    priority: int = Field(..., ge=1, le=5,
                           description="1=lowest, 5=highest (emergency)")
    weight_kg: float = Field(..., ge=0.0)
    volume_m3: float = Field(..., ge=0.0)
    requires_refrigeration: bool = False
    customer_id: str = ""
    estimated_value_inr: float = Field(default=0.0, ge=0.0)

    @property
    def sla_criticality(self) -> float:
        """
        Compute SLA criticality score 0.0–1.0.
        Higher = deadline is closer AND priority is higher.
        """
        now = datetime.utcnow()
        hours_remaining = max(0, (self.sla_deadline - now).total_seconds() / 3600)
        # Normalize: 0 hours = 1.0, 24+ hours = 0.0
        time_score = max(0.0, 1.0 - (hours_remaining / 24.0))
        priority_score = (self.priority - 1) / 4.0  # 1→0.0, 5→1.0
        return round(0.6 * time_score + 0.4 * priority_score, 4)


# ── Warehouse Event ───────────────────────────────────────────────────────────

class WarehouseEvent(BaseEvent):
    """
    Published when activity occurs at a hub/warehouse.
    Congestion events raise hub_congestion_score, which affects routing.
    """
    event_type: EventType = EventType.WAREHOUSE
    hub_id: str
    warehouse_event_type: WarehouseEventType
    shipment_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    congestion_score: float = Field(default=0.0, ge=0.0, le=1.0,
                                     description="0.0=empty, 1.0=fully blocked")
    capacity_used_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    dock_count_available: int = Field(default=5, ge=0)
    estimated_wait_minutes: int = Field(default=0, ge=0)
    notes: str = ""


# ── Union type for dispatcher ─────────────────────────────────────────────────

AnyEvent = GPSEvent | WeatherEvent | OrderEvent | WarehouseEvent


def parse_event(raw: dict[str, Any]) -> AnyEvent:
    """
    Route a raw Kafka message dict to the correct typed schema.
    Called by kafka_consumer.py on every incoming message.

    Raises ValueError if event_type is unknown or validation fails.
    """
    event_type = raw.get("event_type")
    dispatch = {
        EventType.GPS: GPSEvent,
        EventType.WEATHER: WeatherEvent,
        EventType.ORDER: OrderEvent,
        EventType.WAREHOUSE: WarehouseEvent,
    }
    schema_class = dispatch.get(event_type)
    if schema_class is None:
        raise ValueError(f"Unknown event_type: {event_type!r}")
    return schema_class(**raw)