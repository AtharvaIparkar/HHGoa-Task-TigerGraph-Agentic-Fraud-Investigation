"""
api/policy_engine.py
====================
Policy evaluation engine for the Fraud Investigation System.
Implements all 10 fraud policy rules (R1-R10), approval routing,
and permission checking with full audit logging.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


# ─── Exceptions ──────────────────────────────────────────────────────────────

class PolicyViolationError(Exception):
    """Raised when an action violates policy rules."""
    def __init__(self, action: str, reason: str):
        self.action = action
        self.reason = reason
        super().__init__(f"Policy violation for action '{action}': {reason}")


# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class ActionRecommendation:
    """A single recommended action with routing and reasoning."""
    action: str
    route: str          # 'auto', 'L1', or 'L2'
    reason: str
    rule_citation: str

    def to_dict(self) -> dict:
        return {
            "action": self.action,
            "route": self.route,
            "reason": self.reason,
            "rule_citation": self.rule_citation,
        }


@dataclass
class PolicyEvaluation:
    """Result of evaluating a case state against all policy rules."""
    applicable_rules: List[str] = field(default_factory=list)
    recommended_actions: List[ActionRecommendation] = field(default_factory=list)
    sar_required: bool = False
    sar_reason: str = ""
    policy_violations: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "applicable_rules": self.applicable_rules,
            "recommended_actions": [a.to_dict() for a in self.recommended_actions],
            "sar_required": self.sar_required,
            "sar_reason": self.sar_reason,
            "policy_violations": self.policy_violations,
        }


@dataclass
class PermissionResult:
    """Result of checking whether an action is permitted."""
    permitted: bool
    reason: str
    required_route: str

    def to_dict(self) -> dict:
        return {
            "permitted": self.permitted,
            "reason": self.reason,
            "required_route": self.required_route,
        }


# ─── Policy Engine ────────────────────────────────────────────────────────────

class PolicyEngine:
    """
    Evaluates fraud cases against policy rules R1-R10 and manages
    action approval routing (auto / L1 / L2).

    Approval routes:
        auto: agent can execute without human approval
        L1:   requires a logged approval_event_id from a Level-1 reviewer
        L2:   requires a logged approval_event_id from a Level-2 reviewer

    Exposure thresholds:
        BLOCK_CARD  → L1 if exposure <= $2,500, L2 if exposure > $2,500
    """

    APPROVAL_ROUTES: Dict[str, Optional[str]] = {
        "ALLOW_TRANSACTION":         "auto",
        "DECLINE_TRANSACTION":        "L1",
        "MONITOR_CARD":               "auto",
        "MONITOR_CONNECTED_CARDS":    "auto",
        "WARN_CUSTOMER":              "auto",
        "VERIFY_WITH_CUSTOMER":       "auto",
        "STEP_UP_AUTH":               "auto",
        "BLOCK_CARD":                 None,   # exposure-dependent — resolved at runtime
        "BLOCK_ALL_CARDS":            "L2",
        "GENERATE_REPORT":            "auto",
        "CREATE_CASE":                "auto",
        "FILE_REPORT":                "L2",
        "ESCALATE_TO_ANALYST":        "auto",
        "CLOSE_NO_FRAUD":             "auto",
    }

    # Path to the permission audit log
    _LOG_FILE = Path(__file__).parent / "permission_log.jsonl"

    # ── Route resolution ──────────────────────────────────────────────────────

    def get_approval_route(self, action: str, exposure_usd: float = 0.0) -> str:
        """
        Returns the approval route ('auto', 'L1', or 'L2') for a given action.
        For BLOCK_CARD, the route depends on the exposure amount:
            exposure <= $2,500  → L1
            exposure >  $2,500  → L2
        Raises PolicyViolationError if the action is unknown.
        """
        if action not in self.APPROVAL_ROUTES:
            raise PolicyViolationError(
                action,
                f"Unknown action '{action}'. Must be one of: {sorted(self.APPROVAL_ROUTES.keys())}",
            )
        route = self.APPROVAL_ROUTES[action]
        if route is None:
            # BLOCK_CARD: exposure-dependent routing
            return "L1" if exposure_usd <= 2500.0 else "L2"
        return route

    # ── Case evaluation ───────────────────────────────────────────────────────

    def evaluate_case(self, state: dict) -> PolicyEvaluation:
        """
        Evaluates a case state dict against all policy rules R1-R10.

        Expected state keys (all optional with sensible defaults):
            fraud_probability   float   0.0–1.0
            evidence_list       list    list of evidence strings
            verdict             str     'fraud'|'suspicious'|'clear'|'pending'
            customer_response   str     'denied'|'confirmed'|'no_reply'|None
            exposure_usd        float   total monetary exposure
            card_testing        bool    micro-transaction pattern detected
            shared_origin       bool    shared device/region with another case
            disputed_recurring  bool    disputed but recurring transaction
            undocumented_pattern bool   novel/undocumented fraud pattern
            confirmed_fraud_cards int  count of cards confirmed fraudulent
            credentials_compromised bool  stolen credentials confirmed
            response_hours_elapsed float  hours since VERIFY sent
            cleared_amount_usd  float   amount that cleared in card-testing

        Returns PolicyEvaluation with all applicable rules, recommended actions,
        SAR requirement, and any policy violations detected.
        """
        evaluation = PolicyEvaluation()

        # Run all rules — collect results
        rule_methods = [
            ("R1",  self.apply_rule_R1),
            ("R2",  self.apply_rule_R2),
            ("R3",  self.apply_rule_R3),
            ("R4",  self.apply_rule_R4),
            ("R5",  self.apply_rule_R5),
            ("R6",  self.apply_rule_R6),
            ("R7",  self.apply_rule_R7),
            ("R8",  self.apply_rule_R8),
            ("R9",  self.apply_rule_R9),
            ("R10", self.apply_rule_R10),
        ]

        seen_actions: set = set()

        for rule_id, method in rule_methods:
            result = method(state)
            if result:
                evaluation.applicable_rules.append(rule_id)
                for rec in result:
                    # De-duplicate actions; keep first citation
                    if rec.action not in seen_actions:
                        seen_actions.add(rec.action)
                        evaluation.recommended_actions.append(rec)

        # SAR assessment
        sar_needed, sar_reason = self._assess_sar(state)
        evaluation.sar_required = sar_needed
        evaluation.sar_reason = sar_reason

        # Policy violation checks
        evaluation.policy_violations = self._detect_violations(state)

        return evaluation

    # ── Individual rule implementations ───────────────────────────────────────

    def apply_rule(self, rule_id: str, case_state: dict) -> Optional[List[ActionRecommendation]]:
        """
        Apply a specific rule by ID and return recommended actions if it fires.
        Delegates to the individual apply_rule_RN methods.
        """
        method_map = {
            "R1":  self.apply_rule_R1,
            "R2":  self.apply_rule_R2,
            "R3":  self.apply_rule_R3,
            "R4":  self.apply_rule_R4,
            "R5":  self.apply_rule_R5,
            "R6":  self.apply_rule_R6,
            "R7":  self.apply_rule_R7,
            "R8":  self.apply_rule_R8,
            "R9":  self.apply_rule_R9,
            "R10": self.apply_rule_R10,
        }
        if rule_id not in method_map:
            raise PolicyViolationError(rule_id, f"Unknown rule ID '{rule_id}'")
        return method_map[rule_id](case_state)

    def apply_rule_R1(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R1: Verify before block on weak signal.
        Fires when: probability < 0.70 AND ≤ 1 evidence signal AND verdict is not 'fraud'
        Action: VERIFY_WITH_CUSTOMER (auto)
        """
        prob = state.get("fraud_probability", 0.0)
        evidence = state.get("evidence_list", [])
        verdict = state.get("verdict", "pending")

        if (
            prob < 0.70
            and len(evidence) <= 1
            and verdict not in ("fraud", "confirmed_fraud")
        ):
            return [
                ActionRecommendation(
                    action="VERIFY_WITH_CUSTOMER",
                    route="auto",
                    reason=(
                        f"R1: fraud probability {prob:.2f} is below 0.70 threshold "
                        f"with only {len(evidence)} signal(s); verify before taking blocking action"
                    ),
                    rule_citation="R1",
                )
            ]
        return None

    def apply_rule_R2(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R2: Customer denies → BLOCK_CARD + CREATE_CASE; + FILE_REPORT if exposure > $1000 or shared device.
        Fires when: customer_response == 'denied'
        """
        if state.get("customer_response") != "denied":
            return None

        exposure = state.get("exposure_usd", 0.0)
        shared_device = state.get("shared_origin", False)
        route = self.get_approval_route("BLOCK_CARD", exposure)

        actions = [
            ActionRecommendation(
                action="BLOCK_CARD",
                route=route,
                reason="R2: customer denied the transaction; block card immediately",
                rule_citation="R2",
            ),
            ActionRecommendation(
                action="CREATE_CASE",
                route="auto",
                reason="R2: customer denial requires formal case creation",
                rule_citation="R2",
            ),
        ]

        if exposure > 1000.0 or shared_device:
            sar_reason = []
            if exposure > 1000.0:
                sar_reason.append(f"exposure ${exposure:.2f} exceeds $1,000")
            if shared_device:
                sar_reason.append("activity linked to shared device")
            actions.append(
                ActionRecommendation(
                    action="FILE_REPORT",
                    route="L2",
                    reason=f"R2: SAR required — {'; '.join(sar_reason)}",
                    rule_citation="R2",
                )
            )
        return actions

    def apply_rule_R3(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R3: Customer confirms the transaction → CLOSE_NO_FRAUD.
        Fires when: customer_response == 'confirmed'
        """
        if state.get("customer_response") != "confirmed":
            return None
        return [
            ActionRecommendation(
                action="CLOSE_NO_FRAUD",
                route="auto",
                reason="R3: customer confirmed the transaction; close case as no fraud",
                rule_citation="R3",
            )
        ]

    def apply_rule_R4(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R4: No reply after 24 hours → MONITOR_CARD + DECLINE pending;
            escalate if exposure > $500.
        Fires when: customer_response == 'no_reply' AND response_hours_elapsed >= 24
        """
        if state.get("customer_response") != "no_reply":
            return None
        hours_elapsed = state.get("response_hours_elapsed", 0.0)
        if hours_elapsed < 24.0:
            return None

        exposure = state.get("exposure_usd", 0.0)
        actions = [
            ActionRecommendation(
                action="MONITOR_CARD",
                route="auto",
                reason=f"R4: no customer reply after {hours_elapsed:.0f}h; monitor card",
                rule_citation="R4",
            ),
            ActionRecommendation(
                action="DECLINE_TRANSACTION",
                route="L1",
                reason="R4: pending transactions declined while awaiting customer response",
                rule_citation="R4",
            ),
        ]
        if exposure > 500.0:
            actions.append(
                ActionRecommendation(
                    action="ESCALATE_TO_ANALYST",
                    route="auto",
                    reason=f"R4: exposure ${exposure:.2f} exceeds $500 with no reply; escalate",
                    rule_citation="R4",
                )
            )
        return actions

    def apply_rule_R5(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R5: Card testing pattern detected → DECLINE + STEP_UP_AUTH;
            if any charge > $100 cleared → also BLOCK_CARD.
        Fires when: card_testing == True
        """
        if not state.get("card_testing", False):
            return None

        exposure = state.get("exposure_usd", 0.0)
        cleared_amount = state.get("cleared_amount_usd", 0.0)

        actions = [
            ActionRecommendation(
                action="DECLINE_TRANSACTION",
                route="L1",
                reason="R5: card-testing micro-transaction pattern detected; decline all pending",
                rule_citation="R5",
            ),
            ActionRecommendation(
                action="STEP_UP_AUTH",
                route="auto",
                reason="R5: card-testing detected; require step-up authentication",
                rule_citation="R5",
            ),
        ]
        if cleared_amount > 100.0:
            route = self.get_approval_route("BLOCK_CARD", exposure)
            actions.append(
                ActionRecommendation(
                    action="BLOCK_CARD",
                    route=route,
                    reason=f"R5: cleared amount ${cleared_amount:.2f} exceeds $100 during card test; block card",
                    rule_citation="R5",
                )
            )
        return actions

    def apply_rule_R6(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R6: Shared origin (device/region) → CREATE_CASE + FILE_REPORT + MONITOR_CONNECTED_CARDS.
        Fires when: shared_origin == True
        """
        if not state.get("shared_origin", False):
            return None
        return [
            ActionRecommendation(
                action="CREATE_CASE",
                route="auto",
                reason="R6: activity linked to a shared device or region; create formal case",
                rule_citation="R6",
            ),
            ActionRecommendation(
                action="FILE_REPORT",
                route="L2",
                reason="R6: shared-origin activity meets SAR filing threshold",
                rule_citation="R6",
            ),
            ActionRecommendation(
                action="MONITOR_CONNECTED_CARDS",
                route="auto",
                reason="R6: monitor all cards connected via shared device/region",
                rule_citation="R6",
            ),
        ]

    def apply_rule_R7(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R7: Disputed but recurring transaction → CREATE_CASE + VERIFY + WARN (no block).
        Fires when: disputed_recurring == True
        """
        if not state.get("disputed_recurring", False):
            return None
        return [
            ActionRecommendation(
                action="CREATE_CASE",
                route="auto",
                reason="R7: disputed recurring charge; create case without blocking",
                rule_citation="R7",
            ),
            ActionRecommendation(
                action="VERIFY_WITH_CUSTOMER",
                route="auto",
                reason="R7: verify with customer before taking any block action on recurring charge",
                rule_citation="R7",
            ),
            ActionRecommendation(
                action="WARN_CUSTOMER",
                route="auto",
                reason="R7: warn customer of disputed recurring charge pattern",
                rule_citation="R7",
            ),
        ]

    def apply_rule_R8(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R8: Uncertain verdict with exposure > $500 → ESCALATE_TO_ANALYST.
        Fires when: verdict is not 'fraud' AND probability < 0.70 AND exposure > $500
        """
        prob = state.get("fraud_probability", 0.0)
        verdict = state.get("verdict", "pending")
        exposure = state.get("exposure_usd", 0.0)

        if (
            verdict not in ("fraud", "confirmed_fraud")
            and prob < 0.70
            and exposure > 500.0
        ):
            return [
                ActionRecommendation(
                    action="ESCALATE_TO_ANALYST",
                    route="auto",
                    reason=(
                        f"R8: uncertain verdict (probability {prob:.2f}) with exposure "
                        f"${exposure:.2f} > $500; escalate to human analyst"
                    ),
                    rule_citation="R8",
                )
            ]
        return None

    def apply_rule_R9(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R9: Undocumented/novel fraud pattern → CREATE_CASE + FILE_REPORT + ESCALATE.
        Fires when: undocumented_pattern == True
        """
        if not state.get("undocumented_pattern", False):
            return None
        return [
            ActionRecommendation(
                action="CREATE_CASE",
                route="auto",
                reason="R9: novel/undocumented fraud pattern detected; create case for review",
                rule_citation="R9",
            ),
            ActionRecommendation(
                action="FILE_REPORT",
                route="L2",
                reason="R9: undocumented pattern meets regulatory SAR threshold",
                rule_citation="R9",
            ),
            ActionRecommendation(
                action="ESCALATE_TO_ANALYST",
                route="auto",
                reason="R9: novel pattern requires specialist human review",
                rule_citation="R9",
            ),
        ]

    def apply_rule_R10(self, state: dict) -> Optional[List[ActionRecommendation]]:
        """
        R10: BLOCK_ALL_CARDS only if 2+ cards confirmed fraud OR credentials confirmed compromised.
        Fires when: confirmed_fraud_cards >= 2 OR credentials_compromised == True
        """
        confirmed_cards = state.get("confirmed_fraud_cards", 0)
        credentials_compromised = state.get("credentials_compromised", False)
        exposure = state.get("exposure_usd", 0.0)

        if confirmed_cards >= 2 or credentials_compromised:
            reason_parts = []
            if confirmed_cards >= 2:
                reason_parts.append(f"{confirmed_cards} cards confirmed fraudulent")
            if credentials_compromised:
                reason_parts.append("credentials confirmed compromised")
            return [
                ActionRecommendation(
                    action="BLOCK_ALL_CARDS",
                    route="L2",
                    reason=f"R10: {'; '.join(reason_parts)} — block all cards on customer account",
                    rule_citation="R10",
                )
            ]
        return None

    # ── SAR assessment ────────────────────────────────────────────────────────

    def _assess_sar(self, state: dict) -> tuple[bool, str]:
        """
        Determine whether a SAR should be filed.
        Conditions:
          - verdict is 'fraud'/'confirmed_fraud' OR probability >= 0.70
          - AND one of: exposure > $1,000 | shared device | coordinated/undocumented pattern
        Returns (should_file: bool, reason: str)
        """
        prob = state.get("fraud_probability", 0.0)
        verdict = state.get("verdict", "pending")
        fraud_confirmed = verdict in ("fraud", "confirmed_fraud") or prob >= 0.70

        if not fraud_confirmed:
            return False, "Insufficient fraud confidence for SAR (probability below 0.70 and verdict not fraud)"

        exposure = state.get("exposure_usd", 0.0)
        shared_origin = state.get("shared_origin", False)
        undocumented = state.get("undocumented_pattern", False)
        shared_device = state.get("shared_origin", False)  # used as a proxy for shared device

        reasons = []
        if exposure > 1000.0:
            reasons.append(f"exposure ${exposure:.2f} exceeds $1,000")
        if shared_origin or shared_device:
            reasons.append("activity connected to shared device or region (possible ring)")
        if undocumented:
            reasons.append("coordinated or undocumented fraud pattern (R9)")

        if reasons:
            return True, "SAR required: " + "; ".join(reasons)
        return False, "Fraud confirmed but no SAR trigger condition met (exposure <= $1,000, no shared origin, no ring)"

    # ── Violation detection ───────────────────────────────────────────────────

    def _detect_violations(self, state: dict) -> List[str]:
        """Detect logical policy violations in the case state."""
        violations = []
        exposure = state.get("exposure_usd", 0.0)
        verdict = state.get("verdict", "pending")
        customer_response = state.get("customer_response")

        # Attempting to close as no-fraud when customer has denied
        if customer_response == "denied" and verdict == "clear":
            violations.append(
                "VIOLATION: Cannot close as CLEAR when customer has explicitly denied the transaction"
            )

        # Attempting BLOCK_ALL_CARDS without the R10 trigger
        confirmed_cards = state.get("confirmed_fraud_cards", 0)
        credentials_ok = state.get("credentials_compromised", False)
        proposed_actions = state.get("proposed_actions", [])
        if "BLOCK_ALL_CARDS" in proposed_actions and confirmed_cards < 2 and not credentials_ok:
            violations.append(
                "VIOLATION: BLOCK_ALL_CARDS requires 2+ confirmed fraud cards or compromised credentials (R10)"
            )

        return violations

    # ── Permission checking ───────────────────────────────────────────────────

    def check_action_permitted(
        self,
        action: str,
        approval_event_id: str,
        requester: str,
        exposure_usd: float = 0.0,
    ) -> PermissionResult:
        """
        Checks if an action can be executed.
        - auto actions: always permitted (agent can execute)
        - L1/L2 actions: require a logged approval_event_id (non-empty)
        Logs every check to api/permission_log.jsonl.
        Returns PermissionResult with permitted bool, reason, and required_route.
        """
        try:
            route = self.get_approval_route(action, exposure_usd)
        except PolicyViolationError as exc:
            result = PermissionResult(
                permitted=False,
                reason=str(exc),
                required_route="unknown",
            )
            self._log_permission_check(action, approval_event_id, requester, result)
            return result

        if route == "auto":
            result = PermissionResult(
                permitted=True,
                reason=f"Action '{action}' is auto-approved; no human approval required",
                required_route="auto",
            )
        else:
            # L1 / L2: require a non-empty approval_event_id
            if approval_event_id and approval_event_id.strip():
                result = PermissionResult(
                    permitted=True,
                    reason=f"Action '{action}' approved via {route} approval event '{approval_event_id}'",
                    required_route=route,
                )
            else:
                result = PermissionResult(
                    permitted=False,
                    reason=(
                        f"Action '{action}' requires {route} approval. "
                        f"No valid approval_event_id was provided."
                    ),
                    required_route=route,
                )

        self._log_permission_check(action, approval_event_id, requester, result)
        return result

    def _log_permission_check(
        self,
        action: str,
        approval_event_id: str,
        requester: str,
        result: PermissionResult,
    ) -> None:
        """Append a permission check record to the JSONL log."""
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "approval_event_id": approval_event_id or "",
            "requester": requester or "unknown",
            "permitted": result.permitted,
            "required_route": result.required_route,
            "reason": result.reason,
        }
        try:
            self._LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(self._LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception:
            # Non-fatal: log write failures should not block the action decision
            pass
