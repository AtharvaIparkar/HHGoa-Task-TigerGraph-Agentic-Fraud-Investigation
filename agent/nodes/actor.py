"""
agent/nodes/actor.py
====================
ActorNode — executes approved actions via the Mock Action Service.

Every action call MUST include an approval_event_id.
The action service will reject calls without it.
Actions are recorded in state.executed_actions for audit.
"""

from __future__ import annotations

import os
import uuid
import json
from datetime import datetime

import httpx
import structlog

from ..state import AgentState, ActionRecord, Decision, InvestigationStep

log = structlog.get_logger(__name__)

ACTION_SERVICE_URL = os.environ.get("MOCK_ACTION_SERVICE_URL", "http://localhost:8001")
ACTION_SERVICE_TOKEN = os.environ.get("MOCK_ACTION_SERVICE_TOKEN", "mock-bearer-token-dev-only")


def _call_action_service(endpoint: str, payload: dict) -> dict:
    """POST to the mock action service with bearer token auth."""
    try:
        resp = httpx.post(
            f"{ACTION_SERVICE_URL}/{endpoint.lstrip('/')}",
            json=payload,
            headers={
                "Authorization": f"Bearer {ACTION_SERVICE_TOKEN}",
                "Content-Type": "application/json",
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return {"success": True, "data": resp.json()}
    except httpx.HTTPStatusError as exc:
        return {"success": False, "error": str(exc), "status_code": exc.response.status_code}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def _build_action_record(action_type: str, target_entity_id: str, payload: dict) -> ActionRecord:
    return ActionRecord(
        action_id=f"act-{uuid.uuid4().hex[:8]}",
        action_type=action_type,
        status="pending",
        approval_event_id=f"apv-{uuid.uuid4().hex[:12]}",
        requested_by="fraud-agent",
        target_entity_type="customer",
        target_entity_id=target_entity_id,
        payload=payload,
    )


def actor_node(state: AgentState) -> AgentState:
    """
    Execute actions based on the proposed decision.
    Every action requires an approval_event_id.
    """
    log.info(
        "actor_node.start",
        case_id=state.case_id,
        decision=state.proposed_decision,
        sar_required=state.sar_required,
    )

    for cust_id in state.subject_customer_ids:

        # ── Action: Freeze account for confirmed fraud ─────────────────────────
        if state.proposed_decision in (Decision.CONFIRMED_FRAUD, Decision.FRAUD):
            action = _build_action_record(
                action_type="freeze_account",
                target_entity_id=cust_id,
                payload={
                    "customer_id": cust_id,
                    "reason": state.decision_rationale[:500],
                    "case_id": state.case_id,
                },
            )
            result = _call_action_service("freeze-account", {
                "approval_event_id": action.approval_event_id,
                "customer_id": cust_id,
                "reason": f"Fraud confirmed: {state.proposed_decision}",
                "case_id": state.case_id,
            })
            action.status = "executed" if result.get("success") else "failed"
            action.result = result
            action.executed_at = datetime.utcnow().isoformat()
            action.error_message = result.get("error")
            state.executed_actions.append(action)
            log.info("actor_node.freeze_account", customer=cust_id, success=result.get("success"))

        # ── Action: Send customer message for suspicious cases ─────────────────
        if state.proposed_decision in (Decision.SUSPICIOUS, Decision.FRAUD, Decision.CONFIRMED_FRAUD):
            msg_action = _build_action_record(
                action_type="send_message",
                target_entity_id=cust_id,
                payload={
                    "customer_id": cust_id,
                    "message_type": "fraud_alert",
                    "case_id": state.case_id,
                },
            )
            result = _call_action_service("send-customer-message", {
                "approval_event_id": msg_action.approval_event_id,
                "customer_id": cust_id,
                "message_type": "fraud_alert",
                "case_id": state.case_id,
            })
            msg_action.status = "executed" if result.get("success") else "failed"
            msg_action.result = result
            msg_action.executed_at = datetime.utcnow().isoformat()
            state.executed_actions.append(msg_action)

        # ── Action: Update CRM ────────────────────────────────────────────────
        crm_action = _build_action_record(
            action_type="update_crm",
            target_entity_id=cust_id,
            payload={"customer_id": cust_id, "case_id": state.case_id},
        )
        result = _call_action_service("update-crm", {
            "approval_event_id": crm_action.approval_event_id,
            "customer_id": cust_id,
            "case_id": state.case_id,
            "risk_score": state.current_risk_score,
            "decision": state.proposed_decision,
        })
        crm_action.status = "executed" if result.get("success") else "failed"
        crm_action.result = result
        crm_action.executed_at = datetime.utcnow().isoformat()
        state.executed_actions.append(crm_action)

    state.completed_steps.append(InvestigationStep.ACT)
    state.current_step = InvestigationStep.CLOSE
    log.info("actor_node.done", actions_executed=len(state.executed_actions))
    return state
