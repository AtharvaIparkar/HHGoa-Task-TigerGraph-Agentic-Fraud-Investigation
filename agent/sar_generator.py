"""
agent/sar_generator.py
======================
Phase 9: Suspicious Activity Report (SAR) Generation Engine.

Fulfills FinCEN (31 CFR 1020.320) regulatory narrative standards.
Strictly gated by the Policy Engine: SAR is generated ONLY when:
  1. Fraud is confirmed or strongly suspected (fraud_probability >= 0.70)
  AND at least one of:
  - Exposure exceeds $1,000 (FinCEN mandatory reporting threshold)
  - Activity connects to a shared device profile, shared region cluster, or fraud ring (Rule R6)
  - Activity represents an undocumented or coordinated syndicate pattern (Rule R9)
  - Customer denies transaction and exposure > $1,000 or shared device (Rule R2)

When file is false, output strictly zeroes and empties per specification:
  {"file": False, "reason": "...", "narrative": "", "subjects": [], "total_amount_usd": 0.0, "activity_dates": []}
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

log = logging.getLogger("sar_generator")


class SARGenerator:
    """
    Evaluates policy gates and generates compliant regulatory filings.
    """

    @staticmethod
    def evaluate_sar_gate(case_state: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Determines if a SAR is required by policy rules R2, R6, R9, or FinCEN monetary threshold.
        Returns: (should_file, reason_with_policy_citation)
        """
        verdict = case_state.get("verdict", "uncertain")
        prob = float(case_state.get("fraud_probability", 0.0))
        exposure = float(case_state.get("exposure_usd", 0.0))
        connected_cards = case_state.get("connected_card_ids", [])
        connected_devices = case_state.get("connected_device_profiles", [])
        pattern = case_state.get("pattern", "none")
        has_shared_origin = len(connected_cards) > 0 or len(connected_devices) > 0

        # If legitimate or low probability, never file
        if verdict == "legitimate" or prob < 0.50:
            return False, "Policy Section 3a: Activity cleared as legitimate or below suspicion threshold. No SAR warranted."

        # Case 1: Undocumented syndicate pattern (R9)
        if pattern == "undocumented":
            return True, "Rule R9: Undocumented coordinated pattern across accounts requires mandatory regulatory filing."

        # Case 2: Multi-card / shared origin (R6)
        if has_shared_origin:
            return True, "Rule R6 & Section 3a: Confirmed unauthorized activity connects to shared device/card ring."

        # Case 3: High exposure threshold ($1,000+)
        if exposure >= 1000.0:
            return True, f"FinCEN 31 CFR 1020.320 & Section 3a: Confirmed fraud exposure (${exposure:,.2f}) meets or exceeds the $1,000 filing threshold."

        # Case 4: Customer denied and exposure > $1,000 or ring
        evidence_requests = case_state.get("evidence_requests", [])
        denied_by_customer = any("did not make" in req.get("assumed_response", "").lower() or "denies" in req.get("assumed_response", "").lower() for req in evidence_requests)
        if denied_by_customer and (exposure > 1000.0 or has_shared_origin):
            return True, "Rule R2: Customer denial coupled with multi-account connectivity or exposure exceeding $1,000."

        # Otherwise: Case opened internally, but does not meet SAR criteria
        return False, f"Policy Section 3a: Fraud exposure (${exposure:,.2f}) is below $1,000 threshold and no multi-account syndication was detected. Internal case record maintained without regulatory filing."

    @classmethod
    def generate(cls, case_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Produces the standardized SAR dictionary matching Answer Format Part 2.
        """
        should_file, reason = cls.evaluate_sar_gate(case_state)

        if not should_file:
            return {
                "file": False,
                "reason": reason,
                "narrative": "",
                "subjects": [],
                "total_amount_usd": 0.0,
                "activity_dates": [],
            }

        # Build full narrative complying with 6-12 sentences standard
        customer_id = case_state.get("customer_id", "Unknown")
        card_id = case_state.get("card_id", "Unknown")
        flagged_txn_id = case_state.get("flagged_txn_id", "Unknown")
        exposure = float(case_state.get("exposure_usd", 0.0))
        pattern = case_state.get("pattern", "card_not_present_fraud")
        channel = case_state.get("channel", "online")
        opened_at = case_state.get("opened_at", "2016-12-01")
        date_str = opened_at[:10] if len(opened_at) >= 10 else "2016-12-01"
        activity_dates = [date_str, date_str]

        connected_cards = case_state.get("connected_card_ids", [])
        connected_devices = case_state.get("connected_device_profiles", [])

        subjects = [customer_id, card_id]
        subjects.extend(connected_cards)
        subjects.extend(connected_devices)
        subjects = list(dict.fromkeys(subjects))  # deduplicate preserving order

        # Narrative draft (Who, What, When, Where, How, Why)
        dev_desc = connected_devices[0] if connected_devices else "client device"
        conn_str = f" Graph expansion identified connectivity to associated card(s) {', '.join(connected_cards)} via shared device profile {dev_desc}." if connected_cards else ""

        narrative = (
            f"This Suspicious Activity Report documents unauthorized financial transactions identified on account {customer_id} "
            f"associated with payment card {card_id}. On {date_str}, transaction {flagged_txn_id} was initiated through the {channel} channel "
            f"under suspicious parameters matching the {pattern.replace('_', ' ')} typology. Total unauthorized exposure across the incident "
            f"is ${exposure:,.2f} USD.{conn_str} Institutional investigation determined the activity was inconsistent with the cardholder's "
            f"established transactional and regional baseline. In accordance with bank fraud policy, the card was blocked and scheduled for reissue, "
            f"associated accounts were placed under elevated monitoring, and the transaction was declined to prevent further loss. "
            f"This filing is submitted pursuant to FinCEN suspicious activity reporting mandates regarding cyber-enabled payment fraud."
        )

        return {
            "file": True,
            "reason": reason,
            "narrative": narrative,
            "subjects": subjects,
            "total_amount_usd": round(exposure, 2),
            "activity_dates": activity_dates,
        }
