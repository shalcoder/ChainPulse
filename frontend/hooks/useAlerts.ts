"use client";

import { useEffect, useState } from "react";
import { RiskAlert, RouteDecision, WebSocketMessage } from "@/types";

export function useAlerts(lastMessage: WebSocketMessage | null) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [decisions, setDecisions] = useState<RouteDecision[]>([]);
  const [reroutes, setReroutes] = useState(0);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "RISK_ALERT") {
      const alert = lastMessage.payload as RiskAlert;
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
    }

    if (lastMessage.type === "ROUTE_DECISION") {
      const decision = lastMessage.payload as RouteDecision;
      setDecisions((prev) => [decision, ...prev].slice(0, 20));
      setReroutes((prev) => prev + 1);

      // Also create a synthetic alert from the decision
      const syntheticAlert: RiskAlert = {
        alert_id: decision.decision_id,
        timestamp: decision.timestamp,
        vehicle_id: decision.vehicle_id,
        risk_level: decision.risk_level,
        risk_score: decision.risk_score,
        reason_code: decision.reason_code,
        message: decision.reason_description,
        acknowledged: false,
      };
      setAlerts((prev) => [syntheticAlert, ...prev].slice(0, 50));
    }
  }, [lastMessage]);

  return { alerts, decisions, reroutes };
}