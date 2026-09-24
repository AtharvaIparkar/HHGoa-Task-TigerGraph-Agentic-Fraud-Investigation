"""
mcp/test_tools.py
Validation test script for all 10 MCP tools.
Uses real IDs from case_pack.csv (HHG-001).

Run with:  python mcp/test_tools.py
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Callable

# Ensure project root importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

# ── Test IDs from case_pack.csv HHG-001 ──────────────────────────────────────
TEST_CUSTOMER_ID  = "C12382"
TEST_CARD_ID      = "C12382-K1"
TEST_TXN_ID       = "3514030"
TEST_CASE_ID      = "HHG-001"
TEST_BILLING_REGION = "444.0"

# ── Import tools ─────────────────────────────────────────────────────────────
try:
    from mcp import tools
except ImportError:
    import importlib.util, sys
    spec = importlib.util.spec_from_file_location(
        "tools", Path(__file__).parent / "tools.py"
    )
    tools_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tools_mod)
    tools = tools_mod  # type: ignore

# ─────────────────────────────────────────────────────────────────────────────
# Test harness
# ─────────────────────────────────────────────────────────────────────────────
passed: list[str] = []
failed: list[tuple[str, str]] = []


def run_test(name: str, fn: Callable[[], Any], required_keys: list[str]) -> None:
    """Run a single tool test and record pass/fail."""
    print(f"\n{'='*60}")
    print(f"  TEST: {name}")
    print(f"{'='*60}")
    try:
        result = fn()
        assert isinstance(result, dict), f"Expected dict, got {type(result)}"
        missing = [k for k in required_keys if k not in result]
        if missing:
            raise AssertionError(f"Missing keys in result: {missing}")
        print(f"  STATUS : PASS")
        print(f"  KEYS   : {list(result.keys())}")
        # Print a brief preview of the result
        preview = {k: v for k, v in list(result.items())[:3]}
        print(f"  PREVIEW: {json.dumps(preview, default=str, indent=4)[:300]}")
        passed.append(name)
    except Exception as exc:
        print(f"  STATUS : FAIL")
        print(f"  ERROR  : {exc}")
        traceback.print_exc()
        failed.append((name, str(exc)))


# ─────────────────────────────────────────────────────────────────────────────
# Individual tests
# ─────────────────────────────────────────────────────────────────────────────
def test_get_entity_transaction_history_customer() -> None:
    run_test(
        "get_entity_transaction_history (customer)",
        lambda: tools.get_entity_transaction_history(
            customer_id=TEST_CUSTOMER_ID, limit=10
        ),
        required_keys=["transactions", "txn_count", "avg_amount"],
    )


def test_get_entity_transaction_history_card() -> None:
    run_test(
        "get_entity_transaction_history (card)",
        lambda: tools.get_entity_transaction_history(
            card_id=TEST_CARD_ID, limit=10
        ),
        required_keys=["transactions", "txn_count"],
    )


def test_expand_k_hops() -> None:
    run_test(
        "expand_k_hops",
        lambda: tools.expand_k_hops(
            start_id=TEST_CUSTOMER_ID, start_type="Customer", k=2
        ),
        required_keys=["entities", "entity_type_counts"],
    )


def test_detect_shared_attribute_ring_region() -> None:
    run_test(
        "detect_shared_attribute_ring (billing_region)",
        lambda: tools.detect_shared_attribute_ring(
            billing_region=TEST_BILLING_REGION, days_window=90
        ),
        required_keys=["ring_members", "ring_size"],
    )


def test_detect_velocity_burst() -> None:
    run_test(
        "detect_velocity_burst",
        lambda: tools.detect_velocity_burst(
            card_id=TEST_CARD_ID, hours_window=168, min_txn_count=2
        ),
        required_keys=["burst_detected", "txn_count_in_window", "transactions"],
    )


def test_find_connected_components() -> None:
    run_test(
        "find_connected_components",
        lambda: tools.find_connected_components(
            min_component_size=2, include_fraud_history=False
        ),
        required_keys=["components"],
    )


def test_find_similar_prior_cases() -> None:
    run_test(
        "find_similar_prior_cases",
        lambda: tools.find_similar_prior_cases(
            customer_id=TEST_CUSTOMER_ID,
            billing_region=TEST_BILLING_REGION,
            min_similarity=0.2,
        ),
        required_keys=["similar_cases"],
    )


def test_extract_case_subgraph() -> None:
    run_test(
        "extract_case_subgraph",
        lambda: tools.extract_case_subgraph(case_id=TEST_CASE_ID),
        required_keys=["fraud_case", "transactions", "customers"],
    )


def test_upsert_fraud_case() -> None:
    run_test(
        "upsert_fraud_case",
        lambda: tools.upsert_fraud_case({
            "case_id": "HHG-TEST-001",
            "customer_id": TEST_CUSTOMER_ID,
            "card_id": TEST_CARD_ID,
            "txn_ids": [TEST_TXN_ID],
            "status": "open",
            "verdict": "pending",
            "fraud_probability": 0.61,
            "risk_score": 0.61,
            "pattern": "velocity_burst",
            "decision": "under_review",
        }),
        required_keys=["success", "case_id", "vertices_upserted", "edges_upserted"],
    )


def test_get_transaction_detail() -> None:
    run_test(
        "get_transaction_detail",
        lambda: tools.get_transaction_detail(transaction_id=TEST_TXN_ID),
        required_keys=["transaction_id"],
    )


def test_get_customer_profile() -> None:
    run_test(
        "get_customer_profile",
        lambda: tools.get_customer_profile(customer_id=TEST_CUSTOMER_ID),
        required_keys=["customer", "cards", "recent_cases"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Run all tests
# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    print("\n" + "#" * 60)
    print("  TigerGraph MCP Tool Validation Suite")
    print("#" * 60)
    print(f"  Customer : {TEST_CUSTOMER_ID}")
    print(f"  Card     : {TEST_CARD_ID}")
    print(f"  Txn      : {TEST_TXN_ID}")
    print(f"  Case     : {TEST_CASE_ID}")

    test_get_entity_transaction_history_customer()
    test_get_entity_transaction_history_card()
    test_expand_k_hops()
    test_detect_shared_attribute_ring_region()
    test_detect_velocity_burst()
    test_find_connected_components()
    test_find_similar_prior_cases()
    test_extract_case_subgraph()
    test_upsert_fraud_case()
    test_get_transaction_detail()
    test_get_customer_profile()

    # ── Summary ──────────────────────────────────────────────────────────────
    total = len(passed) + len(failed)
    print("\n" + "#" * 60)
    print(f"  RESULTS: {len(passed)}/{total} passed")
    if failed:
        print("  FAILED TESTS:")
        for name, err in failed:
            print(f"    [FAIL] {name}: {err[:80]}")
    else:
        print("  All tests passed [OK]")
    print("#" * 60)

    # ── Check log file ────────────────────────────────────────────────────────
    log_path = Path(__file__).parent / "tool_call_log.jsonl"
    if log_path.exists():
        lines = log_path.read_text().strip().splitlines()
        print(f"\n  Calls logged to tool_call_log.jsonl: {len(lines)} entries")
    else:
        print("\n  Warning: tool_call_log.jsonl not found (no tool calls completed)")

    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
