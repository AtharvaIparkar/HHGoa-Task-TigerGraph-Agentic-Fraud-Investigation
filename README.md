# TigerGraph Agentic Fraud Investigation System
## HH Goa Hackathon — Phase 0 Scaffold

> **An LLM-powered, graph-native fraud investigation co-pilot that detects fraud rings, gates decisions on evidence sufficiency, and learns from prior cases.**

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Chosen Differentiators](#chosen-differentiators)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Quick Start](#quick-start)
6. [Environment Variables](#environment-variables)
7. [Phase Completion Checklist](#phase-completion-checklist)

---

## Project Overview

Traditional fraud detection flags individual transactions in isolation. This system treats fraud as a **graph problem**: real fraudsters share devices, IPs, cards, and behavioural patterns across multiple accounts. By combining TigerGraph's multi-hop traversal power with an LLM agent orchestrated by LangGraph, the system:

- **Autonomously investigates** a fraud case end-to-end — from alert triage to SAR generation
- **Detects fraud rings** by finding connected components of shared attributes (device, IP, card)
- **Gates every decision** on quantified evidence sufficiency before taking any action
- **Accumulates memory** of prior cases so investigations get faster and more accurate over time

---

## Chosen Differentiators

### 1. 🕸️ Fraud-Ring Detection via Shared-Attribute Graphs
Most fraud systems analyse accounts individually. We build an explicit graph of **SHARED_DEVICE**, **SHARED_CARD**, and **SHARED_IP** edges between customers. A Weakly-Connected Components query reveals entire mule networks in a single traversal, even when each individual account looks borderline legitimate.

### 2. 🔒 Evidence-Sufficiency Gating
The agent cannot execute any consequential action (account freeze, refund, SAR filing) until a `confidence_score` threshold is passed and a minimum set of evidence node types is present in the case graph. This prevents hallucinated decisions — the LLM must **justify every action** by citing graph-derived evidence nodes.

### 3. 🧠 Memory-Based Confidence Boosting
Every resolved case is stored with its full subgraph fingerprint. When investigating a new case, the agent queries **CASE_SIMILAR_TO** edges (built via cosine similarity on case embeddings) to retrieve the top-K most similar resolved cases and their outcomes. This raises or lowers the agent's prior confidence before any new graph analysis, making the system measurably smarter over time.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FRAUD INVESTIGATION SYSTEM                           │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐    REST/WS    ┌────────────────────────────────────────────┐
  │  React   │◄────────────►│             FastAPI  (api/)                │
  │  UI      │              │  /cases  /investigate  /actions  /health   │
  └──────────┘              └──────────────────┬─────────────────────────┘
                                               │ invoke
                            ┌──────────────────▼─────────────────────────┐
                            │          LangGraph Agent  (agent/)         │
                            │                                            │
                            │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
                            │  │ Planner  │  │ Analyst  │  │ Actor   │ │
                            │  │  Node    │  │  Node    │  │  Node   │ │
                            │  └────┬─────┘  └────┬─────┘  └────┬────┘ │
                            │       │              │              │      │
                            │  ┌────▼──────────────▼──────────┐  │      │
                            │  │     GraphRAG Tool Belt        │  │      │
                            │  │  (MCP tool calls to TG)       │  │      │
                            │  └────────────────┬──────────────┘  │      │
                            │                   │                  │      │
                            │  ┌────────────────▼──────────────┐  │      │
                            │  │   Memory Store  (CASE_SIMILAR) │  │      │
                            │  └───────────────────────────────┘  │      │
                            └──────────────────┬───────────────────┘      │
                                               │ GSQL queries             │
                            ┌──────────────────▼─────────────────────────┐│
                            │        TigerGraph Savanna Cloud            ││
                            │           FraudGraph (GSQL)                ││
                            │  Vertices: Customer, Card, Device,         ││
                            │  Transaction, Merchant, FraudCase,         ││
                            │  Evidence, Policy, FraudPattern, ...       ││
                            └────────────────────────────────────────────┘│
                                                                           │
                            ┌──────────────────────────────────────────────┘
                            │  Mock Action Service  (mock-action-service/)
                            │  POST /freeze-account
                            │  POST /refund-transaction
                            │  POST /send-customer-message
                            │  POST /update-crm
                            └─────────────────────────────────────────────
```

### Data Flow

```
Alert / Manual Trigger
        │
        ▼
[1] Case Created in TigerGraph (FraudCase vertex)
        │
        ▼
[2] Planner Node — reads case, decides investigation strategy
        │
        ▼
[3] Analyst Node — fires MCP tool calls:
    ├── entity_transaction_history  (recent txns)
    ├── k_hop_expansion             (2-hop neighbours)
    ├── shared_attribute_ring_detection (fraud ring?)
    ├── velocity_burst_detection    (burst pattern?)
    ├── prior_case_similarity       (memory lookup)
    └── case_subgraph_extraction    (evidence assembly)
        │
        ▼
[4] Evidence-Sufficiency Gate
    ├── confidence_score < threshold → LOOP back to Analyst (more data)
    └── confidence_score ≥ threshold → proceed to Actor
        │
        ▼
[5] Actor Node — calls Mock Action Service with approval_event_id
    ├── freeze-account / refund / message / crm-update
    └── generate SAR if required
        │
        ▼
[6] Case updated in TigerGraph, risk_history appended (immutable log)
        │
        ▼
[7] UI updated via REST poll / WebSocket push
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Graph DB | TigerGraph Savanna (cloud-hosted GSQL) |
| Graph Query | GSQL v3, pyTigerGraph |
| MCP Server | TigerGraph MCP (tool wrappers in `/mcp`) |
| Agent | LangGraph + Claude 3.5 Sonnet (Anthropic) |
| GraphRAG | Custom subgraph-to-context pipeline |
| Memory | TigerGraph `CASE_SIMILAR_TO` edges + embedding index |
| Backend | FastAPI + Uvicorn |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State Mgmt | Zustand + TanStack Query |
| Charts | Recharts |
| Containers | Docker Compose |
| CI (future) | GitHub Actions |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker Desktop (optional, for containerised run)
- TigerGraph Savanna account + solution provisioned

### Option A — Local (one command)

**Linux / macOS:**
```bash
chmod +x setup.sh && ./setup.sh
```

**Windows PowerShell:**
```powershell
.\setup.ps1
```

Both scripts will:
1. Create a Python virtual environment
2. Install all Python dependencies (agent + api)
3. Install Node dependencies for the UI
4. Copy `.env.example` → `.env`
5. Print next steps

After the script, edit `.env` with your real credentials, then:

```bash
# Terminal 1 — API
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
uvicorn api.main:app --reload --port 8000

# Terminal 2 — UI
cd ui && npm run dev

# Terminal 3 — Mock Action Service
uvicorn mock-action-service.main:app --reload --port 8001
```

### Option B — Docker Compose
```bash
cp .env.example .env   # fill in your real values
docker compose up --build
```

- **UI**: http://localhost:5173
- **API**: http://localhost:8000/docs
- **Mock Actions**: http://localhost:8001/docs

---

## Environment Variables

| Variable | Description |
|---|---|
| `TIGERGRAPH_HOST` | Full URL of your TigerGraph Savanna solution |
| `TIGERGRAPH_USERNAME` | TigerGraph username (default: `tigergraph`) |
| `TIGERGRAPH_PASSWORD` | TigerGraph password |
| `TIGERGRAPH_GRAPH_NAME` | Graph name (e.g. `FraudGraph`) |
| `TIGERGRAPH_MCP_URL` | URL of the TigerGraph MCP server |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `SECRET_KEY` | FastAPI secret for JWT signing |
| `MOCK_ACTION_SERVICE_URL` | Base URL of the mock action service |
| `MOCK_ACTION_SERVICE_TOKEN` | Bearer token expected by mock action service |
| `CONFIDENCE_GATE_THRESHOLD` | Min confidence to allow actions (0–1, default 0.75) |
| `SAR_AUTO_THRESHOLD` | Auto-file SAR above this confidence (default 0.90) |
| `MAX_GRAPH_HOPS` | Max hops for k-hop expansion queries |
| `MEMORY_SIMILARITY_TOP_K` | How many prior cases to retrieve for memory |

---

## Phase Completion Checklist (All 12 Phases Completed)

| Phase | Description | Acceptance Bar / Deliverable | Status |
|---|---|---|---|
| **0. Scaffold** | Repo structure, one-command setup, schema DDL, root README | Fresh clone boots system | ✅ PASSED |
| **1. Ingest** | Full ingestion of transactions, identity, closed cases, patterns, rules | `/data/ingestion_report.md` | ✅ PASSED |
| **2. Graph Schema** | Vertices, non-obvious edges, fraud topology | `docs/schema_diagram.md` + justifications | ✅ PASSED |
| **3. GSQL Queries** | 7 installed GSQL queries & native algorithms | `graph/README.md` (documented calls/output) | ✅ PASSED |
| **4. MCP Integration** | 10 typed MCP tools + call logger | `mcp/test_tools.py` (11/11 passed) | ✅ PASSED |
| **5. GraphRAG** | Retrieval function & bounded evidence packet synthesis | `agent/graphrag.py` (exact prompt shown) | ✅ PASSED |
| **6. Agent Core** | 8-step inspectable state machine with simulation loop | `agent/run_case.py` (evidence loop trace) | ✅ PASSED |
| **7. Case & Memory** | `FraudCase` vertex writeback + `CASE_SIMILAR_TO` citations | `agent/memory.py` + case citations | ✅ PASSED |
| **8. Policy & Approvals** | Rules R1-R10, approval routing, mock action protection | `eval/test_policy_and_approvals.py` | ✅ PASSED |
| **9. SAR Generation** | FinCEN 31 CFR 1020.320 gated narrative generator | Gated SAR in `eval/cases/` | ✅ PASSED |
| **10. UI** | Dark data-dense ops console (Triage, Graph, Trace, SAR) | `ui/src/pages/` (React + Tailwind) | ✅ PASSED |
| **11. Benchmark Run** | Batch run on all 20 exam cases; 20 answer files emitted | `eval/benchmark_report.md` (20/20 valid) | ✅ PASSED |
| **12. Submission Package** | Blog post, demo video script, social post, clean repo | `docs/blog_post.md`, `docs/demo_video_script.md` | ✅ PASSED |

---

*Certified for TigerGraph × Hacker House Goa 2026 Hackathon*
