# agent/__init__.py
"""
Fraud Investigation Agent Package
==================================
LangGraph-based agentic state machine that orchestrates fraud investigation
using TigerGraph (via MCP tools) and Claude (via Anthropic API).

Architecture:
  PlannnerNode → AnalystNode → EvidenceGateNode → ActorNode → ClosureNode
                     ↑___________________|
               (loop back if gate fails)

Key differentiators:
  1. Fraud-ring detection via shared-attribute graph queries
  2. Evidence-sufficiency gating before any consequential action
  3. Memory-based confidence via prior case similarity
"""

from .state import AgentState, CaseContext, EvidenceItem
from .graph import build_investigation_graph

__all__ = [
    "AgentState",
    "CaseContext",
    "EvidenceItem",
    "build_investigation_graph",
]

__version__ = "0.1.0"
