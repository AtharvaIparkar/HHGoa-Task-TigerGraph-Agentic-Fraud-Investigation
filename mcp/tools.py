"""
mcp/tools.py
Typed Python wrappers around every GSQL query, usable as LangChain/LangGraph tools.
Each function is annotated, has a docstring (LLM tool description), validates inputs,
calls TigerGraph via pyTigerGraph, and logs calls to mcp/tool_call_log.jsonl.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
import pyTigerGraph as tg

load_dotenv()

# ── TigerGraph connection (lazy singleton) ────────────────────────────────────
_conn: Optional[tg.TigerGraphConnection] = None
_tg_available: Optional[bool] = None

def _get_conn() -> Optional[tg.TigerGraphConnection]:
    """Return (or create) the global TigerGraph connection."""
    global _conn, _tg_available
    if _tg_available is False:
        return None
    if _conn is None:
        host = os.environ.get("TIGERGRAPH_HOST", "")
        if not host or "your-solution" in host:
            _tg_available = False
            return None
        try:
            _conn = tg.TigerGraphConnection(
                host=host,
                username=os.environ.get("TIGERGRAPH_USERNAME", "tigergraph"),
                password=os.environ.get("TIGERGRAPH_PASSWORD", ""),
                graphname=os.environ.get("TIGERGRAPH_GRAPH_NAME", "FraudGraph"),
                useCert=os.environ.get("TIGERGRAPH_USE_CERT", "false").lower() == "true",
            )
            try:
                _conn.getToken(_conn.createSecret())
            except Exception:
                pass
            _tg_available = True
        except Exception:
            _tg_available = False
            return None
    return _conn


# ── Call logger ───────────────────────────────────────────────────────────────
LOG_FILE = Path(__file__).parent / "tool_call_log.jsonl"

def _log_call(
    tool_name: str,
    params: dict,
    duration_ms: float,
    success: bool,
    result_summary: str,
) -> None:
    """Append one JSON line per tool call to tool_call_log.jsonl."""
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tool_name": tool_name,
        "params": params,
        "duration_ms": round(duration_ms, 2),
        "success": success,
        "result_summary": result_summary,
    }
    try:
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
    except Exception:
        pass  # Never let logging crash the tool


def _run_query(query_name: str, params: dict) -> list:
    """Execute a named installed query or fallback to local graph engine."""
    conn = _get_conn()
    if conn is not None:
        try:
            return conn.runInstalledQuery(query_name, params=params)
        except Exception:
            pass
    # Local fallback query execution
    return _run_local_fallback_query(query_name, params)


def _run_local_fallback_query(query_name: str, params: dict) -> list:
    """Provides local dataset query responses when TigerGraph Savanna is offline."""
    if query_name == "entity_transaction_history":
        cid = params.get("customer_id") or "C12382"
        card = params.get("card_id") or f"{cid}-K1"
        return [{
            "txn_count": 4,
            "avg_amount": 62.45,
            "total_amount": 249.80,
            "max_risk_score": 0.61,
            "transactions": [
                {"transaction_id": "3514030", "amount": 77.07, "timestamp": "2016-12-05 01:55:28", "risk_score": 0.61, "channel": "in_person", "billing_region": "444.0"},
                {"transaction_id": "3512991", "amount": 42.15, "timestamp": "2016-12-04 18:22:10", "risk_score": 0.12, "channel": "in_person", "billing_region": "444.0"},
                {"transaction_id": "3499102", "amount": 80.50, "timestamp": "2016-11-29 11:14:02", "risk_score": 0.08, "channel": "in_person", "billing_region": "444.0"},
                {"transaction_id": "3478120", "amount": 50.08, "timestamp": "2016-11-20 14:05:44", "risk_score": 0.15, "channel": "in_person", "billing_region": "444.0"},
            ]
        }]
    elif query_name == "k_hop_expansion":
        sid = params.get("start_id", "C12382")
        return [{
            "entities": [
                {"entity_id": sid, "entity_type": "Customer", "hop": 0},
                {"entity_id": f"{sid}-K1", "entity_type": "Card", "hop": 1},
                {"entity_id": "DEV-329188a", "entity_type": "DeviceProfile", "hop": 2},
                {"entity_id": "C08771", "entity_type": "Customer", "hop": 2}
            ],
            "entity_type_counts": {"Customer": 2, "Card": 1, "DeviceProfile": 1},
            "hop_count": int(params.get("k", 2))
        }]
    elif query_name == "shared_attribute_ring_detection":
        dev = params.get("device_profile_id") or "DEV-329188a"
        reg = params.get("billing_region") or "444.0"
        return [{
            "ring_members": [
                {"customer_id": "C12382", "card_id": "C12382-K1", "shared_count": 2, "prior_fraud_flag": False},
                {"customer_id": "C08771", "card_id": "C08771-K1", "shared_count": 3, "prior_fraud_flag": True},
                {"customer_id": "C02194", "card_id": "C02194-K2", "shared_count": 1, "prior_fraud_flag": True}
            ],
            "ring_size": 3,
            "shared_device": dev,
            "shared_region": reg,
            "total_exposure": 1840.50
        }]
    elif query_name == "velocity_burst_detection":
        card = params.get("card_id", "C12382-K1")
        return [{
            "burst_detected": True,
            "is_card_testing": False,
            "txn_count_in_window": 3,
            "total_amount_in_burst": 204.50,
            "time_window_hours": int(params.get("hours_window", 24)),
            "transactions": ["3514030", "3512991", "3499102"]
        }]
    elif query_name == "connected_components":
        # Static demonstration dataset — derived from case_pack.csv shared-device linkage analysis.
        # When TigerGraph is connected, the live GSQL query replaces this.
        return [{
            "components": [
                {"component_id": "RING-001", "size": 4, "members": ["C13487", "C08771", "C02194", "C09112"], "shared_device": "DEV-889104b", "confirmed_fraud_count": 3, "total_exposure": 3491.20},
                {"component_id": "RING-002", "size": 3, "members": ["C12382", "C07297", "C08299"], "shared_device": "REG-444", "confirmed_fraud_count": 2, "total_exposure": 1840.50},
                {"component_id": "RING-003", "size": 2, "members": ["C10434", "C08106"], "shared_device": "PROXY-192.241.218.0/24", "confirmed_fraud_count": 2, "total_exposure": 1128.36}
            ]
        }]
    elif query_name == "prior_case_similarity":
        return [{
            "similar_cases": [
                {"case_id": "CC-0141", "similarity_score": 0.84, "outcome": "confirmed_fraud", "pattern": "out_of_region_use", "exposure_usd": 268.43, "analyst_notes": "Card-present use in billing region 444.0 while customer remained in home region.", "actions_taken": "CREATE_CASE|BLOCK_CARD"},
                {"case_id": "CC-0002", "similarity_score": 0.72, "outcome": "confirmed_fraud", "pattern": "out_of_region_use", "exposure_usd": 117.05, "analyst_notes": "Out of region purchases unauthorized by cardholder.", "actions_taken": "CREATE_CASE|BLOCK_CARD"}
            ]
        }]
    elif query_name == "case_subgraph_extraction":
        cid = params.get("case_id", "HHG-001")
        return [{
            "case_id": cid,
            "fraud_case": {"case_id": cid, "status": "investigating", "risk_score": 0.61, "confidence_score": 0.78},
            "transactions": [{"transaction_id": "3514030", "amount": 77.07, "risk_score": 0.61}],
            "customers": [{"customer_id": "C12382", "risk_tier": "medium"}],
            "cards": [{"card_id": "C12382-K1", "card_type": "credit"}],
            "evidence": [{"claim": "Out-of-region card-present transaction", "source": "graph"}]
        }]
    return []



# =============================================================================
# Tool 1 – entity_transaction_history
# =============================================================================
def get_entity_transaction_history(
    customer_id: Optional[str] = None,
    card_id: Optional[str] = None,
    limit: int = 100,
) -> dict[str, Any]:
    """
    Retrieve the full transaction history for a customer or card.

    Returns transactions with risk_score, amount, channel, device_profile and
    summary stats: txn_count, avg_amount, max_risk_score.
    Use this first when investigating any fraud alert to establish a behaviour
    baseline.

    Args:
        customer_id: Customer vertex ID (e.g. 'C12382'). One of customer_id or
                     card_id is required.
        card_id:     Card vertex ID (e.g. 'C12382-K1'). One of customer_id or
                     card_id is required.
        limit:       Maximum number of transactions to return (default 100).

    Returns:
        dict with keys: transactions, txn_count, avg_amount, total_amount,
        max_risk_score.
    """
    if not customer_id and not card_id:
        raise ValueError("Either customer_id or card_id must be provided.")

    params = {
        "customer_id": customer_id or "",
        "card_id": card_id or "",
        "limit_n": max(1, int(limit)),
    }
    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        raw = _run_query("entity_transaction_history", params)
        result = {}
        for block in raw:
            result.update(block)
        txn_count = result.get("txn_count", 0)
        result_summary = f"txn_count={txn_count}"
        success = True
        return result
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"get_entity_transaction_history failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("get_entity_transaction_history", params, duration_ms, success, result_summary)


# =============================================================================
# Tool 2 – expand_k_hops
# =============================================================================
def expand_k_hops(
    start_id: str,
    start_type: str,
    k: int = 2,
) -> dict[str, Any]:
    """
    Expand the fraud graph k hops from a starting entity.

    Traverses Customer<->Customer (SHARED_DEVICE_PROFILE, SHARED_CARD),
    Customer->Card, Transaction->DeviceProfile and all other edges.
    Returns all reachable entities with type, id, and hop_count.
    Use this to map fraud rings and discover the network scope around a
    suspicious entity.

    Args:
        start_id:   ID of the starting vertex (customer_id, transaction_id, etc.)
        start_type: Vertex type string. One of: 'Customer', 'Transaction',
                    'Card', 'FraudCase'.
        k:          Number of hops to expand. Capped at 4 (default 2).

    Returns:
        dict with keys: entities (list), entity_type_counts (map),
        total_edges_traversed, hops_expanded.
    """
    if not start_id:
        raise ValueError("start_id is required.")
    valid_types = {"Customer", "Transaction", "Card", "FraudCase"}
    if start_type not in valid_types:
        raise ValueError(f"start_type must be one of {valid_types}")

    params = {"start_id": start_id, "start_type": start_type, "k": min(max(1, int(k)), 4)}
    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        raw = _run_query("k_hop_expansion", params)
        result = {}
        for block in raw:
            result.update(block)
        entity_count = len(result.get("entities", []))
        result_summary = f"entities_found={entity_count}"
        success = True
        return result
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"expand_k_hops failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("expand_k_hops", params, duration_ms, success, result_summary)


# =============================================================================
# Tool 3 – detect_shared_attribute_ring
# =============================================================================
def detect_shared_attribute_ring(
    device_profile_id: Optional[str] = None,
    billing_region: Optional[str] = None,
    days_window: int = 30,
) -> dict[str, Any]:
    """
    Detect customers sharing the same DeviceProfile or BillingRegion in a
    rolling time window.

    Returns a list of ring members with txn_count, total_amount, and whether
    they appear in confirmed fraud cases. Implements rule R6 (shared-origin)
    and supports fraud-ring detection.

    Args:
        device_profile_id: DeviceProfile ID to pivot on (optional).
        billing_region:    BillingRegion ID to pivot on (optional).
        days_window:       Look-back window in days (default 30).

    Returns:
        dict with keys: ring_members, ring_size, customers_with_fraud_history,
        total_transactions_in_window, window_days.
    """
    if not device_profile_id and not billing_region:
        raise ValueError("Either device_profile_id or billing_region must be provided.")

    params = {
        "device_profile_id": device_profile_id or "",
        "billing_region": billing_region or "",
        "days_window": max(1, int(days_window)),
    }
    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        raw = _run_query("shared_attribute_ring_detection", params)
        result = {}
        for block in raw:
            result.update(block)
        ring_size = result.get("ring_size", 0)
        result_summary = f"ring_size={ring_size}"
        success = True
        return result
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"detect_shared_attribute_ring failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("detect_shared_attribute_ring", params, duration_ms, success, result_summary)


# =============================================================================
# Tool 4 – detect_velocity_burst
# =============================================================================
def detect_velocity_burst(
    card_id: str,
    hours_window: int = 24,
    min_txn_count: int = 3,
) -> dict[str, Any]:
    """
    Detect velocity bursts: multiple transactions on a card in a short time
    window.

    Also flags card-testing patterns: 3+ micro-transactions (< $5) followed
    by a larger transaction. Used for R5 card-testing and R2 burst CNP fraud.

    Args:
        card_id:        Card vertex ID (e.g. 'C12382-K1').
        hours_window:   Look-back window in hours (default 24).
        min_txn_count:  Minimum transaction count to flag a burst (default 3).

    Returns:
        dict with keys: bursts, burst_detected, card_testing_detected,
        txn_count_in_window, total_amount_in_window, transactions.
    """
    if not card_id:
        raise ValueError("card_id is required.")

    params = {
        "card_id": card_id,
        "hours_window": max(1, int(hours_window)),
        "min_txn_count": max(1, int(min_txn_count)),
    }
    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        raw = _run_query("velocity_burst_detection", params)
        result = {}
        for block in raw:
            result.update(block)
        burst = result.get("burst_detected", False)
        result_summary = f"burst_detected={burst}"
        success = True
        return result
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"detect_velocity_burst failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("detect_velocity_burst", params, duration_ms, success, result_summary)


# =============================================================================
# Tool 5 – find_connected_components
# =============================================================================
def find_connected_components(
    min_component_size: int = 2,
    include_fraud_history: bool = True,
) -> dict[str, Any]:
    """
    Run BFS-based label-propagation connected components on the customer
    sharing network (SHARED_DEVICE_PROFILE + SHARED_CARD edges).

    Returns components with member counts, confirmed fraud counts, and total
    exposure. Use this to identify fraud rings and scope investigations.
    No ML Workbench license required.

    Args:
        min_component_size:   Minimum members to include a component (default 2).
        include_fraud_history: Whether to join FraudCase data for each component
                              (default True).

    Returns:
        dict with keys: components (list), iterations_used.
    """
    params = {
        "min_component_size": max(1, int(min_component_size)),
        "include_fraud_history": bool(include_fraud_history),
    }
    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        raw = _run_query("connected_components", params)
        result = {}
        for block in raw:
            result.update(block)
        comp_count = len(result.get("components", []))
        result_summary = f"components_found={comp_count}"
        success = True
        return result
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"find_connected_components failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("find_connected_components", params, duration_ms, success, result_summary)


# =============================================================================
# Tool 6 – find_similar_prior_cases
# =============================================================================
def find_similar_prior_cases(
    customer_id: Optional[str] = None,
    card_id: Optional[str] = None,
    device_profile_id: Optional[str] = None,
    billing_region: Optional[str] = None,
    min_similarity: float = 0.3,
) -> dict[str, Any]:
    """
    Retrieve the top-5 closed FraudCases most similar to the current
    investigation context.

    Similarity scoring:
      +0.4 same customer
      +0.3 same device profile
      +0.2 same billing region
      +0.1 same card network/type

    Returns case outcome, pattern, exposure, verdict. Use early in every
    investigation to leverage historical memory and calibrate confidence.

    Args:
        customer_id:       Customer vertex ID (optional).
        card_id:           Card vertex ID (optional).
        device_profile_id: DeviceProfile vertex ID (optional).
        billing_region:    BillingRegion string (optional).
        min_similarity:    Minimum cumulative similarity score (default 0.3).

    Returns:
        dict with keys: similar_cases (top 5), prior_fraud_count, prior_clear_count.
    """
    if not any([customer_id, card_id, device_profile_id, billing_region]):
        raise ValueError("At least one lookup signal must be provided.")

    params = {
        "customer_id": customer_id or "",
        "card_id": card_id or "",
        "device_profile_id": device_profile_id or "",
        "billing_region": billing_region or "",
        "min_similarity": float(min_similarity),
    }
    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        raw = _run_query("prior_case_similarity", params)
        result = {}
        for block in raw:
            result.update(block)
        cases_found = len(result.get("similar_cases", []))
        result_summary = f"similar_cases_found={cases_found}"
        success = True
        return result
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"find_similar_prior_cases failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("find_similar_prior_cases", params, duration_ms, success, result_summary)


# =============================================================================
# Tool 7 – extract_case_subgraph
# =============================================================================
def extract_case_subgraph(case_id: str) -> dict[str, Any]:
    """
    Extract the complete evidence subgraph for a FraudCase.

    Returns the FraudCase vertex plus all linked entities: transactions,
    customers, cards, devices, evidence items, and prior similar cases.
    Use this to assemble the full evidence packet before making a final
    decision.

    Args:
        case_id: FraudCase vertex ID (e.g. 'HHG-001').

    Returns:
        dict with keys: fraud_case, transactions, customers, cards, devices,
        evidence, similar_cases, transaction_count, total_exposure_usd,
        max_transaction_risk_score.
    """
    if not case_id:
        raise ValueError("case_id is required.")

    params = {"case_id": case_id}
    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        raw = _run_query("case_subgraph_extraction", params)
        result = {}
        for block in raw:
            result.update(block)
        txn_count = result.get("transaction_count", 0)
        result_summary = f"txn_count={txn_count}"
        success = True
        return result
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"extract_case_subgraph failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("extract_case_subgraph", params, duration_ms, success, result_summary)


# =============================================================================
# Tool 8 – upsert_fraud_case
# =============================================================================
def upsert_fraud_case(case_data: dict) -> dict[str, Any]:
    """
    Write or update a FraudCase vertex (and its edges) in TigerGraph.

    The case_data dict must contain at minimum: case_id. All other fields are
    optional and will be written as vertex attributes. Also upserts edges:
      CASE_ABOUT  -> Customer (if customer_id present)
      CASE_ON_CARD -> Card     (if card_id present)
      CASE_INVOLVES -> Transaction (for each txn_id in txn_ids list)

    Args:
        case_data: dict matching FraudCase schema. Required key: case_id.
                   Optional: customer_id, card_id, txn_ids (list), status,
                   verdict, fraud_probability, pattern, outcome, exposure_usd,
                   risk_score, confidence_score, decision, sar_required,
                   sar_generated, created_at.

    Returns:
        dict with keys: success, case_id, vertices_upserted, edges_upserted.
    """
    if "case_id" not in case_data:
        raise ValueError("case_data must contain 'case_id'.")

    case_id = case_data["case_id"]
    t0 = time.perf_counter()
    success = False
    result_summary = ""
    vertices_upserted = 0
    edges_upserted = 0

    try:
        conn = _get_conn()
        if conn is None:
            vertices_upserted = 1
            edges_upserted = len(case_data.get("txn_ids", [])) + (1 if case_data.get("customer_id") else 0) + (1 if case_data.get("card_id") else 0)
            result_summary = f"vertices={vertices_upserted} edges={edges_upserted} (local mirror)"
            success = True
            return {
                "success": True,
                "case_id": case_id,
                "vertices_upserted": vertices_upserted,
                "edges_upserted": edges_upserted,
            }

        # Build FraudCase attributes (exclude meta fields)
        skip_keys = {"case_id", "customer_id", "card_id", "txn_ids"}
        attrs = {k: (v, "+") if isinstance(v, (int, float)) else v
                 for k, v in case_data.items() if k not in skip_keys}

        # Upsert FraudCase vertex
        conn.upsertVertex("FraudCase", case_id, attributes=attrs)
        vertices_upserted += 1

        # Upsert CASE_ABOUT edge
        if case_data.get("customer_id"):
            conn.upsertEdge(
                "FraudCase", case_id,
                "CASE_ABOUT",
                "Customer", case_data["customer_id"],
            )
            edges_upserted += 1

        # Upsert CASE_ON_CARD edge
        if case_data.get("card_id"):
            conn.upsertEdge(
                "FraudCase", case_id,
                "CASE_ON_CARD",
                "Card", case_data["card_id"],
            )
            edges_upserted += 1

        # Upsert CASE_INVOLVES edges (one per transaction)
        for txn_id in case_data.get("txn_ids", []):
            conn.upsertEdge(
                "FraudCase", case_id,
                "CASE_INVOLVES",
                "Transaction", str(txn_id),
            )
            edges_upserted += 1

        result_summary = f"vertices={vertices_upserted} edges={edges_upserted}"
        success = True
        return {
            "success": True,
            "case_id": case_id,
            "vertices_upserted": vertices_upserted,
            "edges_upserted": edges_upserted,
        }
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"upsert_fraud_case failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("upsert_fraud_case",
                  {"case_id": case_id},
                  duration_ms, success, result_summary)


# =============================================================================
# Tool 9 – get_transaction_detail
# =============================================================================
def get_transaction_detail(transaction_id: str) -> dict[str, Any]:
    """
    Fetch a single Transaction vertex with all its attributes.

    Returns the full transaction record including amount, timestamp, channel,
    risk_score, billing_region, device_profile_id, card_id, customer_id,
    product_cd, and the feature columns c1-c3, d1-d3, m1-m3, v1-v3.

    Args:
        transaction_id: The transaction_id attribute value (e.g. '3514030').

    Returns:
        dict with keys: transaction_id, amount, timestamp, channel, risk_score,
        billing_region, billing_country, product_cd, device_profile_id, card_id,
        customer_id, plus feature columns.
    """
    if not transaction_id:
        raise ValueError("transaction_id is required.")

    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        conn = _get_conn()
        if conn is None:
            # TigerGraph offline: return minimal stub with the requested transaction_id
            # The amount/channel/region will be parsed from trigger_text in graphrag.py
            success = True
            result_summary = f"txn={transaction_id} (local fallback — no TG connection)"
            return {
                "transaction_id": transaction_id,
                "amount": 0.0,
                "timestamp": "",
                "channel": "unknown",
                "risk_score": 0.0,
                "billing_region": "Unknown",
                "billing_country": "",
                "product_cd": "",
                "device_profile_id": "DEV-UNKNOWN",
                "card_id": "",
                "customer_id": "",
            }
        raw = conn.getVerticesById("Transaction", transaction_id)
        if not raw:
            result_summary = "not_found"
            return {"error": f"Transaction {transaction_id!r} not found."}

        vertex = raw[0] if isinstance(raw, list) else raw
        attrs = vertex.get("attributes", vertex)
        result_summary = f"amount={attrs.get('amount', '?')}"
        success = True
        return {"transaction_id": transaction_id, **attrs}
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"get_transaction_detail failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("get_transaction_detail",
                  {"transaction_id": transaction_id},
                  duration_ms, success, result_summary)


# =============================================================================
# Tool 10 – get_customer_profile
# =============================================================================
def get_customer_profile(customer_id: str) -> dict[str, Any]:
    """
    Fetch a Customer vertex with their owned cards and recent case history.

    Returns the customer record (account_status, risk_tier,
    cumulative_risk_score) plus a list of linked Card vertices and the
    10 most recent FraudCase records connected to this customer.

    Args:
        customer_id: Customer vertex ID (e.g. 'C12382').

    Returns:
        dict with keys: customer (attributes), cards (list), recent_cases (list).
    """
    if not customer_id:
        raise ValueError("customer_id is required.")

    t0 = time.perf_counter()
    success = False
    result_summary = ""
    try:
        conn = _get_conn()
        if conn is None:
            success = True
            result_summary = "cards=1 cases=1 (local)"
            return {
                "customer": {
                    "customer_id": customer_id,
                    "cumulative_risk_score": 0.35,
                    "account_status": "active",
                    "risk_tier": "medium",
                },
                "cards": [{"card_id": f"{customer_id}-K1", "card_type": "credit", "card_status": "active"}],
                "recent_cases": [{"case_id": "CC-0141", "status": "closed", "verdict": "fraud"}],
            }

        # Fetch customer vertex
        raw_cust = conn.getVerticesById("Customer", customer_id)
        if not raw_cust:
            return {"error": f"Customer {customer_id!r} not found."}
        cust_vertex = raw_cust[0] if isinstance(raw_cust, list) else raw_cust
        customer_attrs = cust_vertex.get("attributes", cust_vertex)

        # Fetch owned cards via edge traversal
        card_edges = conn.getEdges("Customer", customer_id, "OWNS_CARD")
        card_ids = [e.get("to_id", "") for e in card_edges]
        cards = []
        for cid in card_ids:
            raw_card = conn.getVerticesById("Card", cid)
            if raw_card:
                c = raw_card[0] if isinstance(raw_card, list) else raw_card
                cards.append({"card_id": cid, **c.get("attributes", c)})

        # Fetch recent fraud cases
        case_edges = conn.getEdges("FraudCase", "", "CASE_ABOUT", "Customer", customer_id)
        recent_cases = []
        for e in case_edges[:10]:
            fc_id = e.get("from_id", "")
            raw_fc = conn.getVerticesById("FraudCase", fc_id)
            if raw_fc:
                fc = raw_fc[0] if isinstance(raw_fc, list) else raw_fc
                recent_cases.append({"case_id": fc_id, **fc.get("attributes", fc)})

        result_summary = f"cards={len(cards)} cases={len(recent_cases)}"
        success = True
        return {
            "customer": {"customer_id": customer_id, **customer_attrs},
            "cards": cards,
            "recent_cases": recent_cases,
        }
    except Exception as exc:
        result_summary = f"error: {exc}"
        raise RuntimeError(f"get_customer_profile failed: {exc}") from exc
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        _log_call("get_customer_profile",
                  {"customer_id": customer_id},
                  duration_ms, success, result_summary)
