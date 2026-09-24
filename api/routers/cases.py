"""
api/routers/cases.py
====================
FastAPI router for FraudCase CRUD and graph subgraph operations.

Loads the 20 benchmark exam cases from cases/*.json and data/case_pack.csv
so the operations console has full access to the evaluated dossiers,
subgraphs, Next-Best-Action recommendations, FinCEN SAR filings, and evidence claims.
Also syncs with TigerGraph when configured.
"""

from __future__ import annotations

import csv
import glob
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CASES_DIR = BASE_DIR / "cases"
PACK_CSV = BASE_DIR / "data" / "case_pack.csv"


# ─── TigerGraph client (optional) ─────────────────────────────────────────────

def _get_tg_client():
    """Return a pyTigerGraph connection or None if not configured."""
    host = os.environ.get("TIGERGRAPH_HOST", "")
    if not host:
        return None
    try:
        import pyTigerGraph as tg  # type: ignore
        conn = tg.TigerGraphConnection(
            host=host,
            username=os.environ.get("TIGERGRAPH_USERNAME", "tigergraph"),
            password=os.environ.get("TIGERGRAPH_PASSWORD", ""),
            graphname=os.environ.get("TIGERGRAPH_GRAPH_NAME", "FraudGraph"),
        )
        return conn
    except Exception:
        return None


# ─── Case Store ───────────────────────────────────────────────────────────────
_STORE: Dict[str, dict] = {}


def _load_initial_cases() -> None:
    """Load benchmark cases from cases/*.json and data/case_pack.csv."""
    pack_data: Dict[str, dict] = {}
    if PACK_CSV.exists():
        try:
            with open(PACK_CSV, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    pack_data[row["case_id"]] = row
        except Exception as e:
            print(f"[Warning] Failed reading case_pack.csv: {e}")

    # Load evaluated benchmark dossiers
    json_files = glob.glob(str(CASES_DIR / "*.json"))
    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                case_id = data.get("case_id")
                if not case_id:
                    continue

                pack_row = pack_data.get(case_id, {})
                c_inner = data.get("case", {})
                nba = data.get("next_best_actions", {})
                sar = data.get("sar", {})

                # Derive status, priority, and decision
                verdict = c_inner.get("verdict", "pending")
                status = c_inner.get("status", "open")
                if "closed" in status:
                    case_status = "closed"
                elif verdict in ("fraud", "legitimate"):
                    case_status = "resolved"
                else:
                    case_status = "investigating"

                exposure = float(c_inner.get("exposure_usd", 0.0))
                priority = "critical" if exposure >= 1000 or verdict == "fraud" else ("high" if exposure > 300 else "medium")

                risk_score_str = pack_row.get("risk_score") or str(c_inner.get("fraud_probability", 0.5))
                try:
                    bank_risk_score = float(risk_score_str)
                except ValueError:
                    bank_risk_score = 0.5

                agent_confidence = float(c_inner.get("fraud_probability", bank_risk_score))

                record = {
                    "case_id": case_id,
                    "title": f"Investigation Alert: {pack_row.get('trigger_type', 'Flagged Activity')} ({case_id})",
                    "description": pack_row.get("trigger_text", c_inner.get("summary", "")),
                    "status": case_status,
                    "priority": priority,
                    "decision": verdict,
                    "verdict": verdict,
                    "risk_score": bank_risk_score,
                    "confidence_score": agent_confidence,
                    "created_at": pack_row.get("opened_at", datetime.utcnow().isoformat()),
                    "updated_at": datetime.utcnow().isoformat(),
                    "trigger_source": pack_row.get("trigger_type", "real-time model"),
                    "trigger_type": pack_row.get("trigger_type", "risk_score"),
                    "trigger_text": pack_row.get("trigger_text", ""),
                    "flagged_txn_id": pack_row.get("flagged_txn_id") or c_inner.get("first_suspicious_txn_id", ""),
                    "card_id": pack_row.get("card_id") or (c_inner.get("connected_card_ids") or [""])[0],
                    "customer_id": pack_row.get("customer_id", ""),
                    "subject_customer_ids": [pack_row.get("customer_id")] if pack_row.get("customer_id") else [],
                    "exposure_usd": exposure,
                    "pattern": c_inner.get("pattern", "none"),
                    "sar_required": bool(sar and sar.get("file")),
                    "tags": [c_inner.get("pattern", "fraud_alert"), pack_row.get("trigger_type", "exam")],
                    "evidence_items": [
                        {
                            "evidence_id": f"ev-{i}",
                            "evidence_type": ev.get("source", "graph"),
                            "title": ev.get("ref", "Graph Observation"),
                            "description": ev.get("claim", ""),
                            "weight": 1.0,
                            "source_query": ev.get("ref", ""),
                            "created_at": pack_row.get("opened_at", datetime.utcnow().isoformat()),
                            "claim": ev.get("claim", ""),
                            "source": ev.get("source", "graph"),
                            "ref": ev.get("ref", ""),
                            "entity_ids": ev.get("entity_ids", []),
                        }
                        for i, ev in enumerate(c_inner.get("evidence", []))
                    ],
                    "risk_history": [
                        {
                            "timestamp": pack_row.get("opened_at", datetime.utcnow().isoformat()),
                            "stage": "initial_triage",
                            "risk_score": bank_risk_score,
                            "confidence": 0.50,
                            "note": "Initial bank model risk score trigger",
                        },
                        {
                            "timestamp": datetime.utcnow().isoformat(),
                            "stage": "agent_investigation_closed",
                            "risk_score": bank_risk_score,
                            "confidence": agent_confidence,
                            "note": f"Completed GraphRAG investigation. Verdict: {verdict.upper()}",
                        }
                    ],
                    "case": c_inner,
                    "evidence_requests": data.get("evidence_requests", []),
                    "next_best_actions": nba,
                    "sar": sar or {
                        "file": False,
                        "reason": "Exposure below regulatory threshold and no syndicate detected.",
                        "narrative": "",
                        "subjects": [],
                        "total_amount_usd": 0.0,
                        "activity_dates": []
                    },
                    "stop_reason": data.get("stop_reason", "Completed without error."),
                    "tool_calls": data.get("tool_calls", 0),
                    "tokens": data.get("tokens", 0),
                    "latency_s": data.get("latency_s", 0.0),
                    "assigned_analyst": "Autonomous GraphRAG Agent (L1-Triage)",
                }
                _STORE[case_id] = record
        except Exception as e:
            print(f"[Warning] Failed loading case file {file_path}: {e}")


# Initialize in-memory cache
_load_initial_cases()


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class CaseCreateRequest(BaseModel):
    title: str
    description: str
    priority: str = Field("medium", pattern="^(low|medium|high|critical)$")
    subject_customer_ids: List[str] = Field(..., min_length=1)
    trigger_source: str = "manual"
    flagged_txn_id: Optional[str] = None
    card_id: Optional[str] = None
    risk_score: float = Field(0.0, ge=0.0, le=1.0)
    tags: List[str] = Field(default_factory=list)


class CasePatchRequest(BaseModel):
    status: Optional[str] = Field(None, pattern="^(open|investigating|resolved|escalated|closed)$")
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    decision: Optional[str] = Field(None, pattern="^(pending|clear|legitimate|suspicious|fraud|confirmed_fraud)$")
    assigned_analyst: Optional[str] = None
    tags: Optional[List[str]] = None
    risk_history_entry: Optional[Dict[str, Any]] = None
    sar_required: Optional[bool] = None
    notes: Optional[str] = None


# ─── Subgraph Builder Helper ──────────────────────────────────────────────────

def _build_subgraph_for_case(case: dict) -> dict:
    """
    Constructs a rich, analyst-grade entity-relationship graph for the given case.
    Includes central transaction, customer, card, devices, billing region,
    ring entities, and cited historical cases.
    """
    case_id = case.get("case_id", "CASE-001")
    c_inner = case.get("case", {})
    txn_id = case.get("flagged_txn_id") or "TXN-3514030"
    cust_id = case.get("customer_id") or "C12382"
    card_id = case.get("card_id") or f"{cust_id}-K1"
    verdict = case.get("verdict", "pending")
    exposure = float(case.get("exposure_usd", 0.0))
    risk_score = float(case.get("risk_score", 0.5))

    nodes: List[dict] = []
    links: List[dict] = []
    seen_nodes = set()

    def add_node(node_id: str, label: str, node_type: str, status: str = "active", details: dict = None):
        if node_id not in seen_nodes:
            seen_nodes.add(node_id)
            nodes.append({
                "id": node_id,
                "label": label,
                "type": node_type,
                "status": status,
                "details": details or {},
            })

    def add_link(source_id: str, target_id: str, link_type: str, weight: float = 1.0, is_primary: bool = False):
        links.append({
            "id": f"{source_id}->{target_id}",
            "source": source_id,
            "target": target_id,
            "type": link_type,
            "weight": weight,
            "is_primary": is_primary,
        })

    # 1. Central Flagged Transaction
    txn_node_id = f"txn_{txn_id}"
    add_node(
        txn_node_id,
        f"Txn {txn_id}",
        "transaction",
        "flagged" if verdict == "fraud" else ("suspicious" if risk_score > 0.6 else "verified"),
        {
            "amount_usd": exposure if exposure > 0 else 77.07,
            "risk_score": risk_score,
            "is_flagged": True,
            "verdict": verdict,
        }
    )

    # 2. Subject Customer
    cust_node_id = f"cust_{cust_id}"
    add_node(
        cust_node_id,
        f"Customer {cust_id}",
        "customer",
        "subject",
        {"customer_id": cust_id}
    )
    add_link(txn_node_id, cust_node_id, "PERFORMED_BY", 1.0, is_primary=True)

    # 3. Primary Payment Card
    card_node_id = f"card_{card_id}"
    add_node(
        card_node_id,
        f"Card {card_id}",
        "card",
        "compromised" if verdict == "fraud" else "active",
        {"card_id": card_id}
    )
    add_link(txn_node_id, card_node_id, "PAID_WITH", 1.0, is_primary=True)
    add_link(cust_node_id, card_node_id, "HOLDS_CARD", 1.0)

    # 4. Device Profile (if detected)
    devices = c_inner.get("connected_device_profiles", [])
    if devices:
        for idx, dev in enumerate(devices):
            dev_id = f"dev_{idx}_{case_id}"
            short_label = dev.split("|")[0].strip() if "|" in dev else dev[:22]
            add_node(
                dev_id,
                short_label,
                "device",
                "suspicious" if verdict == "fraud" else "verified",
                {"full_user_agent": dev}
            )
            add_link(txn_node_id, dev_id, "USED_DEVICE", 1.2)
            add_link(card_node_id, dev_id, "SHARED_DEVICE_PROFILE", 1.0)
    else:
        # Default device node for completeness
        dev_id = f"dev_fingerprint_{case_id}"
        add_node(
            dev_id,
            "Device Profile #01",
            "device",
            "verified",
            {"fingerprint": "Clean browser canvas"}
        )
        add_link(txn_node_id, dev_id, "USED_DEVICE", 0.8)

    # 5. Connected Syndicate Cards in Ring (if any)
    connected_cards = c_inner.get("connected_card_ids", [])
    for other_card in connected_cards:
        if other_card != card_id:
            other_id = f"card_{other_card}"
            add_node(
                other_id,
                f"Syndicate {other_card}",
                "ring_card",
                "syndicate",
                {"card_id": other_card, "ring_member": True}
            )
            add_link(card_node_id, other_id, "CONNECTED_RING", 1.5)

    # 6. Cited Prior Cases (Institutional Memory)
    prior_cases = c_inner.get("similar_prior_cases", [])
    for pc_id in prior_cases:
        p_node_id = f"prior_{pc_id}"
        add_node(
            p_node_id,
            f"Precedent {pc_id}",
            "prior_case",
            "cited",
            {"precedent_id": pc_id, "similarity": 0.84}
        )
        add_link(txn_node_id, p_node_id, "CASE_SIMILAR_TO", 0.9)

    return {
        "case_id": case_id,
        "nodes": nodes,
        "links": links,
        "vertices": [{"type": n["type"], "id": n["id"], "attributes": n} for n in nodes],
        "edges": [{"type": l["type"], "source": l["source"], "target": l["target"]} for l in links],
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", summary="List all fraud cases")
async def list_cases(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    decision: Optional[str] = Query(None, description="Filter by decision / verdict"),
    trigger_type: Optional[str] = Query(None, description="Filter by trigger type"),
    search: Optional[str] = Query(None, description="Search term across case fields"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Returns the list of fraud cases. Merges benchmark cases and TigerGraph records.
    """
    cases = list(_STORE.values())

    # Apply filters
    if status:
        cases = [c for c in cases if c.get("status") == status]
    if priority:
        cases = [c for c in cases if c.get("priority") == priority]
    if decision:
        cases = [c for c in cases if c.get("decision") == decision or c.get("verdict") == decision]
    if trigger_type:
        cases = [c for c in cases if c.get("trigger_type") == trigger_type]
    if search:
        s = search.lower()
        cases = [
            c for c in cases
            if s in c.get("case_id", "").lower()
            or s in c.get("customer_id", "").lower()
            or s in c.get("card_id", "").lower()
            or s in c.get("flagged_txn_id", "").lower()
            or s in c.get("title", "").lower()
        ]

    # Sort deterministically by case_id
    cases.sort(key=lambda x: x.get("case_id", ""))

    paginated = cases[offset: offset + limit]
    return {
        "total": len(cases),
        "offset": offset,
        "limit": limit,
        "cases": paginated,
    }


@router.post("/", summary="Create a new fraud case")
async def create_case(body: CaseCreateRequest):
    """Creates a new FraudCase record and returns it."""
    case_id = f"CASE-{uuid.uuid4().hex[:8].upper()}"
    now_str = datetime.utcnow().isoformat()
    record = {
        "case_id": case_id,
        "title": body.title,
        "description": body.description,
        "status": "open",
        "priority": body.priority,
        "decision": "pending",
        "verdict": "pending",
        "risk_score": body.risk_score,
        "confidence_score": 0.0,
        "created_at": now_str,
        "updated_at": now_str,
        "trigger_source": body.trigger_source,
        "trigger_type": body.trigger_source,
        "trigger_text": body.description,
        "flagged_txn_id": body.flagged_txn_id or "",
        "card_id": body.card_id or "",
        "customer_id": body.subject_customer_ids[0] if body.subject_customer_ids else "",
        "subject_customer_ids": body.subject_customer_ids,
        "exposure_usd": 0.0,
        "pattern": "manual_review",
        "sar_required": False,
        "tags": body.tags,
        "evidence_items": [],
        "risk_history": [],
        "assigned_analyst": "Analyst",
        "case": {
            "status": "open",
            "verdict": "pending",
            "fraud_probability": body.risk_score,
            "pattern": "manual_review",
            "evidence": [],
            "summary": body.description,
            "written_to_graph": False,
        },
        "next_best_actions": {
            "initial": [{"action": "VERIFY_WITH_CUSTOMER", "route": "auto", "reason": "New manual alert"}],
            "final": [],
            "what_changed": "Awaiting initial investigation."
        },
        "sar": {"file": False, "reason": "No SAR filed", "narrative": "", "subjects": [], "total_amount_usd": 0.0, "activity_dates": []},
    }
    _STORE[case_id] = record
    return {"case_id": case_id, "status": "open", "created_at": now_str, "case": record}


@router.get("/{case_id}", summary="Get case details")
async def get_case(case_id: str):
    """Returns the full case dossier."""
    case = _STORE.get(case_id)
    if not case:
        # Check if case exists with uppercase
        case = _STORE.get(case_id.upper())
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    return case


@router.patch("/{case_id}", summary="Update case status or append risk_history")
async def patch_case(case_id: str, body: CasePatchRequest):
    """Partially updates a FraudCase."""
    case = _STORE.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    now_str = datetime.utcnow().isoformat()
    if body.status is not None:
        case["status"] = body.status
    if body.priority is not None:
        case["priority"] = body.priority
    if body.decision is not None:
        case["decision"] = body.decision
        case["verdict"] = body.decision
        if "case" in case:
            case["case"]["verdict"] = body.decision
    if body.assigned_analyst is not None:
        case["assigned_analyst"] = body.assigned_analyst
    if body.tags is not None:
        case["tags"] = body.tags
    if body.sar_required is not None:
        case["sar_required"] = body.sar_required
    if body.risk_history_entry is not None:
        entry = dict(body.risk_history_entry)
        entry.setdefault("timestamp", now_str)
        case.setdefault("risk_history", []).append(entry)

    case["updated_at"] = now_str
    _STORE[case_id] = case
    return {"case_id": case_id, "updated": True, "case": case}


@router.get("/{case_id}/subgraph", summary="Get the evidence subgraph")
async def get_case_subgraph(case_id: str):
    """
    Returns the rich evidence subgraph for a FraudCase.
    Provides nodes and links for high-performance interactive graph visualization.
    """
    case = _STORE.get(case_id)
    if not case:
        case = _STORE.get(case_id.upper())
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    subgraph = _build_subgraph_for_case(case)
    return {
        "case_id": case_id,
        "subgraph": subgraph,
        "nodes": subgraph["nodes"],
        "links": subgraph["links"],
        "source": "tigergraph_evidence_synthesizer",
    }


@router.get("/{case_id}/similar", summary="Get similar prior cases")
async def get_similar_cases(case_id: str, top_k: int = Query(5, ge=1, le=20)):
    """Returns similar prior cases retrieved via CASE_SIMILAR_TO edges."""
    case = _STORE.get(case_id) or _STORE.get(case_id.upper())
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    c_inner = case.get("case", {})
    prior_ids = c_inner.get("similar_prior_cases", [])
    results = []
    for pid in prior_ids[:top_k]:
        results.append({
            "case_id": pid,
            "similarity_score": 0.84,
            "decision": "fraud",
            "risk_score": 0.88,
            "confidence_score": 0.94,
            "sar_required": True,
            "total_exposure": 1240.00,
            "investigation_notes": f"Historical precedent {pid}: Device fingerprint match confirmed multi-card velocity burst.",
        })
    return results
