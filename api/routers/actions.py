"""
api/routers/actions.py
======================
FastAPI router for action execution, approval, and audit logging.

Endpoints:
  POST /actions/execute          — executes an auto-approved action after policy check
  POST /actions/request-approval — submits an L1/L2 action for approval
  POST /actions/approve          — records an approval event; returns approval_event_id
  GET  /actions/log              — retrieves the action execution log
  GET  /actions/case/{case_id}   — list actions for a specific case
  GET  /actions/{action_id}      — get a specific action record

All actions pass through the PolicyEngine before execution.
Every attempt is logged to api/action_log.jsonl.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

# Import policy engine (tolerates import errors in scaffold mode)
try:
    from api.policy_engine import PolicyEngine, PolicyViolationError
except ImportError:
    try:
        from policy_engine import PolicyEngine, PolicyViolationError  # type: ignore
    except ImportError:
        PolicyEngine = None  # type: ignore
        PolicyViolationError = Exception  # type: ignore

router = APIRouter()

_policy_engine: Optional[Any] = PolicyEngine() if PolicyEngine else None

# ─── Log paths ────────────────────────────────────────────────────────────────
_ACTION_LOG = Path(__file__).parent.parent / "action_log.jsonl"
_APPROVAL_LOG = Path(__file__).parent.parent / "approval_log.jsonl"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _append_jsonl(path: Path, entry: dict) -> None:
    """Append a JSON record to a JSONL file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def _read_jsonl(path: Path) -> List[dict]:
    """Read all records from a JSONL file."""
    if not path.exists():
        return []
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return records


def _approval_exists(approval_event_id: str) -> bool:
    """Check whether an approval_event_id exists in the approval log."""
    records = _read_jsonl(_APPROVAL_LOG)
    return any(r.get("approval_event_id") == approval_event_id for r in records)


# ─── Request / Response models ────────────────────────────────────────────────

class ExecuteActionRequest(BaseModel):
    action: str = Field(..., description="Policy action name, e.g. VERIFY_WITH_CUSTOMER")
    case_id: str = Field(..., description="The fraud case this action belongs to")
    target_entity_id: str = Field("", description="Customer/Card/Device ID this action targets")
    requester: str = Field("agent", description="Who is requesting this action")
    approval_event_id: str = Field("", description="Required for L1/L2 actions")
    exposure_usd: float = Field(0.0, description="Monetary exposure for routing BLOCK_CARD")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Action-specific parameters")


class RequestApprovalRequest(BaseModel):
    action: str
    case_id: str
    target_entity_id: str = ""
    requester: str = "agent"
    exposure_usd: float = 0.0
    justification: str = ""
    payload: Dict[str, Any] = Field(default_factory=dict)


class ApproveActionRequest(BaseModel):
    pending_request_id: str = Field(..., description="ID of the pending approval request")
    action: str
    case_id: str
    approved_by: str = Field(..., description="Analyst/supervisor who is approving")
    approval_route: str = Field(..., description="L1 or L2")
    notes: str = ""


class ActionSummary(BaseModel):
    action_id: str
    action: str
    case_id: str
    status: str
    route: str
    requester: str
    approval_event_id: str
    target_entity_id: str
    permitted: bool
    result: Optional[Dict[str, Any]] = None
    timestamp: str
    error: Optional[str] = None


class ApprovalRecord(BaseModel):
    approval_event_id: str
    pending_request_id: str
    action: str
    case_id: str
    approved_by: str
    approval_route: str
    notes: str
    approved_at: str


class PendingApprovalSummary(BaseModel):
    request_id: str
    action: str
    case_id: str
    route: str
    requester: str
    justification: str
    exposure_usd: float
    requested_at: str
    status: str  # pending | approved | rejected


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/execute", summary="Execute an auto-approved action")
async def execute_action(body: ExecuteActionRequest):
    """
    Executes an action after verifying it is permitted by the policy engine.
    - Auto actions: executed immediately.
    - L1/L2 actions: blocked with 403 if no valid approval_event_id provided.
    Every attempt (permitted or blocked) is logged to api/action_log.jsonl.
    """
    action_id = f"act-{uuid.uuid4().hex[:12]}"
    timestamp = datetime.utcnow().isoformat()

    # ── Policy check ──────────────────────────────────────────────────────────
    if _policy_engine:
        perm = _policy_engine.check_action_permitted(
            action=body.action,
            approval_event_id=body.approval_event_id,
            requester=body.requester,
            exposure_usd=body.exposure_usd,
        )
        permitted = perm.permitted
        route = perm.required_route
        permission_reason = perm.reason
    else:
        # Fallback when policy engine not available
        permitted = True
        route = "auto"
        permission_reason = "Policy engine unavailable — defaulting to permit"

    # For L1/L2 actions: also verify the approval_event_id exists in approval log
    if permitted and route in ("L1", "L2") and body.approval_event_id:
        if not _approval_exists(body.approval_event_id):
            permitted = False
            permission_reason = (
                f"approval_event_id '{body.approval_event_id}' not found in approval log; "
                "action blocked"
            )

    # ── Build log entry ───────────────────────────────────────────────────────
    log_entry = {
        "action_id":         action_id,
        "timestamp":         timestamp,
        "action":            body.action,
        "case_id":           body.case_id,
        "route":             route,
        "requester":         body.requester,
        "approval_event_id": body.approval_event_id or "",
        "target_entity_id":  body.target_entity_id,
        "permitted":         permitted,
        "result":            None,
        "error":             None,
    }

    if not permitted:
        log_entry["error"] = permission_reason
        _append_jsonl(_ACTION_LOG, log_entry)
        raise HTTPException(
            status_code=403,
            detail={
                "error":           "POLICY_VIOLATION",
                "message":         permission_reason,
                "required_route":  route,
                "action":          body.action,
                "policy_citation": "Section 2: Approval Routing",
                "timestamp":       timestamp,
            },
        )

    # ── Simulate execution (real implementation calls Mock Action Service) ────
    result = {
        "status":      "executed",
        "action_id":   action_id,
        "executed_at": timestamp,
        "action":      body.action,
        "case_id":     body.case_id,
        "payload":     body.payload,
    }
    log_entry["result"] = result
    _append_jsonl(_ACTION_LOG, log_entry)

    return {
        "action_id":   action_id,
        "action":      body.action,
        "case_id":     body.case_id,
        "status":      "executed",
        "route":       route,
        "permitted":   True,
        "result":      result,
        "timestamp":   timestamp,
    }


@router.post("/request-approval", summary="Submit an L1/L2 action for approval")
async def request_approval(body: RequestApprovalRequest):
    """
    Submits an L1 or L2 action for human approval.
    Returns a request_id that can be referenced when calling /approve.
    """
    if _policy_engine:
        try:
            route = _policy_engine.get_approval_route(body.action, body.exposure_usd)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    else:
        route = "L1"

    if route == "auto":
        raise HTTPException(
            status_code=400,
            detail=f"Action '{body.action}' is auto-approved and does not need an approval request.",
        )

    request_id = f"req-{uuid.uuid4().hex[:12]}"
    timestamp = datetime.utcnow().isoformat()

    record = {
        "request_id":      request_id,
        "action":          body.action,
        "case_id":         body.case_id,
        "route":           route,
        "requester":       body.requester,
        "target_entity_id": body.target_entity_id,
        "exposure_usd":    body.exposure_usd,
        "justification":   body.justification,
        "payload":         body.payload,
        "status":          "pending",
        "requested_at":    timestamp,
    }

    _append_jsonl(Path(__file__).parent.parent / "approval_requests.jsonl", record)

    return {
        "request_id":  request_id,
        "action":      body.action,
        "case_id":     body.case_id,
        "route":       route,
        "status":      "pending",
        "message":     f"Approval request submitted. A {route} reviewer must call /actions/approve.",
        "requested_at": timestamp,
    }


@router.post("/approve", summary="Record an approval event", response_model=ApprovalRecord)
async def approve_action(body: ApproveActionRequest):
    """
    Records a human approval event and returns an approval_event_id.
    This ID must be provided when executing the approved action via /execute.
    """
    approval_event_id = f"apv-{uuid.uuid4().hex[:16]}"
    approved_at = datetime.utcnow().isoformat()

    record = {
        "approval_event_id":  approval_event_id,
        "pending_request_id": body.pending_request_id,
        "action":             body.action,
        "case_id":            body.case_id,
        "approved_by":        body.approved_by,
        "approval_route":     body.approval_route,
        "notes":              body.notes,
        "approved_at":        approved_at,
    }
    _append_jsonl(_APPROVAL_LOG, record)

    return ApprovalRecord(**record)


@router.get("/log", summary="Retrieve action execution log")
async def get_action_log(
    case_id: Optional[str] = Query(None, description="Filter by case ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    permitted_only: bool = Query(False, description="Return only permitted actions"),
    limit: int = Query(200, ge=1, le=1000),
):
    """
    Returns the action execution log, optionally filtered.
    """
    records = _read_jsonl(_ACTION_LOG)

    if case_id:
        records = [r for r in records if r.get("case_id") == case_id]
    if action:
        records = [r for r in records if r.get("action") == action]
    if permitted_only:
        records = [r for r in records if r.get("permitted", False)]

    records = records[-limit:]  # most recent first after slicing
    records.reverse()

    return {
        "count":   len(records),
        "entries": records,
    }


@router.get("/case/{case_id}", response_model=List[ActionSummary], summary="List actions for a case")
async def list_case_actions(case_id: str):
    """Returns all action execution attempts (permitted and blocked) for a fraud case."""
    records = _read_jsonl(_ACTION_LOG)
    case_records = [r for r in records if r.get("case_id") == case_id]

    return [
        ActionSummary(
            action_id=r.get("action_id", ""),
            action=r.get("action", ""),
            case_id=r.get("case_id", ""),
            status=r.get("result", {}).get("status", "blocked") if r.get("result") else "blocked",
            route=r.get("route", ""),
            requester=r.get("requester", ""),
            approval_event_id=r.get("approval_event_id", ""),
            target_entity_id=r.get("target_entity_id", ""),
            permitted=r.get("permitted", False),
            result=r.get("result"),
            timestamp=r.get("timestamp", ""),
            error=r.get("error"),
        )
        for r in case_records
    ]


@router.get("/approvals", summary="List pending approval requests")
async def list_approvals(
    status: Optional[str] = Query(None, description="Filter by status: pending|approved"),
    case_id: Optional[str] = Query(None),
):
    """Returns approval requests."""
    records = _read_jsonl(Path(__file__).parent.parent / "approval_requests.jsonl")
    if status:
        records = [r for r in records if r.get("status") == status]
    if case_id:
        records = [r for r in records if r.get("case_id") == case_id]
    return {"count": len(records), "entries": records}


@router.get("/{action_id}", response_model=ActionSummary, summary="Get action details")
async def get_action(action_id: str):
    """Returns details of a specific action record."""
    records = _read_jsonl(_ACTION_LOG)
    for r in records:
        if r.get("action_id") == action_id:
            return ActionSummary(
                action_id=r.get("action_id", ""),
                action=r.get("action", ""),
                case_id=r.get("case_id", ""),
                status=r.get("result", {}).get("status", "blocked") if r.get("result") else "blocked",
                route=r.get("route", ""),
                requester=r.get("requester", ""),
                approval_event_id=r.get("approval_event_id", ""),
                target_entity_id=r.get("target_entity_id", ""),
                permitted=r.get("permitted", False),
                result=r.get("result"),
                timestamp=r.get("timestamp", ""),
                error=r.get("error"),
            )
    raise HTTPException(status_code=404, detail=f"Action {action_id} not found")
