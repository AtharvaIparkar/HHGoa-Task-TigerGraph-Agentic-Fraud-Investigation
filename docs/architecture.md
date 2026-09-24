# Architecture: TigerGraph Agentic Fraud Investigation System

## Overview

This document describes the full system architecture for the Hackathon HH Goa submission — a graph-native, LLM-powered fraud investigation co-pilot built on TigerGraph Savanna.

---

## Component Map

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM ARCHITECTURE — PHASE 0                          │
└────────────────────────────────────────────────────────────────────────────────┘

  Browser
    │
    │  HTTP/WS
    ▼
  ┌──────────────────────────────────┐
  │  React UI  (ui/, port 5173)      │
  │  ┌────────────┐ ┌──────────────┐ │
  │  │ Dashboard  │ │ Case Detail  │ │
  │  │ Case List  │ │ Graph View   │ │
  │  └────────────┘ └──────────────┘ │
  │  Zustand state / React Query     │
  └──────────────────┬───────────────┘
                     │ REST /api/v1/*
                     ▼
  ┌──────────────────────────────────┐
  │  FastAPI Backend (api/, port 8000│
  │  ┌─────────┐ ┌────────────────┐  │
  │  │ /cases  │ │ /investigate   │  │
  │  │ /graph  │ │ /actions       │  │
  │  └────┬────┘ └───────┬────────┘  │
  └───────┼──────────────┼───────────┘
          │              │ invoke agent
          │              ▼
          │  ┌──────────────────────────────────────────────────┐
          │  │  LangGraph State Machine  (agent/)               │
          │  │                                                  │
          │  │  ┌───────────┐                                   │
          │  │  │  Planner  │ ← Claude 3.5 Sonnet              │
          │  │  │   Node    │   Reads case context              │
          │  │  │           │   Produces investigation plan     │
          │  │  └─────┬─────┘                                   │
          │  │        │                                         │
          │  │  ┌─────▼─────┐                                   │
          │  │  │  Analyst  │ ← Fires MCP tool calls           │
          │  │  │   Node    │   fetch_history                   │
          │  │  │           │   expand_graph                    │
          │  │  │           │   detect_rings ◄─────┐           │
          │  │  │           │   check_velocity      │           │
          │  │  │           │   memory_lookup        │           │
          │  │  │           │   extract_case         │           │
          │  │  └─────┬─────┘                       │           │
          │  │        │                             │ retry     │
          │  │  ┌─────▼──────────┐                  │           │
          │  │  │  Evidence Gate │ ──── FAIL ────────┘           │
          │  │  │     Node       │                               │
          │  │  │  confidence >= │                               │
          │  │  │  0.75 to pass  │                               │
          │  │  └─────┬──────────┘                               │
          │  │        │ PASS                                     │
          │  │  ┌─────▼─────┐                                   │
          │  │  │   Actor   │ → calls Mock Action Service       │
          │  │  │   Node    │   freeze-account                  │
          │  │  │           │   send-customer-message           │
          │  │  │           │   update-crm                      │
          │  │  │           │   refund-transaction              │
          │  │  └─────┬─────┘                                   │
          │  │        │                                         │
          │  │  ┌─────▼─────┐                                   │
          │  │  │  Closure  │ → Update TigerGraph               │
          │  │  │   Node    │   Generate SAR if required        │
          │  │  │           │   Mark run terminal               │
          │  │  └───────────┘                                   │
          │  └──────────────────────────────────────────────────┘
          │              │
          │              │ MCP tool calls (HTTP)
          │              ▼
  ┌───────┼──────────────────────────────────────────────────────┐
  │       │  TigerGraph MCP Server  (mcp/, port 9000)           │
  │       │  Wraps GSQL queries as LLM-callable tools           │
  │       └──────────────────────────────────────────────────────┤
  │                     │ pyTigerGraph / REST++                  │
  │                     ▼                                        │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  TigerGraph Savanna Cloud  (FraudGraph)             │   │
  │  │                                                      │   │
  │  │  Vertices:                                           │   │
  │  │    Customer  Card  Device  Connection  Merchant      │   │
  │  │    Transaction  FraudCase  Evidence                  │   │
  │  │    Policy  FraudPattern  Action  Analyst             │   │
  │  │                                                      │   │
  │  │  Key edges:                                          │   │
  │  │    SHARED_DEVICE  ─── fraud ring detection           │   │
  │  │    SHARED_CARD    ─── fraud ring detection           │   │
  │  │    CASE_SIMILAR_TO ── memory / prior cases           │   │
  │  │    CASE_EVIDENCE  ─── evidence sufficiency           │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                                                              │
  │  ┌───────────────────────────────────────────────────────┐  │
  │  │  Mock Action Service  (mock-action-service/, :8001)  │  │
  │  │  POST /freeze-account       (needs approval_event_id)│  │
  │  │  POST /refund-transaction   (needs approval_event_id)│  │
  │  │  POST /send-customer-message                         │  │
  │  │  POST /update-crm                                    │  │
  │  └───────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────┘
```

---

## Differentiator Deep-Dives

### 1. Fraud-Ring Detection

```
Customer A ─── SHARED_DEVICE ─── Customer B
      │                               │
  SHARED_CARD               SHARED_DEVICE
      │                               │
Customer C ─── SHARED_CARD  ─── Customer D
```

- GSQL query: `shared_attribute_ring_detection.gsql`
- Uses label propagation via min-customer-id component labelling
- Returns all clusters of size ≥ N with avg risk scores
- A ring of 4+ customers sharing 2+ attributes = critical fraud indicator

### 2. Evidence-Sufficiency Gate

```
Analyst gathers evidence →
  total_evidence_weight = Σ(evidence_item.weight)
  current_confidence    = min(1.0, total_evidence_weight)

Gate check:
  IF confidence < 0.75:
      gate_failure_reason = "Need more evidence"
      gate_retry_count += 1
      → loop back to Analyst with extended plan
  ELSE:
      decision = f(risk_score, memory_prior, confidence)
      → proceed to Actor
```

Evidence weights:
| Evidence Type       | Weight |
|---------------------|--------|
| transaction_pattern | 0.30   |
| ring                | 0.40   |
| velocity            | 0.25   |
| prior_case          | 0.15   |
| behavioural         | 0.20   |

### 3. Memory via CASE_SIMILAR_TO

```
New Case K
    │
    ├── CASE_SIMILAR_TO (sim=0.87) ── Resolved Case A (decision: fraud)
    ├── CASE_SIMILAR_TO (sim=0.72) ── Resolved Case B (decision: fraud)
    └── CASE_SIMILAR_TO (sim=0.61) ── Resolved Case C (decision: clear)

memory_fraud_prior = 2/3 = 0.67
→ boosted starting confidence for Case K's investigation
```

- Similarity computed offline via cosine similarity on case feature vectors
- Feature vector: [avg_txn_amount, txn_count, ring_flag, velocity_flag, merchant_diversity, ...]
- Stored as edge attribute `similarity_score` on `CASE_SIMILAR_TO` edges
- Retrieved by `prior_case_similarity.gsql` at investigation start

---

## Data Flow

```
Alert / Manual trigger
  ↓
FraudCase created in TigerGraph (status=open)
  ↓
Planner Node asks Claude: "How should I investigate this case?"
  ↓
Analyst Node executes plan steps via MCP:
  1. entity_transaction_history → transaction_pattern evidence
  2. k_hop_expansion            → graph context
  3. shared_attribute_ring_detection → ring evidence
  4. velocity_burst_detection   → velocity evidence
  5. prior_case_similarity      → memory_fraud_prior
  6. case_subgraph_extraction   → full context packet
  ↓
Evidence Gate:
  confidence >= 0.75?  NO → retry Analyst
                       YES → continue
  ↓
Actor Node:
  decision = confirmed_fraud → POST /freeze-account + /send-customer-message
  decision = suspicious      → POST /send-customer-message + /update-crm
  risk >= 0.90               → generate SAR content
  ↓
Closure Node:
  Update FraudCase in TigerGraph:
    status, decision, confidence_score, risk_history (append-only JSON),
    sar_required, sar_generated, decision_rationale, updated_at
  Build CASE_SIMILAR_TO edges for future memory
  ↓
UI updated via polling / WebSocket
```

---

## GSQL Query Inventory

| Query | Purpose | Est. Runtime |
|-------|---------|-------------|
| `entity_transaction_history` | Full txn history for any entity | < 50ms |
| `k_hop_expansion` | BFS subgraph expansion | < 100ms |
| `shared_attribute_ring_detection` | Connected component fraud rings | < 500ms |
| `velocity_burst_detection` | Rapid transaction burst detection | < 50ms |
| `connected_components` | Global ring discovery (all customers) | < 2s |
| `prior_case_similarity` | Memory lookup via edge traversal | < 30ms |
| `case_subgraph_extraction` | Full case context packet assembly | < 100ms |

---

## Schema Entity-Relationship

```
Customer ──OWNS_CARD──► Card
Customer ──USES_DEVICE──► Device
Customer ──MADE_TRANSACTION──► Transaction
Transaction ──TRANSACTION_AT──► Merchant
Transaction ──TRANSACTION_WITH_CARD──► Card
Transaction ──TRANSACTION_ON_DEVICE──► Device
Transaction ──TRANSACTION_VIA_CONNECTION──► Connection
Customer ◄──SHARED_DEVICE──► Customer   [UNDIRECTED]
Customer ◄──SHARED_CARD──► Customer     [UNDIRECTED]
Device ◄──SHARED_IP──► Device           [UNDIRECTED]
FraudCase ──CASE_INVOLVES──► Transaction
FraudCase ──CASE_ABOUT──► Customer
FraudCase ──CASE_EVIDENCE──► Evidence
FraudCase ◄──CASE_SIMILAR_TO──► FraudCase [UNDIRECTED]
Evidence ──POLICY_CITATION──► Policy
Evidence ──PATTERN_MATCH──► FraudPattern
FraudCase ──CASE_ACTION──► Action
Action ──ACTION_APPROVED_BY──► Analyst
```

---

## Technology Decisions

### Why TigerGraph?
- Native multi-hop traversal for ring detection (SQL can't do this efficiently)
- Distributed graph engine handles 1M+ vertex subgraphs in sub-second
- GSQL gives full algorithmic control (custom connected-components, BFS)
- REST++ API + pyTigerGraph make integration straightforward

### Why LangGraph?
- Explicit state machine: each node has clear inputs/outputs
- Built-in retry logic for the evidence gate loop
- Checkpointing for investigation auditability
- Native tool-calling integration

### Why Evidence-Sufficiency Gating?
- Prevents the LLM from hallucinating a decision on sparse data
- Ensures every action is backed by quantified graph evidence
- Creates an auditable evidence chain for regulatory compliance

### Why Memory via CASE_SIMILAR_TO?
- Prior cases are the best predictor of new case outcomes
- Graph storage means similarity lookup is a single edge traversal
- Improves with every case resolved (flywheel effect)
