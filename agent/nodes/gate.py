"""
agent/nodes/gate.py
===================
EvidenceGateNode — enforces evidence-sufficiency before any action is taken.

The gate checks:
1. confidence_score >= confidence_threshold
2. Minimum required evidence types are present
3. At least one transaction-type evidence exists

If the gate fails, the agent loops back to the analyst for more data.
This is the key safety mechanism preventing hallucinated decisions.
"""

from __future__ import annotations

import os
import structlog

from ..state import AgentState, Decision, InvestigationStep

log = structlog.get_logger(__name__)

# Minimum evidence types that must be present before a FRAUD decision
REQUIRED_EVIDENCE_FOR_FRAUD = {"transaction_pattern", "velocity"}
# At least one of these must be present for any decision
ANY_REQUIRED = {"transaction_pattern", "ring", "velocity", "prior_case", "behavioural"}


def evidence_gate_node(state: AgentState) -> AgentState:
    """
    Evaluate whether sufficient evidence has been collected to make a decision.
    Sets state.gate_passed = True/False and state.gate_failure_reason.
    Also determines proposed_decision and sar_required.
    """
    log.info(
        "evidence_gate_node.start",
        case_id=state.case_id,
        confidence=state.current_confidence,
        threshold=state.confidence_threshold,
        evidence_count=len(state.evidence_items),
        retry=state.gate_retry_count,
    )

    threshold = float(os.environ.get("CONFIDENCE_GATE_THRESHOLD", state.confidence_threshold))
    sar_threshold = float(os.environ.get("SAR_AUTO_THRESHOLD", state.sar_auto_threshold))

    evidence_types = {e.evidence_type for e in state.evidence_items}
    failures: list[str] = []

    # ── Check 1: Minimum confidence ───────────────────────────────────────────
    if state.current_confidence < threshold:
        failures.append(
            f"Confidence {state.current_confidence:.2%} < threshold {threshold:.2%}. "
            "Need more evidence."
        )

    # ── Check 2: At least one core evidence type ──────────────────────────────
    if not evidence_types.intersection(ANY_REQUIRED):
        failures.append(
            f"Missing core evidence types. Have: {evidence_types}. "
            f"Need at least one of: {ANY_REQUIRED}."
        )

    # ── Determine decision ────────────────────────────────────────────────────
    if not failures:
        # Gate passed — derive decision from risk score + memory prior
        combined_score = (
            state.current_risk_score * 0.6 +
            state.memory_fraud_prior * 0.2 +
            state.current_confidence * 0.2
        )

        if combined_score >= 0.85:
            state.proposed_decision = Decision.CONFIRMED_FRAUD
        elif combined_score >= 0.65:
            state.proposed_decision = Decision.FRAUD
        elif combined_score >= 0.40:
            state.proposed_decision = Decision.SUSPICIOUS
        else:
            state.proposed_decision = Decision.CLEAR

        # SAR required?
        state.sar_required = (
            combined_score >= sar_threshold or
            len(state.detected_rings) > 0
        )

        state.gate_passed = True
        state.gate_failure_reason = None
        state.decision_rationale = (
            f"Combined score: {combined_score:.2%}. "
            f"Risk: {state.current_risk_score:.2%}, "
            f"Memory prior: {state.memory_fraud_prior:.2%}, "
            f"Confidence: {state.current_confidence:.2%}. "
            f"Evidence types: {sorted(evidence_types)}. "
            f"Rings detected: {len(state.detected_rings)}. "
            f"SAR required: {state.sar_required}."
        )

        log.info(
            "evidence_gate_node.passed",
            decision=state.proposed_decision,
            sar_required=state.sar_required,
        )
    else:
        # Gate failed
        state.gate_passed = False
        state.gate_failure_reason = " | ".join(failures)
        state.gate_retry_count += 1

        # Add more investigation steps on retry
        if state.gate_retry_count == 1:
            for step in ["expand_graph", "detect_rings"]:
                if step not in state.investigation_plan:
                    state.investigation_plan.append(step)

        log.warning(
            "evidence_gate_node.failed",
            reason=state.gate_failure_reason,
            retry_count=state.gate_retry_count,
        )

    state.completed_steps.append(InvestigationStep.GATE_CHECK)
    return state
