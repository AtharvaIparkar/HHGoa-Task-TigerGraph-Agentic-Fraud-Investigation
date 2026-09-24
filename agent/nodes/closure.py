"""
agent/nodes/closure.py
======================
ClosureNode — finalises the investigation.

Responsibilities:
1. Update the FraudCase vertex in TigerGraph with final decision, scores, risk_history
2. Generate SAR content if required
3. Mark the run as terminal
4. Emit structured investigation summary
"""

from __future__ import annotations

import json
import structlog
from datetime import datetime

from ..state import AgentState, CaseStatus, InvestigationStep

log = structlog.get_logger(__name__)


SAR_TEMPLATE = """
SUSPICIOUS ACTIVITY REPORT (SAR)
=================================
Case ID:          {case_id}
Filed At:         {filed_at}
Decision:         {decision}
Risk Score:       {risk_score:.2%}
Confidence:       {confidence:.2%}
Total Exposure:   ${exposure:.2f}

Subject Customers:
{customers}

Evidence Summary:
{evidence}

Investigation Rationale:
{rationale}

Fraud Rings Detected: {rings}
Actions Taken: {actions}
""".strip()


def closure_node(state: AgentState) -> AgentState:
    """Finalise the investigation, update TigerGraph, optionally generate SAR."""
    log.info(
        "closure_node.start",
        case_id=state.case_id,
        decision=state.proposed_decision,
        gate_passed=state.gate_passed,
    )

    now = datetime.utcnow().isoformat()

    # ── Determine final case status ───────────────────────────────────────────
    final_status: CaseStatus
    if state.errors and not state.gate_passed:
        final_status = CaseStatus.ESCALATED
    elif state.proposed_decision in ("confirmed_fraud", "fraud"):
        final_status = CaseStatus.RESOLVED
    elif state.proposed_decision == "suspicious":
        final_status = CaseStatus.ESCALATED
    else:
        final_status = CaseStatus.RESOLVED

    if state.case_context:
        state.case_context.status = final_status

    # ── Generate SAR if required ──────────────────────────────────────────────
    sar_content: str | None = None
    if state.sar_required:
        evidence_lines = "\n".join(
            f"  - [{e.evidence_type}] {e.title} (weight={e.weight:.2f})"
            for e in state.evidence_items
        )
        action_lines = "\n".join(
            f"  - {a.action_type}: {a.status} (approval={a.approval_event_id})"
            for a in state.executed_actions
        )
        ring_lines = f"{len(state.detected_rings)} fraud ring(s) detected" if state.detected_rings else "None"
        sar_content = SAR_TEMPLATE.format(
            case_id=state.case_id,
            filed_at=now,
            decision=state.proposed_decision,
            risk_score=state.current_risk_score,
            confidence=state.current_confidence,
            exposure=state.case_context.total_exposure if state.case_context else 0.0,
            customers="\n".join(f"  - {c}" for c in state.subject_customer_ids),
            evidence=evidence_lines or "  No evidence collected.",
            rationale=state.decision_rationale or "No rationale provided.",
            rings=ring_lines,
            actions=action_lines or "  No actions taken.",
        )
        state.sar_generated = True
        log.info("closure_node.sar_generated", case_id=state.case_id)

    # ── TODO (Phase 1): Write final state back to TigerGraph ──────────────────
    # update_case_in_tigergraph(
    #     case_id=state.case_id,
    #     status=final_status,
    #     decision=state.proposed_decision,
    #     risk_score=state.current_risk_score,
    #     confidence_score=state.current_confidence,
    #     risk_history=state.risk_history_as_json(),
    #     sar_required=state.sar_required,
    #     sar_generated=state.sar_generated,
    #     decision_rationale=state.decision_rationale,
    # )

    # ── Build final summary message ───────────────────────────────────────────
    summary = {
        "case_id":          state.case_id,
        "run_id":           state.run_id,
        "final_status":     final_status,
        "decision":         state.proposed_decision,
        "risk_score":       state.current_risk_score,
        "confidence_score": state.current_confidence,
        "evidence_count":   len(state.evidence_items),
        "rings_detected":   len(state.detected_rings),
        "actions_taken":    len(state.executed_actions),
        "sar_required":     state.sar_required,
        "sar_generated":    state.sar_generated,
        "errors":           state.errors,
        "closed_at":        now,
    }

    state.messages.append({
        "role": "assistant",
        "content": json.dumps(summary, indent=2),
        "node": "closure",
    })

    state.completed_steps.append(InvestigationStep.CLOSE)
    state.is_terminal = True

    log.info("closure_node.done", **{k: v for k, v in summary.items() if k != "errors"})
    return state
