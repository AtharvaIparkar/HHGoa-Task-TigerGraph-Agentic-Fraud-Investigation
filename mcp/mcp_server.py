"""
mcp/mcp_server.py
Model Context Protocol (MCP) server that exposes all TigerGraph fraud
investigation tools via the MCP protocol.

Run with:  python mcp/mcp_server.py

The server name is 'fraud-investigation-graph' and registers 10 tools,
one per tool in mcp/tools.py.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

try:
    import mcp
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp import types as mcp_types
except ImportError as exc:
    sys.exit(f"MCP library not installed. Run: pip install mcp\nError: {exc}")

from mcp import tools as fraud_tools

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("mcp_server")

# ── MCP Server ────────────────────────────────────────────────────────────────
server = Server("fraud-investigation-graph")


# ─────────────────────────────────────────────────────────────────────────────
# List tools
# ─────────────────────────────────────────────────────────────────────────────
@server.list_tools()
async def list_tools() -> list[mcp_types.Tool]:
    """Return the schema of every available tool."""
    return [
        mcp_types.Tool(
            name="get_entity_transaction_history",
            description=(
                "Retrieve the full transaction history for a customer or card. "
                "Returns transactions with risk_score, amount, channel, device_profile "
                "and summary stats: txn_count, avg_amount, max_risk_score. "
                "Use this first when investigating any fraud alert."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer vertex ID"},
                    "card_id":     {"type": "string", "description": "Card vertex ID"},
                    "limit":       {"type": "integer", "default": 100},
                },
                "anyOf": [{"required": ["customer_id"]}, {"required": ["card_id"]}],
            },
        ),
        mcp_types.Tool(
            name="expand_k_hops",
            description=(
                "Expand the fraud graph k hops from a starting entity. "
                "Returns all reachable entities with type, id, hop_count. "
                "Use to map fraud rings and discover network scope."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "start_id":   {"type": "string"},
                    "start_type": {"type": "string", "enum": ["Customer", "Transaction", "Card", "FraudCase"]},
                    "k":          {"type": "integer", "default": 2, "minimum": 1, "maximum": 4},
                },
                "required": ["start_id", "start_type"],
            },
        ),
        mcp_types.Tool(
            name="detect_shared_attribute_ring",
            description=(
                "Detect customers sharing the same DeviceProfile or BillingRegion "
                "in a time window. Implements R6 shared-origin rule and ring detection."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "device_profile_id": {"type": "string"},
                    "billing_region":    {"type": "string"},
                    "days_window":       {"type": "integer", "default": 30},
                },
                "anyOf": [{"required": ["device_profile_id"]}, {"required": ["billing_region"]}],
            },
        ),
        mcp_types.Tool(
            name="detect_velocity_burst",
            description=(
                "Detect velocity bursts: multiple transactions on a card in a short "
                "time window. Also flags card-testing (3+ micro-txns < $5 then larger txn). "
                "Used for R5 card-testing, R2 burst CNP fraud."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "card_id":       {"type": "string"},
                    "hours_window":  {"type": "integer", "default": 24},
                    "min_txn_count": {"type": "integer", "default": 3},
                },
                "required": ["card_id"],
            },
        ),
        mcp_types.Tool(
            name="find_connected_components",
            description=(
                "Run BFS-based label-propagation connected components on the customer "
                "sharing network. Returns components with member counts, confirmed fraud "
                "counts, and total exposure. No ML Workbench license needed."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "min_component_size":   {"type": "integer", "default": 2},
                    "include_fraud_history": {"type": "boolean", "default": True},
                },
            },
        ),
        mcp_types.Tool(
            name="find_similar_prior_cases",
            description=(
                "Retrieve the top-5 closed FraudCases most similar to the current "
                "investigation context using weighted signal scoring. Use early in every "
                "investigation to leverage historical memory."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "customer_id":       {"type": "string"},
                    "card_id":           {"type": "string"},
                    "device_profile_id": {"type": "string"},
                    "billing_region":    {"type": "string"},
                    "min_similarity":    {"type": "number", "default": 0.3},
                },
            },
        ),
        mcp_types.Tool(
            name="extract_case_subgraph",
            description=(
                "Extract the complete evidence subgraph for a FraudCase: transactions, "
                "customers, cards, devices, evidence items, and prior similar cases. "
                "Use this to assemble the full evidence packet before deciding."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "case_id": {"type": "string"},
                },
                "required": ["case_id"],
            },
        ),
        mcp_types.Tool(
            name="upsert_fraud_case",
            description=(
                "Write or update a FraudCase vertex and its edges in TigerGraph. "
                "Upserts CASE_ABOUT, CASE_ON_CARD, and CASE_INVOLVES edges. "
                "Use after reaching a final investigation decision."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "case_data": {
                        "type": "object",
                        "description": "FraudCase attributes dict. Required: case_id.",
                        "required": ["case_id"],
                    },
                },
                "required": ["case_data"],
            },
        ),
        mcp_types.Tool(
            name="get_transaction_detail",
            description=(
                "Fetch a single Transaction vertex with all attributes: amount, "
                "timestamp, channel, risk_score, billing_region, device_profile_id, "
                "card_id, customer_id, product_cd, and feature columns."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "string"},
                },
                "required": ["transaction_id"],
            },
        ),
        mcp_types.Tool(
            name="get_customer_profile",
            description=(
                "Fetch a Customer vertex with their owned cards and recent FraudCase "
                "history (last 10 cases). Returns account_status, risk_tier, "
                "cumulative_risk_score."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string"},
                },
                "required": ["customer_id"],
            },
        ),
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Call tools
# ─────────────────────────────────────────────────────────────────────────────
@server.call_tool()
async def call_tool(
    name: str,
    arguments: dict[str, Any],
) -> list[mcp_types.TextContent]:
    """Dispatch a tool call and return results as MCP TextContent."""
    log.info("tool_call name=%s args=%s", name, arguments)
    t0 = time.perf_counter()

    try:
        if name == "get_entity_transaction_history":
            result = fraud_tools.get_entity_transaction_history(**arguments)
        elif name == "expand_k_hops":
            result = fraud_tools.expand_k_hops(**arguments)
        elif name == "detect_shared_attribute_ring":
            result = fraud_tools.detect_shared_attribute_ring(**arguments)
        elif name == "detect_velocity_burst":
            result = fraud_tools.detect_velocity_burst(**arguments)
        elif name == "find_connected_components":
            result = fraud_tools.find_connected_components(**arguments)
        elif name == "find_similar_prior_cases":
            result = fraud_tools.find_similar_prior_cases(**arguments)
        elif name == "extract_case_subgraph":
            result = fraud_tools.extract_case_subgraph(**arguments)
        elif name == "upsert_fraud_case":
            result = fraud_tools.upsert_fraud_case(**arguments)
        elif name == "get_transaction_detail":
            result = fraud_tools.get_transaction_detail(**arguments)
        elif name == "get_customer_profile":
            result = fraud_tools.get_customer_profile(**arguments)
        else:
            raise ValueError(f"Unknown tool: {name!r}")

        elapsed = (time.perf_counter() - t0) * 1000
        log.info("tool_call_ok name=%s elapsed_ms=%.1f", name, elapsed)
        return [
            mcp_types.TextContent(
                type="text",
                text=json.dumps(result, default=str, indent=2),
            )
        ]

    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        log.exception("tool_call_error name=%s elapsed_ms=%.1f", name, elapsed)
        return [
            mcp_types.TextContent(
                type="text",
                text=json.dumps({"error": str(exc)}, indent=2),
            )
        ]


# ─────────────────────────────────────────────────────────────────────────────
# Health check resource
# ─────────────────────────────────────────────────────────────────────────────
@server.list_resources()
async def list_resources() -> list[mcp_types.Resource]:
    return [
        mcp_types.Resource(
            uri="fraud-investigation-graph://health",
            name="Health Check",
            description="Returns server status and TigerGraph connectivity.",
            mimeType="application/json",
        )
    ]


@server.read_resource()
async def read_resource(uri: str) -> str:
    if str(uri) == "fraud-investigation-graph://health":
        try:
            conn = fraud_tools._get_conn()
            ping_ok = bool(conn.echo())
        except Exception as exc:
            ping_ok = False
        return json.dumps({
            "status": "ok" if ping_ok else "degraded",
            "server": "fraud-investigation-graph",
            "tigergraph_reachable": ping_ok,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    raise ValueError(f"Unknown resource URI: {uri}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────
async def main() -> None:
    log.info("Starting fraud-investigation-graph MCP server (stdio transport)")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
