"""
data/ingest.py
==============
Production ingestion script for FraudGraph on TigerGraph Savanna.

Loads the IEEE-CIS Fraud Detection dataset (transactions.csv, identity.csv,
closed_cases_history.csv) into TigerGraph as a graph.  case_pack.csv is
intentionally NOT loaded — those 20 benchmark cases are kept separate.

Usage
-----
  # Full ingest (reads from env vars for TG credentials)
  python data/ingest.py

  # Dry-run: parse & report but do NOT write to TigerGraph
  python data/ingest.py --dry-run

  # Load only specific entity types
  python data/ingest.py --only customers cards transactions edges

  # Dry-run a subset
  python data/ingest.py --dry-run --only customers transactions

Entity loading order (FK dependencies)
---------------------------------------
  1. customers          – unique customer_ids from transactions.csv
  2. cards              – one primary card per customer (customer_id + '-K1')
  3. device_profiles    – deduplicated from identity.csv on (DeviceInfo, id_30, id_31, id_33)
  4. billing_regions    – unique (addr1, addr2) pairs from transactions.csv
  5. transactions       – from transactions.csv
  6. edges              – MADE_TRANSACTION, TRANSACTION_WITH_CARD,
                         TRANSACTION_ON_DEVICE_PROFILE, OWNS_CARD,
                         TRANSACTION_IN_REGION
  7. closed_cases       – FraudCase vertices from closed_cases_history.csv
  8. case_edges         – CASE_ABOUT (→Customer), CASE_INVOLVES (→Transaction),
                         CASE_ON_CARD (→Card)
  9. fraud_patterns     – 5 known FraudPattern vertices
 10. policy_rules       – 10 Policy vertices (R1-R10)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import pandas as pd
from dotenv import load_dotenv

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ingest")

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
TXN_CSV    = BASE_DIR / "transactions.csv"
IDENT_CSV  = BASE_DIR / "identity.csv"
CASES_CSV  = BASE_DIR / "closed_cases_history.csv"
CASE_PACK  = BASE_DIR / "case_pack.csv"   # benchmark — NOT loaded
REPORT_MD  = BASE_DIR / "ingestion_report.md"

CHUNK_SIZE     = 10_000
LOG_EVERY_ROWS = 50_000

# ── Known entity sets (population stats) ─────────────────────────────────────
KNOWN_FRAUD_PATTERNS = [
    {
        "pattern_id":   "card_testing",
        "pattern_name": "Card Testing",
        "pattern_code": "FP-TEST-001",
        "description":  (
            "A stolen card number is checked before use: three or more tiny online "
            "authorizations, often under $5, then a larger purchase. Confirmed by "
            "the sequence itself."
        ),
        "pattern_type":  "burst_velocity",
        "detection_query": "velocity_burst_detection",
        "feature_vector":  json.dumps([{"feature": "small_auth_count", "weight": 0.5},
                                       {"feature": "time_window_minutes", "weight": 0.3},
                                       {"feature": "large_purchase_follows", "weight": 0.2}]),
        "hit_count":      0,
        "false_positive_rate": 0.05,
        "is_active":      True,
        "created_at":     "2024-01-01T00:00:00",
    },
    {
        "pattern_id":   "card_not_present_fraud",
        "pattern_name": "Card-Not-Present Fraud",
        "pattern_code": "FP-CNP-001",
        "description":  (
            "The card number is used online without the physical card. Amounts and "
            "products that don't fit the cardholder's history, often in a burst of "
            "two to four within 48 hours."
        ),
        "pattern_type":  "burst_velocity",
        "detection_query": "velocity_burst_detection",
        "feature_vector":  json.dumps([{"feature": "online_channel", "weight": 0.4},
                                       {"feature": "unusual_amount", "weight": 0.35},
                                       {"feature": "burst_48h", "weight": 0.25}]),
        "hit_count":      0,
        "false_positive_rate": 0.15,
        "is_active":      True,
        "created_at":     "2024-01-01T00:00:00",
    },
    {
        "pattern_id":   "card_not_present_new_device",
        "pattern_name": "Card-Not-Present Fraud from a New Device",
        "pattern_code": "FP-CNP-002",
        "description":  (
            "Same as CNP fraud, with the identity record marking the device as New "
            "for this account, sometimes behind a proxy. Stronger signal but still "
            "not proof: people buy new phones."
        ),
        "pattern_type":  "account_takeover",
        "detection_query": "shared_attribute_ring_detection",
        "feature_vector":  json.dumps([{"feature": "new_device_flag", "weight": 0.5},
                                       {"feature": "proxy_detected", "weight": 0.3},
                                       {"feature": "online_channel", "weight": 0.2}]),
        "hit_count":      0,
        "false_positive_rate": 0.20,
        "is_active":      True,
        "created_at":     "2024-01-01T00:00:00",
    },
    {
        "pattern_id":   "out_of_region_use",
        "pattern_name": "Out-of-Region Use",
        "pattern_code": "FP-REGION-001",
        "description":  (
            "Card-present purchases in a billing region the cardholder has no history "
            "in, while their normal activity continues at home. Several days of "
            "purchases in one new region is a trip, not a clone."
        ),
        "pattern_type":  "ring",
        "detection_query": "k_hop_expansion",
        "feature_vector":  json.dumps([{"feature": "new_region", "weight": 0.5},
                                       {"feature": "concurrent_home_activity", "weight": 0.4},
                                       {"feature": "in_person_channel", "weight": 0.1}]),
        "hit_count":      0,
        "false_positive_rate": 0.25,
        "is_active":      True,
        "created_at":     "2024-01-01T00:00:00",
    },
    {
        "pattern_id":   "account_takeover",
        "pattern_name": "Account Takeover",
        "pattern_code": "FP-ATO-001",
        "description":  (
            "Mixed-channel activity inconsistent with the cardholder, often with device "
            "and match-flag anomalies, pointing to stolen credentials rather than a "
            "stolen card number."
        ),
        "pattern_type":  "account_takeover",
        "detection_query": "entity_transaction_history",
        "feature_vector":  json.dumps([{"feature": "mixed_channel", "weight": 0.3},
                                       {"feature": "device_anomaly", "weight": 0.4},
                                       {"feature": "match_flag_fail", "weight": 0.3}]),
        "hit_count":      0,
        "false_positive_rate": 0.18,
        "is_active":      True,
        "created_at":     "2024-01-01T00:00:00",
    },
]

POLICY_RULES = [
    {
        "policy_id":   "R1",
        "policy_code": "R1",
        "title":       "Verify before blocking on a weak signal",
        "description": (
            "If the case rests on a single signal (including a risk score alone) and "
            "the assessed fraud probability is below 0.70, recommend VERIFY_WITH_CUSTOMER "
            "or STEP_UP_AUTH before any block. Blocking a legitimate customer on one "
            "signal is a policy breach."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "mandatory",
        "action_required":   "review",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R2",
        "policy_code": "R2",
        "title":       "Customer denies the transaction",
        "description": (
            "Recommend BLOCK_CARD and CREATE_CASE. Add FILE_REPORT if exposure exceeds "
            "$1,000 or the case connects to a shared device profile or another card's fraud."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "mandatory",
        "action_required":   "freeze",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R3",
        "policy_code": "R3",
        "title":       "Customer confirms the transaction",
        "description": (
            "Recommend CLOSE_NO_FRAUD. Note the confirmation in the case file."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "advisory",
        "action_required":   "none",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R4",
        "policy_code": "R4",
        "title":       "No reply within 24 hours",
        "description": (
            "Recommend MONITOR_CARD and DECLINE_TRANSACTION for pending authorizations. "
            "Escalate if exposure exceeds $500."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "warning",
        "action_required":   "review",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R5",
        "policy_code": "R5",
        "title":       "Card testing sequence",
        "description": (
            "Three or more small online authorizations on one card within an hour, "
            "followed by a larger purchase: recommend DECLINE_TRANSACTION and STEP_UP_AUTH. "
            "If a purchase over $100 has already cleared, recommend BLOCK_CARD."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "mandatory",
        "action_required":   "freeze",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R6",
        "policy_code": "R6",
        "title":       "Shared origin across multiple cards",
        "description": (
            "When several cards show fraud from the same device profile, the same billing "
            "region, or the same recipient email in one window, name the shared element, "
            "recommend CREATE_CASE and FILE_REPORT, and MONITOR_CONNECTED_CARDS for every "
            "card that shares it."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "mandatory",
        "action_required":   "sar",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R7",
        "policy_code": "R7",
        "title":       "Disputed but legitimate recurring charge",
        "description": (
            "When the customer disputes a charge that matches their own recurring pattern "
            "(same merchant, same amount, monthly), recommend CREATE_CASE, "
            "VERIFY_WITH_CUSTOMER, and WARN_CUSTOMER. Do not block."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "advisory",
        "action_required":   "review",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R8",
        "policy_code": "R8",
        "title":       "Escalate when uncertain and exposed",
        "description": (
            "If the verdict is uncertain and exposure exceeds $500, or the evidence "
            "conflicts, recommend ESCALATE_TO_ANALYST."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "mandatory",
        "action_required":   "escalate",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R9",
        "policy_code": "R9",
        "title":       "Undocumented patterns",
        "description": (
            "When activity fits none of the known patterns but the evidence shows "
            "coordinated or repeated abuse across customers, recommend CREATE_CASE, "
            "FILE_REPORT, and ESCALATE_TO_ANALYST. Describe the pattern in your own words. "
            "Do not force it into a known category."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "mandatory",
        "action_required":   "sar",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
    {
        "policy_id":   "R10",
        "policy_code": "R10",
        "title":       "Never block all cards without strong confirmation",
        "description": (
            "Never recommend BLOCK_ALL_CARDS unless at least two of the customer's cards "
            "show confirmed fraud or the customer's credentials are confirmed compromised."
        ),
        "regulation_source": "Internal Fraud Policy v1.0",
        "severity":          "mandatory",
        "action_required":   "none",
        "effective_from":    "2024-01-01",
        "effective_to":      "",
        "version":           "1.0",
        "is_active":         True,
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _device_profile_id(device_info: str, os_: str, browser: str, screen: str) -> str:
    """Stable SHA-256 hash of the four-field device profile key."""
    key = f"{device_info}|{os_}|{browser}|{screen}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]


def _safe_str(val: Any, default: str = "") -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return default
    return str(val)


def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        f = float(val)
        return f if pd.notna(f) else default
    except (TypeError, ValueError):
        return default


def _safe_int(val: Any, default: int = 0) -> int:
    try:
        v = int(float(val))
        return v
    except (TypeError, ValueError):
        return default


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


# ── TigerGraph connection ─────────────────────────────────────────────────────

def _connect_tg():
    """Return an authenticated pyTigerGraph connection."""
    try:
        import pyTigerGraph as tg
    except ImportError:
        log.error("pyTigerGraph is not installed. Run: pip install pyTigerGraph")
        sys.exit(1)

    host      = os.environ["TIGERGRAPH_HOST"]
    username  = os.environ["TIGERGRAPH_USERNAME"]
    password  = os.environ["TIGERGRAPH_PASSWORD"]
    graphname = os.environ["TIGERGRAPH_GRAPH_NAME"]
    secret    = os.environ.get("TIGERGRAPH_SECRET", "")
    token     = os.environ.get("TIGERGRAPH_TOKEN", "")

    log.info("Connecting to TigerGraph at %s  graph=%s", host, graphname)
    conn = tg.TigerGraphConnection(
        host=host,
        username=username,
        password=password,
        graphname=graphname,
    )

    # Prefer an explicit token; fall back to secret-based token generation
    if token:
        conn.apiToken = token
    elif secret:
        conn.apiToken = conn.getToken(secret)[0]
    else:
        try:
            secret_val = conn.createSecret()
            conn.apiToken = conn.getToken(secret_val)[0]
        except Exception as exc:
            log.warning("Could not auto-create token: %s — trying without token", exc)

    log.info("TigerGraph connection established.")
    return conn


# ── Upsert helpers ────────────────────────────────────────────────────────────

def _upsert_vertices(conn, vertex_type: str, rows: List[Dict], id_key: str, dry_run: bool) -> int:
    """Upsert a list of vertex attribute dicts. Returns count upserted."""
    if not rows:
        return 0
    if dry_run:
        return len(rows)
    batch = [[r[id_key], {k: v for k, v in r.items() if k != id_key}] for r in rows]
    conn.upsertVertices(vertex_type, batch)
    return len(rows)


def _upsert_edges(conn, edge_type: str, triples: List[tuple], dry_run: bool) -> int:
    """
    Upsert edges.  Each triple is (from_id, to_id, attrs_dict).
    Returns count upserted.
    """
    if not triples:
        return 0
    if dry_run:
        return len(triples)
    conn.upsertEdges(edge_type, triples)
    return len(triples)


# ── Step 1 — Customers ───────────────────────────────────────────────────────

def load_customers(conn, dry_run: bool) -> Set[str]:
    """Extract unique customer_ids from transactions.csv → Customer vertices."""
    log.info("=== Step 1: Customers ===")
    customer_ids: Set[str] = set()
    total_rows = 0

    for chunk in pd.read_csv(TXN_CSV, usecols=["customer_id"], chunksize=CHUNK_SIZE, low_memory=False):
        total_rows += len(chunk)
        if total_rows % LOG_EVERY_ROWS < CHUNK_SIZE:
            log.info("  Scanned %d rows for customers …", total_rows)
        customer_ids.update(chunk["customer_id"].dropna().astype(str).unique())

    log.info("  Found %d unique customers across %d rows.", len(customer_ids), total_rows)

    rows = [
        {
            "customer_id":            cid,
            "full_name":              "",
            "email":                  "",
            "phone":                  "",
            "date_of_birth":          "",
            "address_line1":          "",
            "address_line2":          "",
            "city":                   "",
            "country":                "",
            "postal_code":            "",
            "kyc_status":             "unknown",
            "kyc_verified_at":        "",
            "account_status":         "active",
            "account_created_at":     "",
            "risk_tier":              "unknown",
            "cumulative_risk_score":  0.0,
            "is_flagged":             False,
            "flag_reason":            "",
            "pep_status":             False,
            "sanctions_hit":          False,
            "total_transactions":     0,
            "total_transaction_value": 0.0,
            "last_activity_at":       "",
        }
        for cid in sorted(customer_ids)
    ]

    # Batch upsert in chunks of CHUNK_SIZE
    upserted = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        upserted += _upsert_vertices(conn, "Customer", rows[i:i + CHUNK_SIZE], "customer_id", dry_run)

    log.info("  Upserted %d Customer vertices.", upserted)
    return customer_ids


# ── Step 2 — Cards ───────────────────────────────────────────────────────────

def load_cards(conn, customer_ids: Set[str], dry_run: bool) -> None:
    """
    Derive one primary card per customer: card_id = customer_id + '-K1'.
    Additional card attributes come from the first occurrence of that customer
    in transactions.csv (card1..card6, addr1, addr2).
    """
    log.info("=== Step 2: Cards ===")
    card_attrs: Dict[str, dict] = {}
    total_rows = 0

    cols = ["customer_id", "card1", "card2", "card3", "card4", "card5", "card6", "addr1", "addr2"]
    for chunk in pd.read_csv(TXN_CSV, usecols=cols, chunksize=CHUNK_SIZE, low_memory=False):
        total_rows += len(chunk)
        if total_rows % LOG_EVERY_ROWS < CHUNK_SIZE:
            log.info("  Scanned %d rows for card attributes …", total_rows)
        for _, row in chunk.iterrows():
            cid = _safe_str(row.get("customer_id"))
            if not cid or cid in card_attrs:
                continue
            card_attrs[cid] = {
                "card_network":    _safe_str(row.get("card4")),    # visa | mastercard | amex | discover
                "card_type":       _safe_str(row.get("card6")),    # credit | debit
                "card1_code":      _safe_str(row.get("card1")),
                "billing_region":  _safe_str(row.get("addr1")),
                "billing_country": _safe_str(row.get("addr2")),
            }

    log.info("  Building %d Card vertices …", len(card_attrs))
    rows = []
    for cid in sorted(card_attrs.keys()):
        attrs = card_attrs[cid]
        rows.append({
            "card_id":              f"{cid}-K1",
            "card_number_masked":   "",
            "card_type":            attrs["card_type"],
            "card_network":         attrs["card_network"],
            "issuing_bank":         attrs["card1_code"],
            "issuing_country":      attrs["billing_country"],
            "expiry_month":         0,
            "expiry_year":          0,
            "card_status":          "active",
            "issued_at":            "",
            "linked_customer_count": 1,
            "is_shared":            False,
            "last_used_at":         "",
            # Extended attributes for FK lookups
            "customer_id":          cid,
            "billing_region":       attrs["billing_region"],
            "billing_country":      attrs["billing_country"],
        })

    upserted = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        upserted += _upsert_vertices(conn, "Card", rows[i:i + CHUNK_SIZE], "card_id", dry_run)
    log.info("  Upserted %d Card vertices.", upserted)


# ── Step 3 — DeviceProfiles ──────────────────────────────────────────────────

def load_device_profiles(conn, dry_run: bool) -> Dict[str, str]:
    """
    Read identity.csv, deduplicate on (DeviceInfo, id_30, id_31, id_33).
    Returns {txn_id → device_profile_id} map for edge creation.
    """
    log.info("=== Step 3: DeviceProfiles ===")
    profile_map: Dict[tuple, dict] = {}   # key_tuple → profile attrs
    txn_to_profile: Dict[str, str]  = {}  # TransactionID → device_profile_id
    total_rows = 0

    cols = ["TransactionID", "DeviceInfo", "DeviceType", "id_15", "id_23", "id_30", "id_31", "id_33"]
    for chunk in pd.read_csv(IDENT_CSV, usecols=cols, chunksize=CHUNK_SIZE, low_memory=False):
        total_rows += len(chunk)
        if total_rows % LOG_EVERY_ROWS < CHUNK_SIZE:
            log.info("  Scanned %d identity rows …", total_rows)
        for _, row in chunk.iterrows():
            device_info = _safe_str(row.get("DeviceInfo"))
            os_         = _safe_str(row.get("id_30"))
            browser     = _safe_str(row.get("id_31"))
            screen      = _safe_str(row.get("id_33"))
            key         = (device_info, os_, browser, screen)
            dpid        = _device_profile_id(device_info, os_, browser, screen)
            txn_id      = _safe_str(row.get("TransactionID"))

            txn_to_profile[txn_id] = dpid

            if key not in profile_map:
                profile_map[key] = {
                    "device_profile_id":  dpid,
                    "device_info":        device_info,
                    "os":                 os_,
                    "browser":            browser,
                    "screen":             screen,
                    "device_type":        _safe_str(row.get("DeviceType")),
                    "proxy_type":         _safe_str(row.get("id_23")),
                    "is_new_device_flag": _safe_str(row.get("id_15")),
                    "first_seen_at":      "",
                    "last_seen_at":       "",
                    "linked_transaction_count": 0,
                    "linked_customer_count":    0,
                }
            profile_map[key]["linked_transaction_count"] += 1

    rows = list(profile_map.values())
    log.info("  Found %d unique device profiles across %d identity rows.", len(rows), total_rows)

    upserted = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        upserted += _upsert_vertices(conn, "DeviceProfile", rows[i:i + CHUNK_SIZE], "device_profile_id", dry_run)
    log.info("  Upserted %d DeviceProfile vertices.", upserted)
    return txn_to_profile


# ── Step 4 — BillingRegions ──────────────────────────────────────────────────

def load_billing_regions(conn, dry_run: bool) -> Set[str]:
    """Extract unique (addr1, addr2) pairs → BillingRegion vertices."""
    log.info("=== Step 4: BillingRegions ===")
    regions: Dict[str, str] = {}   # region_code → country_code
    total_rows = 0

    for chunk in pd.read_csv(TXN_CSV, usecols=["addr1", "addr2"], chunksize=CHUNK_SIZE, low_memory=False):
        total_rows += len(chunk)
        if total_rows % LOG_EVERY_ROWS < CHUNK_SIZE:
            log.info("  Scanned %d rows for regions …", total_rows)
        sub = chunk.dropna(subset=["addr1"])
        for _, row in sub.iterrows():
            rcode = _safe_str(row.get("addr1"))
            ccode = _safe_str(row.get("addr2"))
            if rcode and rcode not in regions:
                regions[rcode] = ccode

    rows = [
        {
            "region_code":    rc,
            "country_code":   cc,
            "is_home_country": (cc == "87"),
        }
        for rc, cc in regions.items()
    ]
    log.info("  Found %d unique billing regions.", len(rows))

    upserted = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        upserted += _upsert_vertices(conn, "BillingRegion", rows[i:i + CHUNK_SIZE], "region_code", dry_run)
    log.info("  Upserted %d BillingRegion vertices.", upserted)
    return set(regions.keys())


# ── Step 5 — Transactions ────────────────────────────────────────────────────

def load_transactions(conn, txn_to_profile: Dict[str, str], dry_run: bool) -> Set[str]:
    """Load Transaction vertices from transactions.csv."""
    log.info("=== Step 5: Transactions ===")
    total_rows = 0
    upserted   = 0
    txn_ids_loaded: Set[str] = set()

    # Representative Vesta features to preserve
    vesta_cols = ["C1", "C2", "C3", "D1", "D2", "D3", "M1", "M2", "M3", "V1", "V2", "V3"]

    all_cols = [
        "TransactionID", "TransactionAmt", "ts", "ProductCD", "channel", "risk_score",
        "addr1", "addr2", "P_emaildomain", "R_emaildomain", "customer_id",
    ] + vesta_cols

    for chunk in pd.read_csv(TXN_CSV, usecols=all_cols, chunksize=CHUNK_SIZE, low_memory=False):
        total_rows += len(chunk)
        if total_rows % LOG_EVERY_ROWS < CHUNK_SIZE:
            log.info("  Loaded %d / ~590,742 transaction rows …", total_rows)

        rows = []
        for _, row in chunk.iterrows():
            txn_id  = _safe_str(row.get("TransactionID"))
            cid     = _safe_str(row.get("customer_id"))
            card_id = f"{cid}-K1" if cid else ""
            dpid    = txn_to_profile.get(txn_id, "")

            rows.append({
                "transaction_id":    txn_id,
                "amount":            _safe_float(row.get("TransactionAmt")),
                "currency":          "USD",
                "timestamp":         _safe_str(row.get("ts")),
                "merchant_category": "",
                "merchant_category_code": "",
                "status":            "completed",
                "risk_score":        _safe_float(row.get("risk_score")),
                "risk_flags":        "[]",
                "auth_code":         "",
                "acquirer_reference": "",
                "channel":           _safe_str(row.get("channel")),
                "is_international":  False,
                "is_card_present":   _safe_str(row.get("channel")) == "in_person",
                "response_code":     "",
                "decline_reason":    "",
                "disputed":          False,
                "dispute_reason":    "",
                "dispute_filed_at":  "",
                "reversal_at":       "",
                "created_at":        _safe_str(row.get("ts")),
                # Dataset-specific extensions
                "product_cd":        _safe_str(row.get("ProductCD")),
                "billing_region":    _safe_str(row.get("addr1")),
                "billing_country":   _safe_str(row.get("addr2")),
                "p_email":           _safe_str(row.get("P_emaildomain")),
                "r_email":           _safe_str(row.get("R_emaildomain")),
                "customer_id":       cid,
                "card_id":           card_id,
                "device_profile_id": dpid,
                # Vesta features
                "c1": _safe_float(row.get("C1")),
                "c2": _safe_float(row.get("C2")),
                "c3": _safe_float(row.get("C3")),
                "d1": _safe_float(row.get("D1")),
                "d2": _safe_float(row.get("D2")),
                "d3": _safe_float(row.get("D3")),
                "m1": _safe_str(row.get("M1")),
                "m2": _safe_str(row.get("M2")),
                "m3": _safe_str(row.get("M3")),
                "v1": _safe_float(row.get("V1")),
                "v2": _safe_float(row.get("V2")),
                "v3": _safe_float(row.get("V3")),
            })
            txn_ids_loaded.add(txn_id)

        upserted += _upsert_vertices(conn, "Transaction", rows, "transaction_id", dry_run)

    log.info("  Upserted %d Transaction vertices.", upserted)
    return txn_ids_loaded


# ── Step 6 — Edges ───────────────────────────────────────────────────────────

def load_edges(conn, txn_to_profile: Dict[str, str], dry_run: bool) -> Dict[str, int]:
    """
    Emit four edge types:
      MADE_TRANSACTION      Customer → Transaction
      OWNS_CARD             Customer → Card
      TRANSACTION_WITH_CARD Transaction → Card
      TRANSACTION_ON_DEVICE_PROFILE Transaction → DeviceProfile  (online only)
      TRANSACTION_IN_REGION Transaction → BillingRegion
    """
    log.info("=== Step 6: Edges ===")
    counts: Dict[str, int] = {
        "MADE_TRANSACTION":              0,
        "OWNS_CARD":                     0,
        "TRANSACTION_WITH_CARD":         0,
        "TRANSACTION_ON_DEVICE_PROFILE": 0,
        "TRANSACTION_IN_REGION":         0,
    }

    # Track OWNS_CARD to emit once per customer
    owns_card_emitted: Set[str] = set()

    total_rows = 0
    cols = ["TransactionID", "customer_id", "ts", "channel", "addr1"]

    for chunk in pd.read_csv(TXN_CSV, usecols=cols, chunksize=CHUNK_SIZE, low_memory=False):
        total_rows += len(chunk)
        if total_rows % LOG_EVERY_ROWS < CHUNK_SIZE:
            log.info("  Edge scan: %d rows …", total_rows)

        made_txn_triples = []
        txn_card_triples = []
        dev_triples      = []
        region_triples   = []

        for _, row in chunk.iterrows():
            txn_id  = _safe_str(row.get("TransactionID"))
            cid     = _safe_str(row.get("customer_id"))
            ts      = _safe_str(row.get("ts"))
            channel = _safe_str(row.get("channel"))
            addr1   = _safe_str(row.get("addr1"))
            card_id = f"{cid}-K1" if cid else ""

            if cid and txn_id:
                made_txn_triples.append((cid, txn_id, {"initiated_at": ts, "channel": channel}))

            if txn_id and card_id:
                txn_card_triples.append((txn_id, card_id, {"card_entry_mode": ""}))

            if cid and card_id and cid not in owns_card_emitted:
                owns_card_emitted.add(cid)
                _upsert_edges(conn, "OWNS_CARD",
                              [(cid, card_id, {"registered_at": "", "is_primary": True, "nickname": ""})],
                              dry_run)
                counts["OWNS_CARD"] += 1

            dpid = txn_to_profile.get(txn_id, "")
            if dpid and channel == "online":
                dev_triples.append((txn_id, dpid, {"session_id": "", "app_version": ""}))

            if txn_id and addr1:
                region_triples.append((txn_id, addr1, {}))

        counts["MADE_TRANSACTION"]              += _upsert_edges(conn, "MADE_TRANSACTION",              made_txn_triples, dry_run)
        counts["TRANSACTION_WITH_CARD"]         += _upsert_edges(conn, "TRANSACTION_WITH_CARD",         txn_card_triples, dry_run)
        counts["TRANSACTION_ON_DEVICE_PROFILE"] += _upsert_edges(conn, "TRANSACTION_ON_DEVICE_PROFILE", dev_triples,      dry_run)
        counts["TRANSACTION_IN_REGION"]         += _upsert_edges(conn, "TRANSACTION_IN_REGION",         region_triples,   dry_run)

    log.info("  Edge counts: %s", counts)
    return counts


# ── Step 7 — ClosedCases ─────────────────────────────────────────────────────

def load_closed_cases(conn, txn_ids_loaded: Set[str], dry_run: bool) -> Dict[str, int]:
    """
    Load FraudCase vertices from closed_cases_history.csv.
    Emits CASE_ABOUT (→Customer), CASE_INVOLVES (→Transaction), CASE_ON_CARD (→Card).
    case_pack.csv is intentionally skipped.
    """
    log.info("=== Step 7: ClosedCases ===")
    case_rows:      List[dict] = []
    about_edges:    List[tuple] = []
    involves_edges: List[tuple] = []
    on_card_edges:  List[tuple] = []

    df = pd.read_csv(CASES_CSV, low_memory=False)
    log.info("  Read %d closed cases.", len(df))

    for _, row in df.iterrows():
        case_id  = _safe_str(row.get("case_id"))
        cid      = _safe_str(row.get("customer_id"))
        card_id  = _safe_str(row.get("card_id"))
        opened   = _safe_str(row.get("opened_at"))
        closed   = _safe_str(row.get("closed_at"))
        outcome  = _safe_str(row.get("outcome"))
        pattern  = _safe_str(row.get("pattern"))
        txn_ids_raw = _safe_str(row.get("txn_ids"))

        case_rows.append({
            "case_id":             case_id,
            "title":               f"Closed Case {case_id}",
            "description":         _safe_str(row.get("analyst_notes")),
            "created_at":          opened,
            "updated_at":          closed,
            "status":              "closed",
            "priority":            "medium",
            "risk_score":          0.0,
            "confidence_score":    1.0,
            "risk_history":        "[]",
            "decision":            "confirmed_fraud" if outcome == "confirmed_fraud" else "clear",
            "decision_rationale":  _safe_str(row.get("analyst_notes")),
            "decision_made_at":    closed,
            "sar_required":        outcome == "confirmed_fraud",
            "sar_generated":       _safe_str(row.get("report_filed")).lower() == "true",
            "sar_filed_at":        "",
            "sar_reference_id":    "",
            "assigned_analyst":    "",
            "total_exposure":      _safe_float(row.get("exposure_usd")),
            "recovered_amount":    0.0,
            "investigation_notes": _safe_str(row.get("analyst_notes")),
            "closed_at":           closed,
            "tags":                json.dumps([pattern] if pattern else []),
            # Extended fields
            "outcome":             outcome,
            "pattern":             pattern,
            "first_fraud_txn_id":  _safe_str(row.get("first_fraud_txn_id")),
            "exposure_usd":        _safe_float(row.get("exposure_usd")),
            "actions_taken":       _safe_str(row.get("actions_taken")),
            "report_filed":        _safe_str(row.get("report_filed")),
            "analyst_notes":       _safe_str(row.get("analyst_notes")),
            "customer_id":         cid,
            "card_id":             card_id,
            "verdict":             "fraud" if outcome == "confirmed_fraud" else "legitimate",
            "fraud_probability":   1.0 if outcome == "confirmed_fraud" else 0.0,
            "affected_txn_ids":    json.dumps(txn_ids_raw.split("|") if txn_ids_raw else []),
            "connected_card_ids":  json.dumps(_safe_str(row.get("connected_card_ids")).split("|")
                                              if _safe_str(row.get("connected_card_ids")) else []),
            "stop_reason":         "Case closed by analyst",
            "evidence_requests":   "[]",
        })

        if cid:
            about_edges.append((case_id, cid, {"role": "subject", "added_at": opened}))
        if card_id:
            on_card_edges.append((case_id, card_id, {}))

        for tid in txn_ids_raw.split("|"):
            tid = tid.strip()
            if tid and tid in txn_ids_loaded:
                involves_edges.append((case_id, tid, {"relevance": "primary", "added_at": opened, "added_by": "closed_case_import"}))

    log.info("  Upserting %d FraudCase vertices …", len(case_rows))
    upserted_cases = 0
    for i in range(0, len(case_rows), CHUNK_SIZE):
        upserted_cases += _upsert_vertices(conn, "FraudCase", case_rows[i:i + CHUNK_SIZE], "case_id", dry_run)

    about_count    = _upsert_edges(conn, "CASE_ABOUT",    about_edges,    dry_run)
    involves_count = _upsert_edges(conn, "CASE_INVOLVES", involves_edges, dry_run)
    on_card_count  = _upsert_edges(conn, "CASE_ON_CARD",  on_card_edges,  dry_run)

    log.info("  FraudCase: %d vertices, CASE_ABOUT: %d, CASE_INVOLVES: %d, CASE_ON_CARD: %d",
             upserted_cases, about_count, involves_count, on_card_count)

    return {
        "FraudCase":     upserted_cases,
        "CASE_ABOUT":    about_count,
        "CASE_INVOLVES": involves_count,
        "CASE_ON_CARD":  on_card_count,
    }


# ── Step 8 — FraudPatterns ───────────────────────────────────────────────────

def load_fraud_patterns(conn, dry_run: bool) -> int:
    log.info("=== Step 8: FraudPatterns ===")
    n = _upsert_vertices(conn, "FraudPattern", KNOWN_FRAUD_PATTERNS, "pattern_id", dry_run)
    log.info("  Upserted %d FraudPattern vertices.", n)
    return n


# ── Step 9 — Policy Rules ─────────────────────────────────────────────────────

def load_policy_rules(conn, dry_run: bool) -> int:
    log.info("=== Step 9: PolicyRules ===")
    n = _upsert_vertices(conn, "Policy", POLICY_RULES, "policy_id", dry_run)
    log.info("  Upserted %d Policy vertices.", n)
    return n


# ── Report writer ─────────────────────────────────────────────────────────────

def write_report(stats: dict, dry_run: bool) -> None:
    """Write ingestion_report.md with actual counts."""
    run_ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    mode   = "DRY-RUN (no data written to TigerGraph)" if dry_run else "LIVE (data written to TigerGraph)"

    lines = [
        "# FraudGraph Ingestion Report",
        "",
        f"**Run timestamp:** {run_ts}",
        f"**Mode:** {mode}",
        "",
        "---",
        "",
        "## Source File Counts",
        "",
        "| File | Expected rows | Loaded |",
        "|---|---|---|",
        f"| `transactions.csv` | 590,742 | {stats.get('transactions', 0):,} |",
        f"| `identity.csv` | 144,432 | {stats.get('identity_rows', 0):,} |",
        f"| `closed_cases_history.csv` | 5,565 | {stats.get('closed_cases', 0):,} |",
        f"| `case_pack.csv` | 20 benchmark cases | **NOT LOADED** (kept separate) |",
        "",
        "---",
        "",
        "## Vertex Counts",
        "",
        "| Vertex Type | Count |",
        "|---|---|",
        f"| Customer | {stats.get('customers', 0):,} |",
        f"| Card | {stats.get('cards', 0):,} |",
        f"| DeviceProfile | {stats.get('device_profiles', 0):,} |",
        f"| BillingRegion | {stats.get('billing_regions', 0):,} |",
        f"| Transaction | {stats.get('transactions', 0):,} |",
        f"| FraudCase (closed history) | {stats.get('closed_cases', 0):,} |",
        f"| FraudPattern | {stats.get('fraud_patterns', 0):,} |",
        f"| Policy | {stats.get('policy_rules', 0):,} |",
        "",
        "---",
        "",
        "## Edge Counts",
        "",
        "| Edge Type | Count |",
        "|---|---|",
        f"| MADE_TRANSACTION (Customer→Transaction) | {stats.get('MADE_TRANSACTION', 0):,} |",
        f"| OWNS_CARD (Customer→Card) | {stats.get('OWNS_CARD', 0):,} |",
        f"| TRANSACTION_WITH_CARD (Transaction→Card) | {stats.get('TRANSACTION_WITH_CARD', 0):,} |",
        f"| TRANSACTION_ON_DEVICE_PROFILE (Transaction→DeviceProfile) | {stats.get('TRANSACTION_ON_DEVICE_PROFILE', 0):,} |",
        f"| TRANSACTION_IN_REGION (Transaction→BillingRegion) | {stats.get('TRANSACTION_IN_REGION', 0):,} |",
        f"| CASE_ABOUT (FraudCase→Customer) | {stats.get('CASE_ABOUT', 0):,} |",
        f"| CASE_INVOLVES (FraudCase→Transaction) | {stats.get('CASE_INVOLVES', 0):,} |",
        f"| CASE_ON_CARD (FraudCase→Card) | {stats.get('CASE_ON_CARD', 0):,} |",
        "",
        "---",
        "",
        "## Assumptions & Schema Mapping Notes",
        "",
        "### Card ID derivation",
        "The dataset does not include a pre-built card ID column in `transactions.csv`.",
        "Card IDs in `case_pack.csv` follow the pattern `{customer_id}-K1` (e.g. `C01234-K1`).",
        "This script derives the primary card_id as `customer_id + '-K1'` for every customer.",
        "Customers with multiple cards (K2, K3 …) are not present in `transactions.csv` directly;",
        "additional card IDs appear only in `closed_cases_history.csv` as `card_id` or `connected_card_ids`.",
        "",
        "### Device profile key",
        "DeviceProfile vertices are deduplicated on `(DeviceInfo, id_30 [OS], id_31 [browser], id_33 [screen])`.",
        "The `device_profile_id` is a 32-char SHA-256 prefix of that concatenated key.",
        "This means two transactions from the same physical device but different browser versions",
        "get different profile IDs — by design, to track software-level changes.",
        "",
        "### Online vs. in_person",
        "Transactions with `ProductCD = W` are in-person (no identity record).",
        "All other ProductCDs (C, H, R, S) are online and have an identity record in `identity.csv`.",
        "TRANSACTION_ON_DEVICE_PROFILE edges are emitted only for online transactions (channel='online').",
        "",
        "### Billing region",
        "`addr1` is the billing region code; `addr2` is the billing country code (87 = home country).",
        "BillingRegion vertices use `addr1` as the primary key.",
        "`is_home_country = True` when `addr2 == '87'`.",
        "",
        "### Closed cases",
        "`txn_ids` in `closed_cases_history.csv` is pipe-separated.",
        "CASE_INVOLVES edges are only emitted for transaction IDs that were successfully loaded",
        "(i.e., present in `transactions.csv`).",
        "",
        "### case_pack.csv",
        "The 20 benchmark cases in `case_pack.csv` are NOT loaded as FraudCase vertices.",
        "They are kept separate so the agent can use them as the investigation target",
        "without polluting the closed-case history memory.",
        "",
        "---",
        "",
        f"*Generated by `data/ingest.py` at {run_ts}*",
    ]

    report_text = "\n".join(lines)
    REPORT_MD.write_text(report_text, encoding="utf-8")
    log.info("Report written to %s", REPORT_MD)
    print("\n" + "=" * 60)
    print(report_text)
    print("=" * 60 + "\n")


# ── Main orchestrator ─────────────────────────────────────────────────────────

ALL_STEPS = [
    "customers", "cards", "device_profiles", "billing_regions",
    "transactions", "edges", "closed_cases", "fraud_patterns", "policy_rules",
]


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Ingest IEEE-CIS Fraud dataset into TigerGraph FraudGraph.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse CSVs and print report but do NOT write to TigerGraph.",
    )
    parser.add_argument(
        "--only", nargs="+", metavar="STEP",
        choices=ALL_STEPS,
        help=(
            "Load only specified entity types. Valid values: "
            + ", ".join(ALL_STEPS)
        ),
    )
    args = parser.parse_args()

    steps = set(args.only) if args.only else set(ALL_STEPS)
    dry_run: bool = args.dry_run

    if dry_run:
        log.info("DRY-RUN mode — no data will be written to TigerGraph.")

    conn = None if dry_run else _connect_tg()

    stats: Dict[str, Any] = {}
    txn_to_profile: Dict[str, str] = {}
    txn_ids_loaded: Set[str]       = set()
    customer_ids:   Set[str]       = set()

    t0 = time.monotonic()

    # ── Always need device profiles before transactions (for edge map) ─────
    # If only a subset is requested, we still need device profiles if
    # transactions or edges are requested.
    need_device_profiles = bool({"device_profiles", "transactions", "edges"} & steps)

    if need_device_profiles:
        txn_to_profile = load_device_profiles(conn, dry_run)
        stats["device_profiles"] = len(set(txn_to_profile.values()))
        stats["identity_rows"]   = len(txn_to_profile)

    if "customers" in steps:
        customer_ids = load_customers(conn, dry_run)
        stats["customers"] = len(customer_ids)

    if "cards" in steps:
        load_cards(conn, customer_ids, dry_run)
        stats["cards"] = len(customer_ids)   # one primary card per customer

    if "billing_regions" in steps:
        region_codes = load_billing_regions(conn, dry_run)
        stats["billing_regions"] = len(region_codes)

    if "transactions" in steps:
        txn_ids_loaded = load_transactions(conn, txn_to_profile, dry_run)
        stats["transactions"] = len(txn_ids_loaded)

    if "edges" in steps:
        edge_counts = load_edges(conn, txn_to_profile, dry_run)
        stats.update(edge_counts)

    if "closed_cases" in steps:
        case_stats = load_closed_cases(conn, txn_ids_loaded, dry_run)
        stats["closed_cases"]   = case_stats["FraudCase"]
        stats["CASE_ABOUT"]    = case_stats["CASE_ABOUT"]
        stats["CASE_INVOLVES"] = case_stats["CASE_INVOLVES"]
        stats["CASE_ON_CARD"]  = case_stats["CASE_ON_CARD"]

    if "fraud_patterns" in steps:
        stats["fraud_patterns"] = load_fraud_patterns(conn, dry_run)

    if "policy_rules" in steps:
        stats["policy_rules"] = load_policy_rules(conn, dry_run)

    elapsed = time.monotonic() - t0
    log.info("All steps completed in %.1f seconds.", elapsed)

    write_report(stats, dry_run)


if __name__ == "__main__":
    main()
