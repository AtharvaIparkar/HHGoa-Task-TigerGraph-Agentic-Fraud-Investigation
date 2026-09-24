"""
mock-action-service/main.py
============================
Mock Action Service — simple FastAPI stub that simulates the real downstream
action systems (account management, refund processor, CRM, messaging).

Security contract:
  - Every request MUST include: Authorization: Bearer <token>
  - Every request MUST include: approval_event_id in the request body
  - Requests missing either are rejected with 401/422
  - All accepted actions are appended to action_log.json (append-only audit)

Endpoints:
  POST /freeze-account
  POST /refund-transaction
  POST /send-customer-message
  POST /update-crm
  GET  /health
  GET  /action-log  (dev only — view the log)
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import structlog
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ─── Setup ────────────────────────────────────────────────────────────────────
log = structlog.get_logger(__name__)

LOG_FILE = Path(__file__).parent / "action_log.json"
VALID_TOKEN = os.environ.get("MOCK_ACTION_SERVICE_TOKEN", "mock-bearer-token-dev-only")

app = FastAPI(
    title="Mock Action Service",
    description="Stub downstream action service for fraud investigation hackathon",
    version="0.1.0",
)

security = HTTPBearer()


# ─── Auth helper ──────────────────────────────────────────────────────────────

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if credentials.credentials != VALID_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="Invalid bearer token. Set MOCK_ACTION_SERVICE_TOKEN env var.",
        )
    return credentials.credentials


# ─── Logging helper ───────────────────────────────────────────────────────────

def _append_log(entry: dict) -> None:
    """Append an action record to the JSON log file (one JSON object per line)."""
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def _make_response(
    action_type: str,
    approval_event_id: str,
    payload: dict,
    extra: Optional[dict] = None,
) -> dict:
    entry = {
        "event_id":         str(uuid.uuid4()),
        "action_type":      action_type,
        "approval_event_id": approval_event_id,
        "timestamp":        datetime.utcnow().isoformat(),
        "status":           "executed",
        "payload":          payload,
        **(extra or {}),
    }
    _append_log(entry)
    log.info("action_executed", action=action_type, approval=approval_event_id)
    return entry


# ─── Request models ───────────────────────────────────────────────────────────

class FreezeAccountRequest(BaseModel):
    approval_event_id: str
    customer_id:       str
    reason:            str
    case_id:           str


class RefundTransactionRequest(BaseModel):
    approval_event_id: str
    transaction_id:    str
    amount:            float
    currency:          str = "INR"
    reason:            str
    case_id:           str


class SendCustomerMessageRequest(BaseModel):
    approval_event_id: str
    customer_id:       str
    message_type:      str   # fraud_alert | verification | info | apology
    case_id:           str
    custom_message:    Optional[str] = None


class UpdateCRMRequest(BaseModel):
    approval_event_id: str
    customer_id:       str
    case_id:           str
    risk_score:        float
    decision:          str
    notes:             Optional[str] = None


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "service": "mock-action-service", "version": "0.1.0"}


# ─── Action endpoints ─────────────────────────────────────────────────────────

@app.post("/freeze-account", tags=["Actions"])
async def freeze_account(
    body: FreezeAccountRequest,
    _token: str = Depends(verify_token),
):
    """
    Freeze a customer account. Requires bearer token + approval_event_id.
    In production, this would call the core banking system.
    """
    return _make_response(
        action_type="freeze_account",
        approval_event_id=body.approval_event_id,
        payload=body.model_dump(),
        extra={
            "result": {
                "account_frozen": True,
                "frozen_at": datetime.utcnow().isoformat(),
                "customer_id": body.customer_id,
                "notification_sent": True,
            }
        },
    )


@app.post("/refund-transaction", tags=["Actions"])
async def refund_transaction(
    body: RefundTransactionRequest,
    _token: str = Depends(verify_token),
):
    """
    Initiate a refund for a disputed transaction.
    """
    return _make_response(
        action_type="refund_transaction",
        approval_event_id=body.approval_event_id,
        payload=body.model_dump(),
        extra={
            "result": {
                "refund_initiated": True,
                "refund_reference": f"REF-{uuid.uuid4().hex[:10].upper()}",
                "amount": body.amount,
                "currency": body.currency,
                "eta_days": 3,
            }
        },
    )


@app.post("/send-customer-message", tags=["Actions"])
async def send_customer_message(
    body: SendCustomerMessageRequest,
    _token: str = Depends(verify_token),
):
    """
    Send a notification message to a customer (SMS/email/push).
    """
    templates = {
        "fraud_alert":    "We have detected suspicious activity on your account and are investigating.",
        "verification":   "Please verify your recent transaction by contacting us.",
        "info":           "Your account is currently under review. No action needed from you.",
        "apology":        "We apologise for any inconvenience. Your account has been restored.",
    }
    message = body.custom_message or templates.get(body.message_type, "Important account update.")

    return _make_response(
        action_type="send_customer_message",
        approval_event_id=body.approval_event_id,
        payload=body.model_dump(),
        extra={
            "result": {
                "message_sent": True,
                "channel": "sms+email",
                "message_preview": message[:100],
                "sent_at": datetime.utcnow().isoformat(),
            }
        },
    )


@app.post("/update-crm", tags=["Actions"])
async def update_crm(
    body: UpdateCRMRequest,
    _token: str = Depends(verify_token),
):
    """
    Update the customer's risk profile in the CRM system.
    """
    return _make_response(
        action_type="update_crm",
        approval_event_id=body.approval_event_id,
        payload=body.model_dump(),
        extra={
            "result": {
                "crm_updated": True,
                "customer_id": body.customer_id,
                "new_risk_score": body.risk_score,
                "decision_recorded": body.decision,
                "updated_at": datetime.utcnow().isoformat(),
            }
        },
    )


# ─── Dev: view log ────────────────────────────────────────────────────────────

@app.get("/action-log", tags=["Dev"])
async def view_action_log():
    """Returns the full action log (dev only — remove in production)."""
    if not LOG_FILE.exists():
        return {"entries": []}
    entries = []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return {"count": len(entries), "entries": entries}
