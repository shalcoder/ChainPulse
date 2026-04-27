"""
Output models — what the system produces.

RouteDecision  — stored whenever OR-Tools generates a new route
RiskAlert      — stored whenever a vehicle crosses a risk threshold
AuditRecord    — append-only log of every decision with reason codes
                 This is what judges see on the audit trail page.
"""

from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from app.models.entities import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


# ── Route Decision ────────────────────────────────────────────────────────────

class RouteDecision(Base):
    """
    Stored every time OR-Tools produces a new route for a vehicle.
    Contains before/after ETA so the UI can show "saved X minutes".
    """
    __tablename__ = "route_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    vehicle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("vehicles.id"), nullable=False
    )
    route_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("routes.id"), nullable=False
    )

    # What triggered this optimization
    trigger_event_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    trigger_reason: Mapped[str] = mapped_column(String(256), nullable=False)
    # Human-readable reason code shown in UI and audit trail
    # e.g. "HIGH_RISK_WEATHER_PLUS_CONGESTION", "ANOMALY_GPS_JUMP"
    reason_code: Mapped[str] = mapped_column(String(64), nullable=False)

    # Before optimization
    previous_route_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    previous_eta_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # After optimization
    new_eta_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eta_saved_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Risk snapshot at time of decision
    risk_score_at_decision: Mapped[float] = mapped_column(Float, nullable=False)
    delay_probability: Mapped[float] = mapped_column(Float, default=0.0)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0)
    sla_criticality: Mapped[float] = mapped_column(Float, default=0.0)
    weather_severity: Mapped[float] = mapped_column(Float, default=0.0)

    # Full decision payload for frontend (waypoints, instructions)
    decision_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Execution tracking
    was_executed: Mapped[bool] = mapped_column(Boolean, default=False)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_route_decisions_vehicle", "vehicle_id"),
        Index("ix_route_decisions_created", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<RouteDecision {self.reason_code} "
            f"vehicle={self.vehicle_id[:8]} "
            f"saved={self.eta_saved_minutes}min>"
        )


# ── Risk Alert ────────────────────────────────────────────────────────────────

class RiskAlert(Base):
    """
    Generated whenever a vehicle's risk score crosses a threshold.
    HIGH alerts trigger automatic re-optimization.
    MEDIUM alerts are shown in the feed but don't trigger optimization.
    """
    __tablename__ = "risk_alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    vehicle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("vehicles.id"), nullable=False
    )
    shipment_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    alert_level: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # "HIGH", "MEDIUM", "LOW"
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Component scores for explainability
    delay_probability: Mapped[float] = mapped_column(Float, default=0.0)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0)
    sla_criticality: Mapped[float] = mapped_column(Float, default=0.0)
    weather_severity: Mapped[float] = mapped_column(Float, default=0.0)

    # What specifically caused this alert
    alert_reason: Mapped[str] = mapped_column(String(512), nullable=False)
    triggered_by_event_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Was this alert actioned?
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolution_decision_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_risk_alerts_vehicle", "vehicle_id"),
        Index("ix_risk_alerts_level", "alert_level"),
        Index("ix_risk_alerts_resolved", "resolved"),
    )

    def __repr__(self) -> str:
        return f"<RiskAlert {self.alert_level} score={self.risk_score:.3f}>"


# ── Audit Record ──────────────────────────────────────────────────────────────

class AuditRecord(Base):
    """
    Append-only audit log. Every meaningful system action is recorded here.
    This is the explainability layer judges see on the audit trail page.

    action_type values:
      EVENT_RECEIVED    — Kafka event ingested
      RISK_SCORED       — Risk score computed for vehicle
      ALERT_GENERATED   — Risk threshold crossed
      OPTIMIZATION_RUN  — OR-Tools solver called
      ROUTE_PUBLISHED   — New route sent to vehicle
      ANOMALY_DETECTED  — IsolationForest flagged anomaly
    """
    __tablename__ = "audit_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    action_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor: Mapped[str] = mapped_column(String(64), default="system")

    # What entity this action is about
    vehicle_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    shipment_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    route_decision_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Human-readable summary shown in the audit trail UI
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    # Full context as JSON (event payload, scores, solver output, etc.)
    context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Severity for UI colouring: INFO, WARNING, CRITICAL
    severity: Mapped[str] = mapped_column(String(10), default="INFO")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_audit_records_created", "created_at"),
        Index("ix_audit_records_action_type", "action_type"),
        Index("ix_audit_records_vehicle", "vehicle_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditRecord {self.action_type} {self.summary[:40]}>"