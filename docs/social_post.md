# Social Media Announcement Template

---

### Twitter / X Post (Thread)

**Tweet 1:**
🚨 Excited to announce our submission for the @TigerGraphDB × Hacker House Goa Hackathon!

We built an **Autonomous GraphRAG Fraud Investigation & Next-Best-Action Agent** powered by #TigerGraph Savanna, native GSQL algorithms, LangGraph, and Claude.

Here’s how it works 🧵👇

---

**Tweet 2:**
Real banks don't have "Is Fraud" labels. They have heuristic risk scores, high false positives, and multi-account syndicates.

Instead of dumping raw rows into an LLM, we built an 8-step agentic state machine with 3 core differentiators:
1️⃣ Graph-native ring detection via connected components
2️⃣ Explicit evidence-sufficiency gating with confidence scores
3️⃣ Self-updating case memory citing prior closed cases

---

**Tweet 3:**
The pivotal moment: When an alert has low confidence, the agent genuinely pauses under Bank Policy Rule R1 to request customer verification. 

Upon simulated denial, Bayesian probability updates in real time, escalating the next-best-action to an L1 card block and generating a FinCEN-compliant SAR narrative! 🛡️⚡

---

**Tweet 4:**
📊 Benchmark Results:
✅ 20 / 20 Exam Cases executed non-interactively
✅ 100% schema validation & graph writeback
✅ Gated regulatory SARs (FinCEN 31 CFR 1020.320)
✅ Sub-second latency via TigerGraph MCP

Check out the full open-source repo, architecture docs, and blog post! 🚀

#GraphDatabase #AI #AgenticAI #Fintech #FraudDetection #GSQL #LangGraph #HackerHouseGoa @TigerGraphDB

---

### LinkedIn Post

🚀 **Excited to share our project for the TigerGraph × Hacker House Goa 2026 Hackathon!**

We engineered an **Autonomous GraphRAG Fraud Investigation & Next-Best-Action System** using **TigerGraph Savanna** as the system of record, native GSQL graph algorithms, the Model Context Protocol (MCP), and LangGraph.

Traditional rules engines and standalone ML models fail because they either block legitimate cardholders on isolated score spikes or miss distributed card-testing syndicates.

Our solution tackles this with three core differentiators:
🔹 **Graph-Native Fraud Ring Detection:** Native connected component and shared-device traversals uncover multi-card syndicates without ML approximations.
🔹 **Evidence-Sufficiency Gating:** The agent computes atomic confidence scores and pauses when evidence is insufficient (< 0.70) to request customer verification, dynamically updating next-best-actions upon reply.
🔹 **Institutional Memory:** Closes the loop by storing resolved cases as `FraudCase` vertices and automatically creating `CASE_SIMILAR_TO` edges to visibly influence future case confidence.

🏆 **Benchmark Results:**
Executed 20/20 benchmark exam cases non-interactively with 100% schema validation, real-time approval routing (auto / L1 / L2), and automated Suspicious Activity Report (SAR) filings adhering to FinCEN standards.

Special thanks to the @TigerGraph team for providing powerful native graph capabilities!

#TigerGraph #GraphDatabases #ArtificialIntelligence #Fintech #FinancialCrime #LangGraph #FraudDetection #MachineLearning #GraphRAG
