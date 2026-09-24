# Demo Video Script: Autonomous GraphRAG Fraud Investigation with TigerGraph

**Target Duration:** 3 to 4 Minutes  
**Featured Case:** `HHG-001` (Cardholder C12382, Transaction 3514030) + `HHG-014` (Syndicate Ring)  
**Presenter:** Engineering Team Lead  

---

### [00:00 - 00:35] Scene 1: The Problem & Architecture Overview
**Visual:** 
- Split screen: Left shows terminal booting the one-command setup (`./setup.sh`); right shows the dark ops-console dashboard (`localhost:5173/dashboard`).
- Camera zooms into the 4 KPI cards: 20/20 Benchmark Cases, 8 Detected Rings, 0.88 Mean Confidence, 2 SARs Filed.

**Voiceover:**
> "Welcome! In credit card fraud detection, transactions never come with an 'Is Fraud' label. Real banks face two huge challenges: high false positives on legitimate cardholders, and criminal rings that evade single-transaction score thresholds.
> 
> Here is our solution: an Autonomous GraphRAG Fraud Investigation and Next-Best-Action Agent built on **TigerGraph Savanna** as the system of record.
> 
> Our architecture combines native GSQL graph algorithms, the TigerGraph MCP interface, and an 8-step LangGraph state machine with explicit evidence-sufficiency gating."

---

### [00:35 - 01:25] Scene 2: Case Triage & Deep-Dive into HHG-001
**Visual:**
- Navigate to `/cases`. Click on **HHG-001** to open the case dossier.
- Show the case header: Customer `C12382`, Card `C12382-K1`, Flagged Transaction `3514030` ($77.07, in billing region 444.0).
- Highlight the **Assessed Fraud Probability** meter (24%) and **Confidence Gate** (0.98 vs 0.70 threshold).

**Voiceover:**
> "Let's investigate Case HHG-001. A real-time ML model flagged a $77.07 card-present purchase in billing region 444.0 with a risk score of 0.61. 
> 
> A conventional automated system might block this card immediately. But under Bank Fraud Policy Rule R1, blocking a customer on a single weak signal is a policy violation.
> 
> Look at our Next-Best-Action panel: before verification, the agent recommends `VERIFY_WITH_CUSTOMER` on the auto route, and opens an internal case record. Notice that `BLOCK_CARD` is withheld."

---

### [01:25 - 02:20] Scene 3: The Pivotal Moment — Evidence Request & Recommendation Update
**Visual:**
- Camera focuses on the Simulation Bar: *"Simulate Customer Verification Response (Policy Section 5)"*.
- Click **"Simulate Denial ('Never Made It')"**.
- Screen dynamically refreshes: 
  - Verdict changes to **FRAUD** (probability jumps from 0.24 to 0.52).
  - Next-Best-Actions panel updates in real time: Final recommendation now shows `BLOCK_CARD` with approval route `L1` (exposure under $2,500).
  - "What Changed" summary dynamically updates: *"Customer denial confirmed unauthorized activity, escalating verification to immediate card block."*

**Voiceover:**
> "Now, watch the core differentiator of our agentic system: the evidence-sufficiency gating loop.
> 
> Because the initial probability was below 0.70, the agent paused at Step 4, requested customer verification, and waited.
> 
> When we simulate the customer denying the transaction, the agent resumes at Step 6. Bayesian updating raises the fraud probability to 0.52.
> 
> Instantly, the Next-Best-Action transforms: under Rule R2, the final action escalates to `BLOCK_CARD`, properly routed to Level-1 lead approval, with complete audit logging. Notice also that because exposure is $77.07—well under the $1,000 FinCEN threshold—the SAR filing is correctly gated out."

---

### [02:20 - 03:05] Scene 4: Graph-Native Ring Detection (Differentiator A) & Case HHG-014
**Visual:**
- Switch to `/graph` (Graph Topology Explorer).
- Click on **RING-001** (SAMSUNG device profile `DEV-889104b`).
- Show the interactive graph canvas: central shared device connected to 4 distinct customers (`C13487`, `C08771`, `C02194`, `C09112`) and cross-card sharing edges.
- Click **"Open Dossier"** for HHG-014.
- Click **"View SAR Filing"** modal showing full FinCEN narrative and subjects list.

**Voiceover:**
> "Now let's examine Differentiator A: Graph-native fraud-ring detection.
> 
> In Case HHG-014, an analyst reported unusual purchases from a shared device profile.
> 
> Using TigerGraph's native connected components algorithm, the agent discovered that device `DEV-889104b` is shared across four distinct accounts with over $3,400 in syndicate exposure.
> 
> Because of this shared origin, Rule R6 triggers immediately: the agent recommends `MONITOR_CONNECTED_CARDS` for the entire ring, and generates a fully compliant Suspicious Activity Report with complete Who, What, When, Where, and Why narrative sections ready for FinCEN filing."

---

### [03:05 - 03:40] Scene 5: Institutional Memory & Benchmark Execution
**Visual:**
- Point to the **Institutional Memory Citations** panel showing prior closed cases (`CC-0141`, `CC-0002`).
- Switch to terminal. Run:
  `python eval/benchmark_runner.py --all`
- Show the 20/20 test results table scrolling with all green `[PASS]` marks in under 0.3 seconds.

**Voiceover:**
> "Under Differentiator C, every resolved case is written back to TigerGraph as a `FraudCase` vertex. In subsequent investigations, matching prior cases are automatically cited in the reasoning dossier, visibly boosting confidence.
> 
> Finally, we ran our batch benchmark runner across all 20 exam cases in `case_pack.csv`. All 20 cases executed non-interactively, passing 100% schema validation and writing individual answer files to `/cases/`."

---

### [03:40 - 04:00] Scene 6: Conclusion
**Visual:**
- Return to Dashboard view.
- Show GitHub repository link and TigerGraph Savanna badge.

**Voiceover:**
> "By combining TigerGraph's native graph storage and algorithms with an autonomous, approval-governed agent, we have built an investigation system that is fast, explainable, and compliant.
> 
> Thank you, and see you at Hacker House Goa 2026!"
