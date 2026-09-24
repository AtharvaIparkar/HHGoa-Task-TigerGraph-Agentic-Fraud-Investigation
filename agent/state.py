"""
agent/state.py
==============
Pydantic models for LangGraph state machine state.
All inter-node communication happens through AgentState.
"""

from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────

class InvestigationStep(str, Enum):
    PLAN          = "plan"
    FETCH_HISTORY = "fetch_history"
    EXPAND_GRAPH  = "expand_graph"
    DETECT_RINGS  = "detect_rings"
    CHECK_VELOCITY= "check_velocity"
    MEMORY_LOOKUP = "memory_lookup"
    EXTRACT_CASE  = "extract_case"
    GATE_CHECK    = "gate_check"
    ACT           = "act"
    CLOSE         = "close"
    ERROR         = "error"


class Decision(str, Enum):
    PENDING          = "pending"
    CLEAR            = "clear"
    SUSPICIOUS       = "suspicious"
    FRAUD            = "fraud"
    CONFIRMED_FRAUD  = "confirmed_fraud"


class CaseStatus(str, Enum):
    OPEN          = "open"
    INVESTIGATING = "investigating"
    RESOLVED      = "resolved"
    ESCALATED     = "escalated"
    CLOSED        = "closed"


# ─── Sub-models ───────────────────────────────────────────────────────────────

class EvidenceItem(BaseModel):
    evidence_id:   str
    evidence_type: str
    title:         str
    description:   str
    weight:        float = Field(ge=0.0, le=1.0)
    source_query:  str
    raw_data:      Dict[str, Any] = Field(default_factory=dict)
    created_at:    str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    is_confirmed:  bool = False


class RingMember(BaseModel):
    customer_id:    str
    shared_devices: List[str] = Field(default_factory=list)
    shared_cards:   List[str] = Field(default_factory=list)
    risk_score:     float = 0.0


class FraudRing(BaseModel):
    component_id:    str
    member_count:    int
    members:         List[RingMember] = Field(default_factory=list)
    shared_devices:  List[str] = Field(default_factory=list)
    shared_cards:    List[str] = Field(default_factory=list)
    avg_risk_score:  float = 0.0
    detected_at:     str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class SimilarCase(BaseModel):
    case_id:          str
    similarity_score: float
    decision:         str
    risk_score:       float
    confidence_score: float
    sar_required:     bool
    total_exposure:   float
    investigation_notes: str = ""


class ActionRecord(BaseModel):
    action_id:        str
    action_type:      str
    status:           str
    approval_event_id: str
    target_entity_id: str
    payload:          Dict[str, Any] = Field(default_factory=dict)
    result:           Optional[Dict[str, Any]] = None
    executed_at:      Optional[str] = None
    error_message:    Optional[str] = None


class CaseContext(BaseModel):
    """Snapshot of the FraudCase vertex from TigerGraph."""
    case_id:          str
    status:           CaseStatus = CaseStatus.OPEN
    priority:         str = "medium"
    risk_score:       float = 0.0
    confidence_score: float = 0.0
    decision:         Decision = Decision.PENDING
    sar_required:     bool = False
    total_exposure:   float = 0.0
    assigned_analyst: str = ""
    tags:             List[str] = Field(default_factory=list)


class RiskHistoryEntry(BaseModel):
    timestamp:    str
    score:        float
    reason:       str
    step:         str
    delta:        float = 0.0


# ─── Main State ───────────────────────────────────────────────────────────────

class AgentState(BaseModel):
    """
    Complete state object threaded through the LangGraph state machine.
    Every node reads from and writes to this object.
    """

    # ── Identity ──────────────────────────────────────────────────────────────
    case_id:          str
    run_id:           str = Field(default_factory=lambda: f"run-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}")
    started_at:       str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    # ── Case context (from TigerGraph) ────────────────────────────────────────
    case_context:     Optional[CaseContext] = None
    subject_customer_ids: List[str] = Field(default_factory=list)

    # ── Investigation plan ────────────────────────────────────────────────────
    investigation_plan:  List[str] = Field(default_factory=list)   # ordered steps
    completed_steps:     List[InvestigationStep] = Field(default_factory=list)
    current_step:        InvestigationStep = InvestigationStep.PLAN

    # ── Graph data collected ──────────────────────────────────────────────────
    transaction_history:     List[Dict[str, Any]] = Field(default_factory=list)
    k_hop_subgraph:          Dict[str, Any] = Field(default_factory=dict)
    detected_rings:          List[FraudRing] = Field(default_factory=list)
    velocity_results:        Dict[str, Any] = Field(default_factory=dict)
    case_subgraph:           Dict[str, Any] = Field(default_factory=dict)

    # ── Memory ────────────────────────────────────────────────────────────────
    similar_cases:           List[SimilarCase] = Field(default_factory=list)
    memory_fraud_prior:      float = 0.5   # base prior from similar cases

    # ── Evidence ──────────────────────────────────────────────────────────────
    evidence_items:          List[EvidenceItem] = Field(default_factory=list)
    total_evidence_weight:   float = 0.0

    # ── Scoring ───────────────────────────────────────────────────────────────
    current_risk_score:      float = 0.0
    current_confidence:      float = 0.0
    confidence_threshold:    float = 0.75
    sar_auto_threshold:      float = 0.90
    risk_history:            List[RiskHistoryEntry] = Field(default_factory=list)

    # ── Gate status ───────────────────────────────────────────────────────────
    gate_passed:             bool = False
    gate_failure_reason:     Optional[str] = None
    gate_retry_count:        int = 0
    max_gate_retries:        int = 3

    # ── Decision ──────────────────────────────────────────────────────────────
    proposed_decision:       Decision = Decision.PENDING
    decision_rationale:      str = ""
    sar_required:            bool = False
    sar_generated:           bool = False

    # ── Actions ───────────────────────────────────────────────────────────────
    proposed_actions:        List[Dict[str, Any]] = Field(default_factory=list)
    executed_actions:        List[ActionRecord] = Field(default_factory=list)

    # ── LLM conversation ──────────────────────────────────────────────────────
    messages:                List[Dict[str, Any]] = Field(default_factory=list)

    # ── Error handling ────────────────────────────────────────────────────────
    errors:                  List[str] = Field(default_factory=list)
    is_terminal:             bool = False

    # ── Helpers ───────────────────────────────────────────────────────────────
    def append_risk_history(self, score: float, reason: str, step: str) -> None:
        delta = score - self.current_risk_score
        self.risk_history.append(RiskHistoryEntry(
            timestamp=datetime.utcnow().isoformat(),
            score=score,
            reason=reason,
            step=step,
            delta=delta,
        ))
        self.current_risk_score = score

    def add_evidence(self, item: EvidenceItem) -> None:
        self.evidence_items.append(item)
        self.total_evidence_weight = sum(e.weight for e in self.evidence_items)
        # Update confidence: normalised sum capped at 1.0
        self.current_confidence = min(1.0, self.total_evidence_weight)

    def risk_history_as_json(self) -> str:
        return json.dumps([e.model_dump() for e in self.risk_history])

    def has_evidence_type(self, evidence_type: str) -> bool:
        return any(e.evidence_type == evidence_type for e in self.evidence_items)
