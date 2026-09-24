"""
api/routers/graph.py
====================
Proxy endpoints for direct TigerGraph query access.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional

router = APIRouter()


class GraphQueryRequest(BaseModel):
    query_name: str
    parameters: Dict[str, Any] = {}


@router.post("/query", summary="Run a named GSQL query")
async def run_graph_query(body: GraphQueryRequest):
    """
    Proxy endpoint to run a named installed GSQL query on FraudGraph.
    Returns the raw query result.
    """
    # TODO (Phase 1): Forward to TigerGraph REST++ API
    return {"query": body.query_name, "result": [], "message": "Graph query proxy stub"}


@router.get("/vertex/{vertex_type}/{vertex_id}", summary="Get a vertex by ID")
async def get_vertex(vertex_type: str, vertex_id: str):
    """Returns a vertex from TigerGraph by type and ID."""
    raise HTTPException(status_code=404, detail=f"{vertex_type}/{vertex_id} not found")


@router.get("/stats", summary="Graph statistics")
async def graph_stats():
    """Returns vertex and edge counts for the FraudGraph."""
    # TODO (Phase 1): Query TigerGraph statistics endpoint
    return {
        "vertex_counts": {},
        "edge_counts": {},
        "graph_name": "FraudGraph",
    }
