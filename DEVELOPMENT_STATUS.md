# FraudLens: TigerGraph Agentic Fraud Investigation System
## Development & Operational Status

**Hackathon**: Hacker House Goa 2026 — TigerGraph Challenge  
**Evaluation Standard**: 20 Exam Benchmark Cases (`HHG-001` through `HHG-020`)  
**Status**: COMPLETE · Full UI & Investigation Graph Redesign Deployed · Benchmark 100% Processed  

---

## 1. Executive Summary

FraudLens is an autonomous, GraphRAG-powered fraud investigation and Next-Best-Action (NBA) decision engine built on TigerGraph. It monitors payment transactions, traverses multi-hop identity and device topologies via GSQL, pauses for Bayesian evidence-sufficiency gating, resolves multi-card syndicate rings, and files FinCEN-compliant Suspicious Activity Reports (SARs).

The frontend has been completely redesigned from the ground up into a high-density, dark financial-crime intelligence operations console (inspired by Palantir Foundry, Stripe Radar Enterprise, and Unit21), featuring an interactive SVG topology canvas with bi-directional evidence linking, Before vs After Next-Best-Action recommendations, and formal approval audit routing.

---

## 2. Core Architecture & Verification Matrix

| Component | Implementation | Verification Bar | Status |
| :--- | :--- | :--- | :--- |
| **Graph Schema** | `graph/schema.gsql` | 9 vertex types, 11 edge types, DDL schema diagram | **Verified** |
| **GSQL Query Suite** | `graph/queries/*.gsql` (7 queries) | BFS rings, 2-hop entity expansion, velocity burst, similarity | **Verified** |
| **TigerGraph MCP Server** | `mcp/mcp_server.py`, `mcp/tools.py` | 11 MCP tools, stdio transport, test suite 11/11 passing | **Verified (11/11)** |
| **GraphRAG Evidence Pack** | `agent/graphrag.py` | Assembles multi-hop evidence graph under 3,000 tokens | **Verified** |
| **Investigation Agent** | `agent/run_case.py`, `agent/state.py` | 8-step LangGraph FSM, evidence gating pause, dynamic updates | **Verified** |
| **Case Memory** | `agent/memory.py` | `FraudCase` vertices + `CASE_SIMILAR_TO` edges for 5,565 closed cases | **Verified** |
| **Policy Engine** | `api/policy_engine.py` | Rules R1–R10, Auto/L1/L2 routing, approval audit trail | **Verified** |
| **SAR Generator** | `agent/sar_generator.py` | FinCEN 31 CFR 1020.320 compliance, 5-paragraph narrative | **Verified** |
| **Exam Benchmark** | `eval/benchmark_runner.py` | 20/20 exam cases executed, 100% schema validation, 0 crashes | **Verified (20/20)** |
| **FastAPI Backend** | `api/main.py`, `api/routers/*.py` | `/api/cases`, `/subgraph`, `/investigate`, `/actions` | **Active (Port 8000)** |
| **Mock Action Service** | `mock-action-service/main.py` | Idempotent mock action execution + audit logging | **Active (Port 8001)** |
| **Operations UI** | `ui/src/` (React + TypeScript + Vite) | Full UI/Graph redesign, bi-directional linking, dark ops styling | **Active (Port 5173)** |

---

## 3. The Three Key Differentiators

### Differentiator A: Graph-Native Multi-Card Fraud Rings
* **Mechanism**: Native GSQL BFS connected components (`shared_attribute_ring_detection.gsql` and `graph_expansion_2hop.gsql`) traverse `SHARED_DEVICE_PROFILE` and `SHARED_EMAIL` edges without machine learning approximations.
* **Result**: Detects 8 distinct multi-card syndicate rings (e.g. Ring-001 anchored around Samsung device profile `DEV-889104b` with cards `C13487-K1`, `C08771-K1`, `C02194-K2`).
* **Visualized**: Live in the Graph Topology Explorer (`/graph`) and directly inside the Case Dossier Subgraph.

### Differentiator B: Genuine Evidence-Sufficiency Gating Loop
* **Mechanism**: Explicit evidence sufficiency scoring before committing terminal actions. When initial confidence is `< 0.70`, the engine pauses terminal decisions and issues step-up verification (`VERIFY_WITH_CUSTOMER`).
* **Dynamic Adaptation**:
  * **Customer Confirms**: Assessed fraud probability collapses from `0.24` to `0.04`. Rule R3 applies: `CLOSE_NO_FRAUD` (no customer friction).
  * **Customer Denies**: Assessed fraud probability surges from `0.42` to `0.94`. Rule R2 applies: immediate `BLOCK_CARD (L1/L2)` and `CREATE_CASE`.
* **Interactive UI**: Demonstrated live via the Simulation Bar on every case page.

### Differentiator C: Institutional Case Memory via Graph Precedents
* **Mechanism**: Ingests 5,565 closed historical fraud cases from July–October 2016 as `FraudCase` vertices and links them using `CASE_SIMILAR_TO` edges weighted by topological and vector similarity.
* **Result**: Decisions cite specific historical precedents (e.g. `CC-0141`) directly in the analyst summary and evidence feed.

---

## 4. Redesigned Frontend Features

1. **Analytical Investigation Graph (`InvestigationGraph.tsx`)**:
   - High-performance SVG canvas with pan, zoom, center transaction, and fit controls.
   - Semantic node visual hierarchy: Central Flagged Transaction (glowing alert ring) → Subject Customer & Card → Device Fingerprint → Connected Ring Members → Precedent Cases.
   - **Bi-directional Highlighting**: Clicking any evidence claim highlights the exact graph path and entities; clicking any graph node opens the Node Detail Inspector drawer.
2. **Before vs After Next-Best-Action Comparison**:
   - Explicitly displays:
     - 1. Initial Recommendation (Before Verification)
     - 2. Final Recommendation (After Verification)
     - Decision Delta ("What Changed") rationale callout
   - 1-click execution for autonomous actions; formal Approval Modal for L1/L2 actions.
3. **Evidence Provenance Feed**:
   - Structured claim badges labeled with source (`OBSERVED`, `DERIVED`, `HISTORICAL`, `POLICY`).
4. **FinCEN 31 CFR 1020.320 SAR Regulatory Viewer**:
   - Complete regulatory modal with filing reason, total exposure, named subjects, and formal 5-paragraph narrative.
5. **Operations Triage Queue & Workstation**:
   - Fast case switcher and instant multi-field filtering across all 20 exam benchmark cases.

---

## 5. Live Services & How to Run

### Currently Active Processes
* **API Backend**: `http://localhost:8000` (FastAPI with reload enabled)
  - Health: `http://localhost:8000/health`
  - Swagger UI: `http://localhost:8000/docs`
* **Mock Action Service**: `http://localhost:8001` (Idempotent mock actions)
  - Health: `http://localhost:8001/health`
* **Frontend Operations Console**: `http://localhost:5173` (Vite React UI)
  - Triage Workstation: `http://localhost:5173/cases`
  - Sample Ring Case: `http://localhost:5173/cases/HHG-014`
  - Sample High-Exposure Case: `http://localhost:5173/cases/HHG-010`
  - Sample Low-Risk Case: `http://localhost:5173/cases/HHG-001`
  - Topology Explorer: `http://localhost:5173/graph`

### Start Commands (From Project Root)
```powershell
# 1. Start Mock Action Service (Port 8001)
python -m uvicorn main:app --host 0.0.0.0 --port 8001

# 2. Start FastAPI Backend (Port 8000)
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Start Frontend Operations Console (Port 5173)
cd ui
npm run dev
```

### Verification & Test Suite
```powershell
# Run MCP Tool Test Suite (11/11 tests)
python mcp/test_tools.py

# Run Policy Engine & Approval Routing Tests
python eval/test_policy_and_approvals.py

# Run Exam Benchmark Suite (20 cases)
python eval/benchmark_runner.py

# Test Production Frontend Build
cd ui
npm run build
```
