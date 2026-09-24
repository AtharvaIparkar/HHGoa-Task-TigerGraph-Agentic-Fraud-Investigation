"""
api/routers/cases.py
====================
FastAPI router for FraudCase CRUD operations against TigerGraph.

Endpoints:
  GET    /cases                       — list all cases
  POST   /cases                       — create a new case
  GET    /cases/{case_id}             — get case detail with evidence
  PATCH  /cases/{case_id}             — update case status / append risk_history
  GET    /cases/{case_id}/similar     — get similar prior cases
  GET    /cases/{case_id}/subgraph    — get the evidence subgraph

TigerGraph integration is attempted via pyTigerGraph;
falls back to in-memory stubs when TG is not configured.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter()


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


# ─── In-memory case store (fallback when TigerGraph not connected) ─────────────
_IN_MEMORY_CASES: Dict[str, dict] = {}


# ─── Request / Response models ────────────────────────────────────────────────

class CaseCreateRequest(BaseModel):
    title: str
    description: str
    priority: str = Field("medium", pattern="^(low|medium|high|critical)$")
    subject_customer_ids: List[str] = Field(..., min_length=1)
    trigger_source: str = "manual"  # manual|risk_score|customer_report|analyst_request
    flagged_txn_id: Optional[str] = None
    card_id: Optional[str] = None
    risk_score: float = Field(0.0, ge=0.0, le=1.0)
    tags: List[str] = Field(default_factory=list)


class CasePatchRequest(BaseModel):
    """Patch request — all fields optional; risk_history is append-only."""
    status: Optional[str] = Field(None, pattern="^(open|investigating|resolved|escalated|closed)$")
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    decision: Optional[str] = Field(None, pattern="^(pending|clear|suspicious|fraud|confirmed_fraud)$")
    assigned_analyst: Optional[str] = None
    tags: Optional[List[str]] = None
    risk_history_entry: Optional[Dict[str, Any]] = Field(
        None,
        description="If provided, appended to risk_history (append-only)",
    )
    sar_required: Optional[bool] = None
    notes: Optional[str] = None


class CaseSummary(BaseModel):
    case_id: str
    title: str
    status: str
    priority: str
    risk_score: float
    confidence_score: float
    decision: str
    created_at: str
    updated_at: str
    subject_customer_count: int
    sar_required: bool
    tags: List[str]


class EvidenceItem(BaseModel):
    evidence_id: str
    evidence_type: str
    title: str
    description: str
    weight: float
    source_query: str
    created_at: str


class CaseDetail(BaseModel):
    case_id: str
    title: str
    description: str
    status: str
    priority: str
    risk_score: float
    confidence_score: float
    decision: str
    created_at: str
    updated_at: str
    subject_customer_ids: List[str]
    trigger_source: str
    flagged_txn_id: Optional[str]
    card_id: Optional[str]
    sar_required: bool
    tags: List[str]
    evidence_items: List[EvidenceItem]
    risk_history: List[Dict[str, Any]]
    assigned_analyst: str


class SimilarCase(BaseModel):
    case_id: str
    similarity_score: float
    decision: str
    risk_score: float
    confidence_score: float
    sar_required: bool
    total_exposure: float
    investigation_notes: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.utcnow().isoformat()


def _make_case_id() -> str:
    return f"CASE-{uuid.uuid4().hex[:8].upper()}"


def _stub_case(case_id: str, req: CaseCreateRequest) -> dict:
    """Build an in-memory case dict from a create request."""
    return {
        "case_id":              case_id,
        "title":               req.title,
        "description":         req.description,
        "status":              "open",
        "priority":            req.priority,
        "risk_score":          req.risk_score,
        "confidence_score":    0.0,
        "decision":            "pending",
        "created_at":          _now(),
        "updated_at":          _now(),
        "subject_customer_ids": req.subject_customer_ids,
        "trigger_source":      req.trigger_source,
        "flagged_txn_id":      req.flagged_txn_id,
        "card_id":             req.card_id,
        "sar_required":        False,
        "tags":                req.tags,
        "evidence_items":      [],
        "risk_history":        [],
        "assigned_analyst":    "",
    }


# ─── TigerGraph write helper ──────────────────────────────────────────────────

def _write_case_to_tg(conn, case: dict) -> None:
    """Insert a FraudCase vertex into TigerGraph."""
    try:
        attrs = {
            "title":             case["title"],
            "description":       case["description"],
            "status":            case["status"],
            "priority":          case["priority"],
            "risk_score":        case["risk_score"],
            "confidence_score":  case["confidence_score"],
            "decision":          case["decision"],
            "created_at":        case["created_at"],
            "updated_at":        case["updated_at"],
            "trigger_source":    case["trigger_source"],
            "sar_required":      case["sar_required"],
            "tags":              ",".join(case["tags"]),
        }
        conn.upsertVertex("FraudCase", case["case_id"], attrs)
        # Link customer subjects
        for cust_id in case["subject_customer_ids"]:
            conn.upsertEdge("FraudCase", case["case_id"], "CASE_ABOUT", "Customer", cust_id, {})
    except Exception:
        pass  # Non-fatal — in-memory store is the fallback


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[CaseSummary], summary="List all fraud cases")
async def list_cases(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    decision: Optional[str] = Query(None, description="Filter by decision"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Returns a paginated list of fraud cases.
    Queries TigerGraph FraudCase vertices when connected;
    falls back to in-memory store.
    """
    conn = _get_tg_client()
    cases: List[dict] = []

    if conn:
        try:
            vertices = conn.getVertices("FraudCase")
            for v in vertices:
                attrs = v.get("attributes", {})
                attrs["case_id"] = v["v_id"]
                cases.append(attrs)
        except Exception:
            cases = list(_IN_MEMORY_CASES.values())
    else:
        cases = list(_IN_MEMORY_CASES.values())

    # Apply filters
    if status:
        cases = [c for c in cases if c.get("status") == status]
    if priority:
        cases = [c for c in cases if c.get("priority") == priority]
    if decision:
        cases = [c for c in cases if c.get("decision") == decision]

    # Paginate
    total = len(cases)
    cases = cases[offset: offset + limit]

    return [
        CaseSummary(
            case_id=c.get("case_id", ""),
            title=c.get("title", ""),
            status=c.get("status", "open"),
            priority=c.get("priority", "medium"),
            risk_score=float(c.get("risk_score", 0.0)),
            confidence_score=float(c.get("confidence_score", 0.0)),
            decision=c.get("decision", "pending"),
            created_at=c.get("created_at", ""),
            updated_at=c.get("updated_at", ""),
            subject_customer_count=len(c.get("subject_customer_ids", [])),
            sar_required=bool(c.get("sar_required", False)),
            tags=c.get("tags", []),
        )
        for c in cases
    ]


@router.post("/", summary="Create a new fraud case")
async def create_case(body: CaseCreateRequest):
    """
    Creates a new FraudCase vertex in TigerGraph (or in-memory fallback).
    Returns the new case_id and status.
    """
    case_id = _make_case_id()
    case = _stub_case(case_id, body)
    _IN_MEMORY_CASES[case_id] = case

    conn = _get_tg_client()
    if conn:
        _write_case_to_tg(conn, case)

    return {
        "case_id":     case_id,
        "status":      "open",
        "created_at":  case["created_at"],
        "message":     "Case created successfully",
        "detail":      case,
    }


@router.get("/{case_id}", response_model=CaseDetail, summary="Get case details")
async def get_case(case_id: str):
    """
    Returns full details of a FraudCase including evidence items and risk history.
    Queries TigerGraph case_subgraph_extraction when connected.
    """
    conn = _get_tg_client()
    case: Optional[dict] = None

    if conn:
        try:
            result = conn.runInstalledQuery(
                "case_subgraph_extraction",
                params={"case_id": case_id},
            )
            if result:
                raw = result[0] if isinstance(result, list) else result
                # Normalise TigerGraph response into our schema
                case = {
                    "case_id":             case_id,
                    "title":              raw.get("title", ""),
                    "description":        raw.get("description", ""),
                    "status":             raw.get("status", "open"),
                    "priority":           raw.get("priority", "medium"),
                    "risk_score":         float(raw.get("risk_score", 0.0)),
                    "confidence_score":   float(raw.get("confidence_score", 0.0)),
                    "decision":           raw.get("decision", "pending"),
                    "created_at":         raw.get("created_at", _now()),
                    "updated_at":         raw.get("updated_at", _now()),
                    "subject_customer_ids": raw.get("subject_customer_ids", []),
                    "trigger_source":     raw.get("trigger_source", ""),
                    "flagged_txn_id":     raw.get("flagged_txn_id"),
                    "card_id":            raw.get("card_id"),
                    "sar_required":       bool(raw.get("sar_required", False)),
                    "tags":               raw.get("tags", []),
                    "evidence_items":     raw.get("evidence_items", []),
                    "risk_history":       raw.get("risk_history", []),
                    "assigned_analyst":   raw.get("assigned_analyst", ""),
                }
        except Exception:
            pass

    if case is None:
        case = _IN_MEMORY_CASES.get(case_id)

    if case is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    # Build evidence items list
    evidence_items = [
        EvidenceItem(
            evidence_id=e.get("evidence_id", f"ev-{i}"),
            evidence_type=e.get("evidence_type", ""),
            title=e.get("title", ""),
            description=e.get("description", ""),
            weight=float(e.get("weight", 0.0)),
            source_query=e.get("source_query", ""),
            created_at=e.get("created_at", ""),
        )
        for i, e in enumerate(case.get("evidence_items", []))
    ]

    return CaseDetail(
        case_id=case.get("case_id", case_id),
        title=case.get("title", ""),
        description=case.get("description", ""),
        status=case.get("status", "open"),
        priority=case.get("priority", "medium"),
        risk_score=float(case.get("risk_score", 0.0)),
        confidence_score=float(case.get("confidence_score", 0.0)),
        decision=case.get("decision", "pending"),
        created_at=case.get("created_at", ""),
        updated_at=case.get("updated_at", ""),
        subject_customer_ids=case.get("subject_customer_ids", []),
        trigger_source=case.get("trigger_source", ""),
        flagged_txn_id=case.get("flagged_txn_id"),
        card_id=case.get("card_id"),
        sar_required=bool(case.get("sar_required", False)),
        tags=case.get("tags", []),
        evidence_items=evidence_items,
        risk_history=case.get("risk_history", []),
        assigned_analyst=case.get("assigned_analyst", ""),
    )


@router.patch("/{case_id}", summary="Update case status or append risk_history")
async def patch_case(case_id: str, body: CasePatchRequest):
    """
    Partially updates a FraudCase. risk_history is append-only.
    Writes back to TigerGraph when connected.
    """
    # Retrieve from in-memory or TG
    case = _IN_MEMORY_CASES.get(case_id)
    if case is None:
        # Try to create a minimal placeholder so we can patch it
        conn = _get_tg_client()
        if conn:
            try:
                raw = conn.getVerticesById("FraudCase", case_id)
                if raw:
                    attrs = raw[0].get("attributes", {})
                    attrs["case_id"] = case_id
                    case = attrs
                    _IN_MEMORY_CASES[case_id] = case
            except Exception:
                pass

    if case is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    # Apply updates
    if body.status is not None:
        case["status"] = body.status
    if body.priority is not None:
        case["priority"] = body.priority
    if body.decision is not None:
        case["decision"] = body.decision
    if body.assigned_analyst is not None:
        case["assigned_analyst"] = body.assigned_analyst
    if body.tags is not None:
        case["tags"] = body.tags
    if body.sar_required is not None:
        case["sar_required"] = body.sar_required
    if body.notes is not None:
        case["notes"] = body.notes
    if body.risk_history_entry is not None:
        entry = dict(body.risk_history_entry)
        entry.setdefault("timestamp", _now())
        case.setdefault("risk_history", []).append(entry)

    case["updated_at"] = _now()
    _IN_MEMORY_CASES[case_id] = case

    # Persist to TigerGraph
    conn = _get_tg_client()
    if conn:
        try:
            update_attrs = {k: v for k, v in case.items() if k not in ("case_id", "evidence_items", "risk_history")}
            conn.upsertVertex("FraudCase", case_id, update_attrs)
        except Exception:
            pass

    return {"case_id": case_id, "updated": True, "case": case}


@router.get("/{case_id}/similar", response_model=List[SimilarCase], summary="Get similar prior cases")
async def get_similar_cases(
    case_id: str,
    top_k: int = Query(5, ge=1, le=20),
):
    """
    Returns the top-K most similar resolved cases via CASE_SIMILAR_TO edges.
    Queries the prior_case_similarity GSQL query when TigerGraph is connected.
    """
    conn = _get_tg_client()
    similar: List[dict] = []

    if conn:
        try:
            result = conn.runInstalledQuery(
                "prior_case_similarity",
                params={"case_id": case_id, "top_k": top_k},
            )
            if isinstance(result, list):
                for item in result:
                    if isinstance(item, dict):
                        similar.extend(item.get("similar_cases", []))
        except Exception:
            pass

    # Stub response when TG not available
    if not similar:
        return []

    return [
        SimilarCase(
            case_id=s.get("case_id", ""),
            similarity_score=float(s.get("similarity_score", 0.0)),
            decision=s.get("decision", "pending"),
            risk_score=float(s.get("risk_score", 0.0)),
            confidence_score=float(s.get("confidence_score", 0.0)),
            sar_required=bool(s.get("sar_required", False)),
            total_exposure=float(s.get("total_exposure", 0.0)),
            investigation_notes=s.get("investigation_notes", ""),
        )
        for s in similar
    ]


@router.get("/{case_id}/subgraph", summary="Get the evidence subgraph")
async def get_case_subgraph(case_id: str):
    """
    Returns the full evidence subgraph for a FraudCase via case_subgraph_extraction GSQL query.
    Includes vertices, edges, and evidence nodes.
    """
    conn = _get_tg_client()

    if conn:
        try:
            result = conn.runInstalledQuery(
                "case_subgraph_extraction",
                params={"case_id": case_id},
            )
            return {
                "case_id":  case_id,
                "subgraph": result,
                "source":   "tigergraph",
            }
        except Exception as exc:
            return {
                "case_id":  case_id,
                "subgraph": {},
                "source":   "error",
                "error":    str(exc),
            }

    # Return empty subgraph when TG not connected
    case = _IN_MEMORY_CASES.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    return {
        "case_id":  case_id,
        "subgraph": {
            "vertices": [{"type": "FraudCase", "id": case_id, "attributes": case}],
            "edges":    [],
        },
        "source": "in_memory",
    }
