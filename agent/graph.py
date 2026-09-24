"""
agent/graph.py
==============
Builds and returns the compiled LangGraph StateGraph for fraud investigation.

Node flow:
  planner → analyst → evidence_gate → actor → closure
               ↑____________|
         (retry if gate fails)
"""

from __future__ import annotations

import os
from typing import Literal

from langgraph.graph import StateGraph, END

from .state import AgentState, InvestigationStep
from .nodes.planner import planner_node
from .nodes.analyst import analyst_node
from .nodes.gate import evidence_gate_node
from .nodes.actor import actor_node
from .nodes.closure import closure_node


# ─── Routing functions ────────────────────────────────────────────────────────

def route_after_gate(state: AgentState) -> Literal["actor", "analyst", "closure"]:
    """Route based on evidence gate result."""
    if state.is_terminal:
        return "closure"
    if state.gate_passed:
        return "actor"
    if state.gate_retry_count >= state.max_gate_retries:
        # Force closure after max retries — escalate with whatever we have
        return "closure"
    return "analyst"   # loop back to gather more evidence


def route_after_actor(state: AgentState) -> Literal["closure", "analyst"]:
    """Route after actions are executed."""
    if state.is_terminal or len(state.errors) == 0:
        return "closure"
    return "closure"   # always close after action, even on error


# ─── Graph factory ────────────────────────────────────────────────────────────

def build_investigation_graph() -> StateGraph:
    """
    Build and compile the LangGraph StateGraph for fraud case investigation.

    Returns a compiled graph ready to be invoked with an initial AgentState.
    """
    graph = StateGraph(AgentState)

    # ── Register nodes ────────────────────────────────────────────────────────
    graph.add_node("planner",        planner_node)
    graph.add_node("analyst",        analyst_node)
    graph.add_node("evidence_gate",  evidence_gate_node)
    graph.add_node("actor",          actor_node)
    graph.add_node("closure",        closure_node)

    # ── Edges ─────────────────────────────────────────────────────────────────
    graph.set_entry_point("planner")
    graph.add_edge("planner", "analyst")

    graph.add_edge("analyst", "evidence_gate")

    graph.add_conditional_edges(
        "evidence_gate",
        route_after_gate,
        {
            "actor":   "actor",
            "analyst": "analyst",
            "closure": "closure",
        },
    )

    graph.add_conditional_edges(
        "actor",
        route_after_actor,
        {
            "closure": "closure",
            "analyst": "analyst",
        },
    )

    graph.add_edge("closure", END)

    return graph.compile()
