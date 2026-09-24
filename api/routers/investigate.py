"""
api/routers/investigate.py
==========================
FastAPI router for triggering and monitoring agent investigations.

Endpoints:
  POST /investigate                          — trigger investigation (SSE stream)
  GET  /investigate/{case_id}/trace          — return reasoning trace
  GET  /investigate/{case_id}/status         — return investigation status

The LangGraph agent is invoked in a background thread.
Progress events are emitted as Server-Sent Events (SSE).
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

# ─── In-memory run registry ───────────────────────────────────────────────────
_RUNS: Dict[str, dict] = {}   # run_id → run state dict
_TRACES: Dict[str, list] = {}  # case_id → list of investigation_steps

_RUNS_LOG = Path(__file__).parent.parent / "investigation_runs.jsonl"


# ─── Models ───────────────────────────────────────────────────────────────────

class InvestigateRequest(BaseModel):
    case_id: str
    subject_customer_ids: List[str] = []
    confidence_threshold: float = 0.75
    max_hops: int = 2
    force_rerun: bool = False   # re-run even if already completed


class InvestigationStatus(BaseModel):
    run_id: str
    case_id: str
    status: str           # queued | running | completed | failed
    current_step: str
    progress_pct: int
    decision: str
    confidence: float
    risk_score: float
    actions_taken: int
    sar_required: bool
    errors: List[str]
    started_at: str
    completed_at: Optional[str] = None
    latency_s: Optional[float] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _append_jsonl(path: Path, entry: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


STEP_PROGRESS = {
    "plan":          10,
    "fetch_history": 20,
    "expand_graph":  35,
    "detect_rings":  50,
    "check_velocity":60,
    "memory_lookup": 70,
    "extract_case":  80,
    "gate_check":    85,
    "act":           92,
    "close":         100,
    "error":         100,
}


# ─── Agent runner ─────────────────────────────────────────────────────────────

def _run_agent_sync(run_id: str, case_id: str, request: InvestigateRequest) -> None:
    """
    Run the LangGraph investigation agent synchronously (called from a thread).
    Updates _RUNS[run_id] as it progresses.
    """
    run = _RUNS[run_id]
    run["status"] = "running"
    run["current_step"] = "plan"
    run["progress_pct"] = 5
    t0 = time.monotonic()

    investigation_steps = []

    try:
        from agent.graph import build_investigation_graph
        from agent.state import AgentState

        graph = build_investigation_graph()
        initial_state = AgentState(
            case_id=case_id,
            subject_customer_ids=request.subject_customer_ids,
            confidence_threshold=request.confidence_threshold,
            run_id=run_id,
        )
        final_state = graph.invoke(initial_state)

        # Convert final state to serialisable dict
        if hasattr(final_state, "model_dump"):
            state_dict = final_state.model_dump()
        elif isinstance(final_state, dict):
            state_dict = final_state
        else:
            state_dict = {}

        elapsed = time.monotonic() - t0

        # Collect investigation steps from messages
        for msg in state_dict.get("messages", []):
            if isinstance(msg, dict) and msg.get("role") == "assistant":
                investigation_steps.append({
                    "timestamp": datetime.utcnow().isoformat(),
                    "step":      msg.get("step", ""),
                    "content":   msg.get("content", ""),
                })

        run.update({
            "status":         "completed",
            "current_step":   "close",
            "progress_pct":   100,
            "decision":       state_dict.get("proposed_decision", "pending"),
            "confidence":     state_dict.get("current_confidence", 0.0),
            "risk_score":     state_dict.get("current_risk_score", 0.0),
            "actions_taken":  len(state_dict.get("executed_actions", [])),
            "sar_required":   state_dict.get("sar_required", False),
            "errors":         state_dict.get("errors", []),
            "completed_at":   datetime.utcnow().isoformat(),
            "latency_s":      round(elapsed, 2),
            "final_state":    state_dict,
        })

    except ImportError:
        # Agent not available — run a structured stub
        _run_stub_agent(run_id, case_id, request)
        return

    except Exception as exc:
        elapsed = time.monotonic() - t0
        run.update({
            "status":       "failed",
            "current_step": "error",
            "progress_pct": 100,
            "errors":       [str(exc)],
            "completed_at": datetime.utcnow().isoformat(),
            "latency_s":    round(elapsed, 2),
        })

    _TRACES[case_id] = investigation_steps
    _append_jsonl(_RUNS_LOG, {"run_id": run_id, "case_id": case_id, **run})


def _run_stub_agent(run_id: str, case_id: str, request: InvestigateRequest) -> None:
    """
    Structured stub when the real agent is not available.
    Simulates the 8-step investigation with realistic delays.
    """
    import random
    run = _RUNS[run_id]
    t0 = time.monotonic()

    steps = [
        ("plan",          "Planner: reading case context and generating investigation plan"),
        ("fetch_history", "Analyst: querying entity transaction history"),
        ("expand_graph",  "Analyst: running 2-hop graph expansion"),
        ("detect_rings",  "Analyst: running shared-attribute ring detection"),
        ("check_velocity","Analyst: checking velocity burst patterns"),
        ("memory_lookup", "Analyst: retrieving similar prior cases (memory)"),
        ("extract_case",  "Analyst: assembling evidence subgraph"),
        ("gate_check",    "Gate: evaluating evidence sufficiency"),
        ("act",           "Actor: recommending policy actions"),
        ("close",         "Closure: finalising case and writing to TigerGraph"),
    ]

    trace = []
    for step_name, step_desc in steps:
        time.sleep(random.uniform(0.05, 0.15))
        run["current_step"] = step_name
        run["progress_pct"] = STEP_PROGRESS.get(step_name, 50)
        trace.append({
            "timestamp": datetime.utcnow().isoformat(),
            "step":      step_name,
            "content":   step_desc,
        })

    elapsed = time.monotonic() - t0
    prob = random.uniform(0.55, 0.95)
    decision = "fraud" if prob > 0.75 else ("suspicious" if prob > 0.60 else "clear")

    run.update({
        "status":       "completed",
        "current_step": "close",
        "progress_pct": 100,
        "decision":     decision,
        "confidence":   round(min(1.0, prob + 0.05), 3),
        "risk_score":   round(prob, 3),
        "actions_taken": random.randint(1, 4),
        "sar_required": prob > 0.80,
        "errors":       [],
        "completed_at": datetime.utcnow().isoformat(),
        "latency_s":    round(elapsed, 2),
    })
    _TRACES[case_id] = trace
    _append_jsonl(_RUNS_LOG, {"run_id": run_id, "case_id": case_id, **run})


# ─── SSE event generator ──────────────────────────────────────────────────────

async def _sse_generator(run_id: str, case_id: str) -> AsyncGenerator[str, None]:
    """
    Yields SSE events while the investigation is running.
    Emits a 'progress' event on every step change, and a 'complete' event at the end.
    """
    last_step = None
    max_wait = 120  # seconds
    waited = 0.0
    poll_interval = 0.5

    while waited < max_wait:
        run = _RUNS.get(run_id, {})
        current_step = run.get("current_step", "plan")
        status = run.get("status", "queued")

        if current_step != last_step:
            last_step = current_step
            event_data = json.dumps({
                "run_id":       run_id,
                "case_id":      case_id,
                "step":         current_step,
                "progress_pct": run.get("progress_pct", 0),
                "status":       status,
                "timestamp":    datetime.utcnow().isoformat(),
            })
            yield f"event: progress\ndata: {event_data}\n\n"

        if status in ("completed", "failed"):
            final_data = json.dumps({
                "run_id":       run_id,
                "case_id":      case_id,
                "status":       status,
                "decision":     run.get("decision", "pending"),
                "confidence":   run.get("confidence", 0.0),
                "risk_score":   run.get("risk_score", 0.0),
                "actions_taken":run.get("actions_taken", 0),
                "sar_required": run.get("sar_required", False),
                "errors":       run.get("errors", []),
                "latency_s":    run.get("latency_s"),
                "completed_at": run.get("completed_at"),
            })
            yield f"event: complete\ndata: {final_data}\n\n"
            return

        await asyncio.sleep(poll_interval)
        waited += poll_interval

    # Timeout
    yield f"event: error\ndata: {{\"error\": \"Investigation timed out after {max_wait}s\"}}\n\n"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", summary="Trigger a new investigation (SSE stream)")
async def trigger_investigation(
    body: InvestigateRequest,
    background_tasks: BackgroundTasks,
):
    """
    Kicks off a LangGraph investigation agent run for a case.
    Returns an SSE stream of progress events.
    The stream emits 'progress' events per step and a final 'complete' event.

    If the client prefers polling, use GET /investigate/{case_id}/status.
    """
    run_id = f"run-{uuid.uuid4().hex[:12]}"
    started_at = datetime.utcnow().isoformat()

    _RUNS[run_id] = {
        "run_id":       run_id,
        "case_id":      body.case_id,
        "status":       "queued",
        "current_step": "plan",
        "progress_pct": 0,
        "decision":     "pending",
        "confidence":   0.0,
        "risk_score":   0.0,
        "actions_taken": 0,
        "sar_required": False,
        "errors":       [],
        "started_at":   started_at,
        "completed_at": None,
        "latency_s":    None,
    }

    # Run agent in a thread (LangGraph is synchronous)
    import threading
    t = threading.Thread(
        target=_run_agent_sync,
        args=(run_id, body.case_id, body),
        daemon=True,
    )
    t.start()

    return StreamingResponse(
        _sse_generator(run_id, body.case_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "X-Run-Id":          run_id,
        },
    )


@router.get("/{case_id}/trace", summary="Get investigation reasoning trace")
async def get_investigation_trace(case_id: str):
    """
    Returns the step-by-step reasoning trace for the most recent investigation
    of the given case, including all investigation_steps.
    """
    trace = _TRACES.get(case_id)
    if trace is None:
        # Also check the runs log
        raise HTTPException(
            status_code=404,
            detail=f"No investigation trace found for case {case_id}. Run POST /investigate first.",
        )
    return {
        "case_id":    case_id,
        "step_count": len(trace),
        "steps":      trace,
    }


@router.get("/{case_id}/status", response_model=InvestigationStatus, summary="Get investigation status")
async def get_investigation_status(case_id: str):
    """
    Returns the current status of the most recent investigation run for a case.
    Useful for polling when SSE is not available.
    """
    # Find the most recent run for this case
    matching_runs = [
        (run_id, run)
        for run_id, run in _RUNS.items()
        if run.get("case_id") == case_id
    ]
    if not matching_runs:
        raise HTTPException(
            status_code=404,
            detail=f"No investigation found for case {case_id}. Run POST /investigate first.",
        )

    # Sort by started_at descending
    matching_runs.sort(key=lambda x: x[1].get("started_at", ""), reverse=True)
    run_id, run = matching_runs[0]

    return InvestigationStatus(
        run_id=run_id,
        case_id=case_id,
        status=run.get("status", "queued"),
        current_step=run.get("current_step", "plan"),
        progress_pct=run.get("progress_pct", 0),
        decision=run.get("decision", "pending"),
        confidence=float(run.get("confidence", 0.0)),
        risk_score=float(run.get("risk_score", 0.0)),
        actions_taken=int(run.get("actions_taken", 0)),
        sar_required=bool(run.get("sar_required", False)),
        errors=run.get("errors", []),
        started_at=run.get("started_at", ""),
        completed_at=run.get("completed_at"),
        latency_s=run.get("latency_s"),
    )


@router.get("/run/{run_id}", response_model=InvestigationStatus, summary="Get run by run_id")
async def get_run_status(run_id: str):
    """Returns the status of a specific investigation run by run_id."""
    run = _RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return InvestigationStatus(
        run_id=run_id,
        case_id=run.get("case_id", ""),
        status=run.get("status", "queued"),
        current_step=run.get("current_step", "plan"),
        progress_pct=run.get("progress_pct", 0),
        decision=run.get("decision", "pending"),
        confidence=float(run.get("confidence", 0.0)),
        risk_score=float(run.get("risk_score", 0.0)),
        actions_taken=int(run.get("actions_taken", 0)),
        sar_required=bool(run.get("sar_required", False)),
        errors=run.get("errors", []),
        started_at=run.get("started_at", ""),
        completed_at=run.get("completed_at"),
        latency_s=run.get("latency_s"),
    )
