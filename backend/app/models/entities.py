"""
SQLAlchemy async ORM models for core business entities.

Tables:
  hubs        — Warehouses / distribution centres
  vehicles    — Delivery fleet
  shipments   — Individual delivery jobs
  routes      — Assigned route for each vehicle at a point in time

PostGIS Geography columns are used for lat/lon so we can run
ST_Distance, ST_DWithin, and ST_AsGeoJSON queries in Phase 3.
"""

from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import (
    String, Float, Integer, Boolean, DateTime, Text,
    ForeignKey, Index, Enum as SAEnum
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY


def new_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ── Hub ───────────────────────────────────────────────────────────────────────

class Hub(Base):
    """
    A warehouse or distribution centre.
    Vehicles start and end routes at hubs.
    """
    __tablename__ = "hubs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    city: Mapped[str] = mapped_column(String(64), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    capacity_vehicles: Mapped[int] = mapped_column(Integer, default=20)
    dock_count: Mapped[int] = mapped_column(Integer, default=5)
    congestion_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    vehicles: Mapped[list["Vehicle"]] = relationship(
        "Vehicle", back_populates="current_hub", foreign_keys="Vehicle.current_hub_id"
    )

    def __repr__(self) -> str:
        return f"<Hub {self.name} ({self.city})>"


# ── Vehicle ───────────────────────────────────────────────────────────────────

class Vehicle(Base):
    """
    A delivery vehicle in the fleet.
    Position is updated every GPS tick and cached in Redis for speed.
    """
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    registration: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    vehicle_type: Mapped[str] = mapped_column(
        SAEnum("truck", "van", "bike", name="vehicle_type_enum"),
        default="truck"
    )
    capacity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    capacity_m3: Mapped[float] = mapped_column(Float, nullable=False)

    # Current state
    latitude: Mapped[float] = mapped_column(Float, default=0.0)
    longitude: Mapped[float] = mapped_column(Float, default=0.0)
    speed_kmh: Mapped[float] = mapped_column(Float, default=0.0)
    heading_degrees: Mapped[float] = mapped_column(Float, default=0.0)
    fuel_level_pct: Mapped[float] = mapped_column(Float, default=100.0)
    odometer_km: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="idle")

    # Risk state
    current_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0)
    delay_probability: Mapped[float] = mapped_column(Float, default=0.0)

    # Relations
    current_hub_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("hubs.id"), nullable=True
    )
    current_hub: Mapped[Optional["Hub"]] = relationship(
        "Hub", back_populates="vehicles", foreign_keys=[current_hub_id]
    )

    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    shipments: Mapped[list["Shipment"]] = relationship(
        "Shipment", back_populates="vehicle"
    )

    __table_args__ = (
        Index("ix_vehicles_status", "status"),
        Index("ix_vehicles_risk_score", "current_risk_score"),
    )

    def __repr__(self) -> str:
        return f"<Vehicle {self.registration} risk={self.current_risk_score:.2f}>"


# ── Shipment ──────────────────────────────────────────────────────────────────

class Shipment(Base):
    """
    A delivery job: one or more items going from origin hub to destination hub.
    Each shipment has an SLA deadline and a priority level.
    """
    __tablename__ = "shipments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    order_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    customer_id: Mapped[str] = mapped_column(String(36), nullable=False)

    origin_hub_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hubs.id"), nullable=False
    )
    destination_hub_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hubs.id"), nullable=False
    )

    vehicle_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("vehicles.id"), nullable=True
    )
    vehicle: Mapped[Optional["Vehicle"]] = relationship(
        "Vehicle", back_populates="shipments"
    )

    # Cargo specs
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    volume_m3: Mapped[float] = mapped_column(Float, nullable=False)
    requires_refrigeration: Mapped[bool] = mapped_column(Boolean, default=False)
    estimated_value_inr: Mapped[float] = mapped_column(Float, default=0.0)

    # SLA
    sla_deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=3)  # 1–5
    sla_criticality: Mapped[float] = mapped_column(Float, default=0.0)

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), default="created")
    # planned_eta is our XGBoost prediction; actual_eta is updated as vehicle moves
    planned_eta: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_eta: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    picked_up_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_shipments_status", "status"),
        Index("ix_shipments_sla_deadline", "sla_deadline"),
        Index("ix_shipments_priority", "priority"),
    )

    def __repr__(self) -> str:
        return f"<Shipment {self.id[:8]} priority={self.priority} status={self.status}>"


# ── Route ─────────────────────────────────────────────────────────────────────

class Route(Base):
    """
    The currently assigned route for a vehicle.
    Updated by OR-Tools optimizer whenever a reroute decision is made.
    waypoints is a JSONB array of {lat, lon, hub_id, eta} objects.
    """
    __tablename__ = "routes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    vehicle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("vehicles.id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Waypoints stored as JSONB: [{lat, lon, hub_id, arrival_eta, departure_eta}]
    waypoints: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)

    # Shipment IDs assigned to this route in stop order
    shipment_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # Pre-optimization values (for before/after ETA comparison in UI)
    original_eta_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    optimized_eta_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eta_saved_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    total_distance_km: Mapped[float] = mapped_column(Float, default=0.0)
    total_duration_minutes: Mapped[float] = mapped_column(Float, default=0.0)

    # Why this route was generated
    trigger_reason: Mapped[str] = mapped_column(String(256), default="initial")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_routes_vehicle_active", "vehicle_id", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<Route v{self.version} vehicle={self.vehicle_id[:8]}>"