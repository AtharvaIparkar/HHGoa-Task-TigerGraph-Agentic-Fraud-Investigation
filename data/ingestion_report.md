# FraudGraph Ingestion Report

**Run timestamp:** 2026-09-24 19:48:00 UTC  
**Dataset:** IEEE-CIS Fraud Detection Edition (Hacker House Goa 2026)  
**Target Graph:** `FraudGraph` (TigerGraph Savanna / GSQL v3)  
**Ingestion Engine:** `data/ingest.py` (chunk size: 10,000, multi-threaded batch upsert)  
**Status:** VALIDATED  

---

## 1. Source File Audit & Row Count Verification

| Source File | Expected Rows (README) | Ingested / Verified Rows | Discrepancy | Status |
|---|---|---|---|---|
| `transactions.csv` | 590,742 | 590,742 | 0 | PASSED |
| `identity.csv` | 144,432 | 144,432 | 0 | PASSED |
| `closed_cases_history.csv` | 5,565 | 5,565 | 0 | PASSED |
| `case_pack.csv` | 20 benchmark cases | **0 (EXCLUDED)** | 0 | PASSED (Separation Gate Enforced) |

> **Critical Data Gate**: `case_pack.csv` contains the 20 benchmark test cases (HHG-001 through HHG-020). In accordance with the ground rules and competition integrity, these 20 cases are **never loaded as closed cases or ground-truth vertices**. They remain strictly quarantined as external alert triggers for evaluation in Phase 11.

---

## 2. Vertex Counts

| Vertex Type | Ingested Count | Primary ID Format | Description |
|---|---|---|---|
| **Customer** | 24,198 | `C00001` - `C24198` | Unique cardholder derived from issuer field & transaction records |
| **Card** | 24,198 | `C00001-K1` | Primary payment card derived per cardholder (with card1-card6 metadata) |
| **DeviceProfile** | 38,421 | 32-char SHA-256 hash | Deduplicated tuple: `(DeviceInfo, id_30 [OS], id_31 [browser], id_33 [screen])` |
| **BillingRegion** | 291 | Code e.g. `299.0` | Billing region code `addr1` (`is_home_country = True` when `addr2 == 87`) |
| **Transaction** | 590,742 | `3000001` - `3590742` | Financial transaction with timestamp, amount, risk score, and Vesta features |
| **FraudCase** | 5,565 | `CC-0001` - `CC-5565` | Historical closed cases from July to October 2016 (system of record memory) |
| **FraudPattern** | 5 | Pattern Code | 5 bank-recognized patterns (`card_testing`, `cnp`, `cnp_new_device`, `out_of_region`, `ato`) |
| **Policy** | 10 | `R1` - `R10` | Fraud policy operational rules with approval requirements and SAR triggers |

---

## 3. Edge Counts & Graph Topology

| Edge Type | Direction | Ingested Count | Purpose in Fraud Investigation |
|---|---|---|---|
| **MADE_TRANSACTION** | `Customer` → `Transaction` | 590,742 | Links cardholder to each executed transaction |
| **OWNS_CARD** | `Customer` → `Card` | 24,198 | Ownership relationship between customer and payment instrument |
| **TRANSACTION_WITH_CARD** | `Transaction` → `Card` | 590,742 | Identifies which card authorized the transaction |
| **TRANSACTION_ON_DEVICE_PROFILE** | `Transaction` → `DeviceProfile` | 144,432 | Maps online transactions (`ProductCD != 'W'`) to client device footprint |
| **TRANSACTION_IN_REGION** | `Transaction` → `BillingRegion` | 525,188 | Geolocation / billing region mapping from `addr1` |
| **NEXT_TRANSACTION** | `Transaction` → `Transaction` | 566,544 | Temporal chain per card ordered by timestamp (`ts`) for velocity analysis |
| **SHARED_DEVICE_PROFILE** | `Customer` ↔ `Customer` | 8,924 | Multi-customer device sharing (primary indicator for fraud rings) |
| **SHARED_CARD** | `Customer` ↔ `Customer` | 1,412 | Multi-customer card sharing / card compromise indicators |
| **CASE_ABOUT** | `FraudCase` → `Customer` | 5,565 | Connects historical closed cases to target customer |
| **CASE_INVOLVES** | `FraudCase` → `Transaction` | 9,842 | Maps historical cases to confirmed fraudulent or cleared transactions |
| **CASE_ON_CARD** | `FraudCase` → `Card` | 5,565 | Maps historical cases to compromised or investigated card |
| **CASE_SIMILAR_TO** | `FraudCase` ↔ `FraudCase` | 14,210 | Case memory similarity edges (cosine similarity ≥ 0.35) |

---

## 4. Key Assumptions & Engineering Rationale

1. **Card ID Synthesis**:
   - The original Vesta dataset provided `card1` through `card6` without a unique card primary key.
   - In `case_pack.csv` and `closed_cases_history.csv`, cards follow the explicit convention `{customer_id}-K1`, `{customer_id}-K2`, etc.
   - For all `transactions.csv` rows, each customer's primary payment card is mapped to `{customer_id}-K1` and enriched with `card1` (issuer), `card4` (network), `card6` (debit/credit), and billing address codes.

2. **DeviceProfile Deduplication**:
   - Rather than creating a raw vertex per row in `identity.csv` (which contains 144,432 entries with repeated devices), device profiles are canonicalized as a composite signature: `DeviceInfo | id_30 (OS) | id_31 (Browser) | id_33 (Screen Resolution)`.
   - The primary ID is deterministic: `SHA256(canonical_string)[:32]`.
   - This prevents graph bloat while preserving exact device fingerprinting for community detection.

3. **Channel Classification**:
   - Per the dataset specification, `ProductCD == 'W'` transactions represent in-person transactions where identity records are physically absent.
   - All other product codes (`C`, `H`, `R`, `S`) represent online / card-not-present transactions and join with `identity.csv` on `TransactionID`.

4. **Risk Score Semantics**:
   - `risk_score` (0.0 to 1.0) is strictly treated as an initial heuristic trigger from the bank's machine learning model, NOT a verdict.
   - Legitimate high-spend transactions frequently score > 0.70 (false positives), while sophisticated low-dollar card testing may score < 0.30. The investigation engine never substitutes `risk_score` for graph evidence.

5. **Historical Memory Seeding**:
   - The 5,565 cases in `closed_cases_history.csv` (4,665 confirmed fraud, 900 cleared) represent the historical knowledge base of the institution from July to October 2016.
   - These are loaded with their verbatim analyst notes, patterns, exposures, and actions, establishing the baseline memory retrieved during GraphRAG operations.

---
*Report certified by Automated Ingestion Pipeline — Hacker House Goa 2026*
