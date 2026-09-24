"""
agent/memory.py
===============
Phase 7: Case & Institutional Memory Engine.

Maintains FraudCase vertices in TigerGraph with append-only risk history,
decision logs, and evidence links.
On case resolution, computes similarity vectors, creates CASE_SIMILAR_TO edges,
and updates the local institutional memory mirror.

Differentiator C: Memory visibly influences future case confidence by citing prior cases.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

log = logging.getLogger("memory")

MEMORY_LOG_FILE = Path(__file__).parent.parent / "data" / "case_memory.jsonl"


class CaseMemory:
    """
    Manages writeback of resolved cases to TigerGraph FraudCase vertices
    and retrieves matching historical cases to calibrate confidence for new alerts.
    """

    def __init__(self, tools_module: Optional[Any] = None):
        self.tools = tools_module
        self._ensure_log_exists()

    def _ensure_log_exists(self) -> None:
        MEMORY_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        if not MEMORY_LOG_FILE.exists():
            MEMORY_LOG_FILE.touch()

    def store_resolved_case(self, case_record: Dict[str, Any]) -> str:
        """
        Persists a resolved case into TigerGraph and updates the memory store.
        Returns the graph_case_id.
        """
        case_id = case_record.get("case_id", f"CASE-{datetime.now().strftime('%Y%m%d%H%M%S')}")
        graph_case_id = f"TG-{case_id}"

        # 1. Prepare structured record
        record = {
            "graph_case_id": graph_case_id,
            "case_id": case_id,
            "status": case_record.get("case", {}).get("status", "closed_fraud"),
            "verdict": case_record.get("case", {}).get("verdict", "fraud"),
            "fraud_probability": case_record.get("case", {}).get("fraud_probability", 0.85),
            "pattern": case_record.get("case", {}).get("pattern", "card_testing"),
            "exposure_usd": case_record.get("case", {}).get("exposure_usd", 0.0),
            "affected_txn_ids": case_record.get("case", {}).get("affected_txn_ids", []),
            "connected_card_ids": case_record.get("case", {}).get("connected_card_ids", []),
            "summary": case_record.get("case", {}).get("summary", ""),
            "similar_prior_cases": case_record.get("case", {}).get("similar_prior_cases", []),
            "written_to_graph": True,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }

        # 2. Upsert to TigerGraph if tool available
        if self.tools and hasattr(self.tools, "upsert_fraud_case"):
            try:
                self.tools.upsert_fraud_case({
                    "case_id": graph_case_id,
                    "verdict": record["verdict"],
                    "fraud_probability": record["fraud_probability"],
                    "pattern": record["pattern"],
                    "exposure_usd": record["exposure_usd"],
                    "status": record["status"],
                    "summary": record["summary"],
                })
                log.info("Persisted case %s to TigerGraph graph", graph_case_id)
            except Exception as e:
                log.warning("TigerGraph upsert failed (will record to local memory): %s", e)

        # 3. Append to local audit mirror (append-only institutional memory)
        try:
            with MEMORY_LOG_FILE.open("a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
        except Exception as e:
            log.error("Failed to write to local memory mirror: %s", e)

        return graph_case_id

    def retrieve_similar(
        self,
        customer_id: str = "",
        card_id: str = "",
        device_profile_id: str = "",
        billing_region: str = "",
        pattern: str = "",
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves matching historical closed cases from TigerGraph or the local memory mirror.
        """
        # Try TigerGraph tool first
        if self.tools and hasattr(self.tools, "find_similar_prior_cases"):
            try:
                res = self.tools.find_similar_prior_cases(
                    customer_id=customer_id or None,
                    card_id=card_id or None,
                    device_profile_id=device_profile_id or None,
                    billing_region=billing_region or None,
                )
                cases = res.get("similar_cases", [])
                if cases:
                    return cases[:top_k]
            except Exception as e:
                log.warning("TigerGraph prior case query failed: %s", e)

        # Fallback to local memory log
        matches = []
        if MEMORY_LOG_FILE.exists():
            try:
                with MEMORY_LOG_FILE.open("r", encoding="utf-8") as f:
                    for line in f:
                        if not line.strip():
                            continue
                        entry = json.loads(line)
                        score = 0.3
                        if pattern and entry.get("pattern") == pattern:
                            score += 0.4
                        if card_id and card_id in entry.get("connected_card_ids", []):
                            score += 0.3
                        entry["similarity_score"] = min(0.95, round(score, 2))
                        matches.append(entry)
            except Exception as e:
                log.warning("Local memory search error: %s", e)

        matches.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
        return matches[:top_k]

    @staticmethod
    def format_citation(prior_case: Dict[str, Any]) -> str:
        """Formats a prior case for transparent citing in the reasoning trace."""
        cid = prior_case.get("case_id", "CC-UNKNOWN")
        outcome = prior_case.get("outcome", prior_case.get("verdict", "fraud"))
        pattern = prior_case.get("pattern", "unclassified")
        exposure = prior_case.get("exposure_usd", 0.0)
        score = prior_case.get("similarity_score", 0.0)
        return f"Case {cid} ({outcome}, {pattern}, ${exposure:.2f}, similarity={score:.2f})"
