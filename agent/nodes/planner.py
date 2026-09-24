"""
agent/nodes/planner.py
======================
PlannerNode — the first node in the investigation graph.

Responsibilities:
1. Load the FraudCase context from TigerGraph
2. Ask Claude to reason about the case and produce an investigation plan
3. Set the initial investigation_plan list on state
"""

from __future__ import annotations

import os
import structlog
from anthropic import Anthropic

from ..state import AgentState, CaseContext, CaseStatus, InvestigationStep

log = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are a senior fraud investigator AI assistant.
You have access to a TigerGraph fraud graph and a suite of investigation tools.

Your investigation philosophy:
1. Always check transaction history first to understand the baseline pattern
2. Then expand the graph to find hidden connections (devices, cards, IP)
3. Look for fraud rings — clusters of customers sharing attributes
4. Check velocity bursts — rapid transaction sequences
5. Retrieve memory of similar past cases to inform your prior
6. Assemble all evidence before making any decision
7. You MUST NOT take any action until the evidence gate passes (confidence >= threshold)

Respond in JSON with the key "investigation_plan": a list of step names to execute.
Valid steps: fetch_history, expand_graph, detect_rings, check_velocity, memory_lookup, extract_case
"""

def planner_node(state: AgentState) -> AgentState:
    """
    Plan the investigation strategy for this case.
    Returns updated state with investigation_plan populated.
    """
    log.info("planner_node.start", case_id=state.case_id, run_id=state.run_id)

    # ── Load case context (stub — will call TigerGraph in Phase 1) ────────────
    if state.case_context is None:
        state.case_context = CaseContext(
            case_id=state.case_id,
            status=CaseStatus.OPEN,
            priority="high",
            risk_score=0.0,
            confidence_score=0.0,
        )

    # ── Build prompt ──────────────────────────────────────────────────────────
    user_message = f"""New fraud case to investigate:
Case ID: {state.case_id}
Priority: {state.case_context.priority}
Status: {state.case_context.status}
Subject customers: {state.subject_customer_ids}
Total exposure: ${state.case_context.total_exposure:.2f}

Please produce an investigation plan as JSON:
{{"investigation_plan": ["step1", "step2", ...]}}
"""

    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    import json
    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        content = response.content[0].text
        plan_data = json.loads(content)
        state.investigation_plan = plan_data.get("investigation_plan", [
            "fetch_history", "expand_graph", "detect_rings",
            "check_velocity", "memory_lookup", "extract_case"
        ])
    except Exception as exc:
        log.warning("planner_node.llm_fallback", error=str(exc))
        state.investigation_plan = [
            "fetch_history", "expand_graph", "detect_rings",
            "check_velocity", "memory_lookup", "extract_case"
        ]

    state.completed_steps.append(InvestigationStep.PLAN)
    state.current_step = InvestigationStep.FETCH_HISTORY

    state.messages.append({
        "role": "assistant",
        "content": f"Investigation plan: {state.investigation_plan}",
        "node": "planner",
    })

    log.info("planner_node.done", plan=state.investigation_plan)
    return state
