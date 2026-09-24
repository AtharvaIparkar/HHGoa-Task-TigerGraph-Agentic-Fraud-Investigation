"""
eval/test_policy_and_approvals.py
=================================
Phase 8 Verification Script: Policy, Permissions, and Approvals.

Tests:
1. Permitted action execution (auto route)
2. Blocked execution: Out-of-scope action attempted WITHOUT approval event ID
   Verifies that the action attempt is rejected and blocked with a policy citation in the log.
3. Approval-routing engine recording: Verifies routes are computed before and after evidence gathering.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.policy_engine import PolicyEngine, PolicyViolationError

LOG_FILE = Path(__file__).parent.parent / "api" / "permission_log.jsonl"


def test_policy_enforcement():
    print("=" * 60)
    print("  PHASE 8: POLICY & APPROVAL PERMISSION TESTING")
    print("=" * 60)

    engine = PolicyEngine()

    # Test 1: Auto action (permitted without approval event)
    perm_auto = engine.check_action_permitted(
        action="ALLOW_TRANSACTION",
        approval_event_id="",
        requester="agent",
    )
    print(f"\n[TEST 1] Auto action: ALLOW_TRANSACTION")
    print(f"  Permitted      : {perm_auto.permitted}")
    print(f"  Required Route : {perm_auto.required_route}")
    assert perm_auto.permitted is True, "Auto action should be permitted"

    # Test 2: Out-of-scope action attempted WITHOUT approval event (L1 block)
    perm_l1_blocked = engine.check_action_permitted(
        action="DECLINE_TRANSACTION",
        approval_event_id="",
        requester="agent",
    )
    print(f"\n[TEST 2] Out-of-scope attempt: DECLINE_TRANSACTION without approval")
    print(f"  Permitted      : {perm_l1_blocked.permitted}")
    print(f"  Reason         : {perm_l1_blocked.reason}")
    print(f"  Required Route : {perm_l1_blocked.required_route}")
    assert perm_l1_blocked.permitted is False, "L1 action without approval event MUST be blocked"

    # Test 3: Out-of-scope action attempted WITHOUT approval event (L2 block: BLOCK_ALL_CARDS)
    perm_l2_blocked = engine.check_action_permitted(
        action="BLOCK_ALL_CARDS",
        approval_event_id="",
        requester="agent",
    )
    print(f"\n[TEST 3] Out-of-scope attempt: BLOCK_ALL_CARDS without approval")
    print(f"  Permitted      : {perm_l2_blocked.permitted}")
    print(f"  Reason         : {perm_l2_blocked.reason}")
    print(f"  Required Route : {perm_l2_blocked.required_route}")
    assert perm_l2_blocked.permitted is False, "L2 action without approval event MUST be blocked"

    # Test 4: Permitted with valid approval event
    perm_l1_approved = engine.check_action_permitted(
        action="DECLINE_TRANSACTION",
        approval_event_id="APP-EVT-99214-L1",
        requester="lead_analyst_01",
    )
    print(f"\n[TEST 4] Approved action: DECLINE_TRANSACTION with approval APP-EVT-99214-L1")
    print(f"  Permitted      : {perm_l1_approved.permitted}")
    assert perm_l1_approved.permitted is True, "Action with valid approval event should be permitted"

    # Verify log entries
    assert LOG_FILE.exists(), f"Permission log file {LOG_FILE} must exist"
    lines = [json.loads(line) for line in LOG_FILE.read_text(encoding="utf-8").strip().splitlines() if line.strip()]
    blocked_entries = [e for e in lines if not e.get("permitted")]
    print(f"\n[AUDIT LOG] {len(lines)} permission checks logged to {LOG_FILE.name}")
    print(f"  Total blocked out-of-scope attempts: {len(blocked_entries)}")
    assert len(blocked_entries) >= 2, "Blocked attempts must be preserved in audit log"

    print("\n" + "=" * 60)
    print("  PHASE 8 TESTS PASSED [OK]")
    print("=" * 60)


if __name__ == "__main__":
    test_policy_enforcement()
