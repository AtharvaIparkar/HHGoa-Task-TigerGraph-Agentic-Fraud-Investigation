"""
agent/nodes/analyst.py
======================
AnalystNode — executes investigation steps by calling TigerGraph tools via MCP.

For each step in the investigation plan, fires the appropriate GSQL query,
parses results, and creates Evidence nodes attached to the case.
"""

from __future__ import annotations

import os
import json
import uuid
from datetime import datetime

import httpx
import structlog

from ..state import (
    AgentState, EvidenceItem, FraudRing, RingMember,
    SimilarCase, InvestigationStep
)

log = structlog.get_logger(__name__)

MCP_URL = os.environ.get("TIGERGRAPH_MCP_URL", "http://localhost:9000")
MCP_HEADERS = {"Content-Type": "application/json"}


def _call_mcp_tool(tool_name: str, params: dict) -> dict:
    """Call a TigerGraph MCP tool and return the result dict."""
    payload = {"tool": tool_name, "parameters": params}
    try:
        resp = httpx.post(
            f"{MCP_URL}/tools/{tool_name}",
            json=payload,
            headers=MCP_HEADERS,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        log.warning("mcp_call.failed", tool=tool_name, error=str(exc))
        return {"error": str(exc), "data": {}}


def _make_evidence(
    evidence_type: str,
    title: str,
    description: str,
    weight: float,
    source_query: str,
    raw_data: dict,
) -> EvidenceItem:
    return EvidenceItem(
        evidence_id=f"ev-{uuid.uuid4().hex[:8]}",
        evidence_type=evidence_type,
        title=title,
        description=description,
        weight=weight,
        source_query=source_query,
        raw_data=raw_data,
        created_at=datetime.utcnow().isoformat(),
    )


# ─── Step handlers ────────────────────────────────────────────────────────────

def _step_fetch_history(state: AgentState) -> AgentState:
    log.info("analyst.fetch_history", customers=state.subject_customer_ids)
    all_txns = []
    for cust_id in state.subject_customer_ids:
        result = _call_mcp_tool("entity_transaction_history", {
            "entity_type": "customer",
            "entity_id": cust_id,
            "limit_n": 200,
        })
        txns = result.get("data", {}).get("transactions", [])
        all_txns.extend(txns)

    state.transaction_history = all_txns
    if all_txns:
        # Create evidence for the transaction history
        high_risk = [t for t in all_txns if t.get("risk_score", 0) >= 0.7]
        weight = min(0.3, len(high_risk) * 0.05)
        if high_risk:
            state.add_evidence(_make_evidence(
                evidence_type="transaction_pattern",
                title=f"{len(high_risk)} high-risk transactions found",
                description=f"Found {len(high_risk)} transactions with risk_score >= 0.7 out of {len(all_txns)} total.",
                weight=weight,
                source_query="entity_transaction_history",
                raw_data={"high_risk_count": len(high_risk), "total": len(all_txns)},
            ))
    state.completed_steps.append(InvestigationStep.FETCH_HISTORY)
    return state


def _step_expand_graph(state: AgentState) -> AgentState:
    log.info("analyst.expand_graph", customers=state.subject_customer_ids)
    for cust_id in state.subject_customer_ids:
        result = _call_mcp_tool("k_hop_expansion", {
            "seed_type": "customer",
            "seed_id": cust_id,
            "max_hops": int(os.environ.get("MAX_GRAPH_HOPS", 2)),
        })
        state.k_hop_subgraph[cust_id] = result.get("data", {})

    state.completed_steps.append(InvestigationStep.EXPAND_GRAPH)
    return state


def _step_detect_rings(state: AgentState) -> AgentState:
    log.info("analyst.detect_rings")
    result = _call_mcp_tool("shared_attribute_ring_detection", {
        "min_ring_size": 3,
        "include_shared_device": True,
        "include_shared_card": True,
        "include_shared_ip": True,
        "min_shared_count": 2,
    })
    ring_data = result.get("data", {}).get("ring_members", [])
    if ring_data:
        ring = FraudRing(
            component_id=f"ring-{uuid.uuid4().hex[:6]}",
            member_count=len(ring_data),
            avg_risk_score=0.8,
        )
        state.detected_rings.append(ring)
        state.add_evidence(_make_evidence(
            evidence_type="ring",
            title=f"Fraud ring detected: {len(ring_data)} members",
            description=(
                f"Shared-attribute graph analysis identified a cluster of "
                f"{len(ring_data)} customers sharing devices/cards/IPs, "
                "which is a strong indicator of an organised fraud ring."
            ),
            weight=0.4,
            source_query="shared_attribute_ring_detection",
            raw_data={"ring_member_count": len(ring_data)},
        ))
        state.append_risk_history(
            score=min(1.0, state.current_risk_score + 0.3),
            reason="Fraud ring detected",
            step="detect_rings",
        )
    state.completed_steps.append(InvestigationStep.DETECT_RINGS)
    return state


def _step_check_velocity(state: AgentState) -> AgentState:
    log.info("analyst.check_velocity", customers=state.subject_customer_ids)
    for cust_id in state.subject_customer_ids:
        result = _call_mcp_tool("velocity_burst_detection", {
            "entity_type": "customer",
            "entity_id": cust_id,
            "window_seconds": 3600,
            "burst_count_threshold": 5,
        })
        data = result.get("data", {})
        state.velocity_results[cust_id] = data
        if data.get("velocity_burst_detected") or data.get("decline_burst_detected"):
            state.add_evidence(_make_evidence(
                evidence_type="velocity",
                title=f"Velocity burst detected for customer {cust_id}",
                description=(
                    f"Customer {cust_id} made {data.get('txn_count_in_window', '?')} "
                    f"transactions in 1 hour totalling ${data.get('total_amount_in_window', 0):.2f}. "
                    f"Decline burst: {data.get('decline_burst_detected', False)}."
                ),
                weight=0.25,
                source_query="velocity_burst_detection",
                raw_data=data,
            ))
    state.completed_steps.append(InvestigationStep.CHECK_VELOCITY)
    return state


def _step_memory_lookup(state: AgentState) -> AgentState:
    log.info("analyst.memory_lookup", case_id=state.case_id)
    result = _call_mcp_tool("prior_case_similarity", {
        "new_case_id": state.case_id,
        "top_k": int(os.environ.get("MEMORY_SIMILARITY_TOP_K", 5)),
        "min_similarity": 0.5,
    })
    data = result.get("data", {})
    raw_cases = data.get("similar_cases", [])

    state.similar_cases = [
        SimilarCase(
            case_id=c.get("case_id", ""),
            similarity_score=c.get("similarity_score", 0.0),
            decision=c.get("decision", "pending"),
            risk_score=c.get("risk_score", 0.0),
            confidence_score=c.get("confidence_score", 0.0),
            sar_required=c.get("sar_required", False),
            total_exposure=c.get("total_exposure", 0.0),
        )
        for c in raw_cases
    ]

    state.memory_fraud_prior = float(data.get("memory_fraud_prior", 0.5))

    if state.similar_cases:
        state.add_evidence(_make_evidence(
            evidence_type="prior_case",
            title=f"{len(state.similar_cases)} similar prior cases found",
            description=(
                f"Memory lookup found {len(state.similar_cases)} similar resolved cases. "
                f"Fraud prior from memory: {state.memory_fraud_prior:.2%}."
            ),
            weight=0.15,
            source_query="prior_case_similarity",
            raw_data={"fraud_prior": state.memory_fraud_prior, "count": len(state.similar_cases)},
        ))
    state.completed_steps.append(InvestigationStep.MEMORY_LOOKUP)
    return state


def _step_extract_case(state: AgentState) -> AgentState:
    log.info("analyst.extract_case", case_id=state.case_id)
    result = _call_mcp_tool("case_subgraph_extraction", {
        "case_id": state.case_id,
        "include_evidence": True,
        "include_actions": True,
        "include_similar": True,
        "similar_limit": 3,
    })
    state.case_subgraph = result.get("data", {})
    state.completed_steps.append(InvestigationStep.EXTRACT_CASE)
    return state


# ─── Dispatcher ───────────────────────────────────────────────────────────────

STEP_HANDLERS = {
    "fetch_history":  _step_fetch_history,
    "expand_graph":   _step_expand_graph,
    "detect_rings":   _step_detect_rings,
    "check_velocity": _step_check_velocity,
    "memory_lookup":  _step_memory_lookup,
    "extract_case":   _step_extract_case,
}


def analyst_node(state: AgentState) -> AgentState:
    """Execute all remaining investigation steps from the plan."""
    log.info("analyst_node.start", case_id=state.case_id, retry=state.gate_retry_count)

    # Only run steps not yet completed (supports retry loop)
    completed_names = {s.value for s in state.completed_steps}
    pending_steps = [s for s in state.investigation_plan if s not in completed_names]

    for step_name in pending_steps:
        handler = STEP_HANDLERS.get(step_name)
        if handler:
            try:
                state = handler(state)
                log.info("analyst_node.step_done", step=step_name)
            except Exception as exc:
                log.error("analyst_node.step_error", step=step_name, error=str(exc))
                state.errors.append(f"Step '{step_name}' failed: {exc}")
        else:
            log.warning("analyst_node.unknown_step", step=step_name)

    state.current_step = InvestigationStep.GATE_CHECK
    return state
