import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ShieldAlert, 
  ArrowLeft, 
  FileText, 
  Activity, 
  Share2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Users, 
  Layers, 
  CornerDownRight, 
  Send,
  Eye,
  Lock,
  RefreshCw
} from "lucide-react";

export const CaseDetailPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const id = caseId || "HHG-001";

  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedVerdict, setSimulatedVerdict] = useState<string | null>(null);
  const [showSarModal, setShowSarModal] = useState(false);
  const [approvalModalAction, setApprovalModalAction] = useState<string | null>(null);
  const [approvalIdInput, setApprovalIdInput] = useState("");
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);

  // Load case dossier from JSON or local mirror
  useEffect(() => {
    setLoading(true);
    fetch(`/api/cases/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCaseData(data);
        } else {
          // Fallback rich simulation data for the case
          setCaseData(getDefaultCaseDossier(id));
        }
        setLoading(false);
      })
      .catch(() => {
        setCaseData(getDefaultCaseDossier(id));
        setLoading(false);
      });
  }, [id]);

  function getDefaultCaseDossier(caseId: string) {
    const isRing = caseId === "HHG-014";
    const isHighSpend = caseId === "HHG-010";
    return {
      case_id: caseId,
      case: {
        status: "closed_fraud",
        verdict: isRing || isHighSpend ? "fraud" : "legitimate",
        fraud_probability: isRing ? 0.92 : isHighSpend ? 0.88 : 0.08,
        pattern: isRing ? "card_not_present_new_device" : isHighSpend ? "card_not_present_fraud" : "none",
        pattern_description: "",
        affected_txn_ids: isRing || isHighSpend ? ["3506725"] : [],
        first_suspicious_txn_id: isRing || isHighSpend ? "3506725" : "",
        connected_card_ids: isRing ? ["C08771-K1", "C02194-K2"] : [],
        connected_device_profiles: isRing ? ["SAMSUNG SM-G892A Build/NRD90M | Android 7.0 | Chrome"] : [],
        exposure_usd: isHighSpend ? 1000.03 : isRing ? 77.07 : 0.0,
        evidence: [
          { claim: `Transaction authorized for $${isHighSpend ? '1,000.03' : '77.07'} via online channel`, source: "graph", ref: "get_transaction_detail", entity_ids: ["3506725"] },
          { claim: isRing ? "Device profile shared across 3 distinct customer cards in 30 days" : "Velocity burst: 3 transactions within 24 hours", source: "graph", ref: "shared_attribute_ring_detection", entity_ids: ["DEV-889104b"] },
          { claim: "Prior institutional case CC-0141 confirmed identical device/region modus operandi", source: "graph", ref: "prior_case_similarity", entity_ids: ["CC-0141"] },
          { claim: "Policy rule R2 & Section 3a mandate card block and case creation upon customer denial", source: "document", ref: "R2", entity_ids: [] },
        ],
        similar_prior_cases: ["CC-0141", "CC-0002"],
        summary: `Investigation into alert ${caseId} completed. Evidence indicates ${isRing ? 'coordinated device sharing ring' : isHighSpend ? 'high exposure card-not-present fraud' : 'verified cardholder travel purchase'}. Actions executed under Policy v1.0.`,
        written_to_graph: true,
        graph_case_id: `CASE-2016-${caseId.replace("HHG-", "")}`,
      },
      evidence_requests: [
        { type: "customer_validation", asked_after_step: 4, assumed_response: "Customer states they did not make this purchase and still has the card" }
      ],
      next_best_actions: {
        initial: [
          { action: "VERIFY_WITH_CUSTOMER", route: "auto", reason: "R1: Single signal with fraud probability below 0.70; verify before blocking" },
          { action: "CREATE_CASE", route: "auto", reason: "Section 3a: Internal fraud case record opened" }
        ],
        final: [
          { action: "BLOCK_CARD", route: isHighSpend ? "L2" : "L1", reason: `R2: Confirmed unauthorized activity. Exposure routed to ${isHighSpend ? 'L2' : 'L1'}` },
          { action: "CREATE_CASE", route: "auto", reason: "R2: Write full investigation record into graph" },
          ...(isHighSpend || isRing ? [{ action: "FILE_REPORT", route: "L2", reason: "R2 & R6: Exposure exceeding $1,000 or shared device syndication requires regulatory SAR" }] : []),
          ...(isRing ? [{ action: "MONITOR_CONNECTED_CARDS", route: "auto", reason: "R6: Linked cards C08771-K1 placed under monitoring" }] : []),
        ],
        what_changed: "Customer denial raised fraud probability and escalated verification to immediate card block and case creation."
      },
      sar: {
        file: isHighSpend || isRing,
        reason: isHighSpend ? "FinCEN 31 CFR 1020.320: Exposure meets or exceeds $1,000 threshold." : isRing ? "Rule R6: Multi-card device syndication detected." : "Exposure below threshold; no SAR required.",
        narrative: isHighSpend || isRing ? `This Suspicious Activity Report documents unauthorized financial activity identified on account associated with case ${caseId}. Investigation confirmed unauthorized use inconsistent with cardholder baseline. Pursuant to FinCEN standards, the card was blocked and regulatory reporting initiated.` : "",
        subjects: isRing ? ["C13487", "C13487-K1", "C08771-K1", "DEV-889104b"] : ["C10434", "C10434-K1"],
        total_amount_usd: isHighSpend ? 1000.03 : isRing ? 77.07 : 0.0,
        activity_dates: ["2016-12-01", "2016-12-01"]
      },
      stop_reason: "Customer denial settled the verdict; card blocked and exposure bounded.",
      tool_calls: 7,
      tokens: 4250,
      latency_s: 0.12
    };
  }

  const handleSimulate = (responseType: "deny" | "confirm") => {
    setIsSimulating(true);
    setTimeout(() => {
      if (responseType === "deny") {
        setSimulatedVerdict("fraud");
        setCaseData((prev: any) => ({
          ...prev,
          case: {
            ...prev.case,
            verdict: "fraud",
            fraud_probability: 0.86,
            exposure_usd: 128.33,
            status: "closed_fraud",
          },
          next_best_actions: {
            ...prev.next_best_actions,
            final: [
              { action: "BLOCK_CARD", route: "L1", reason: "R2: Customer denied activity" },
              { action: "CREATE_CASE", route: "auto", reason: "R2: Open case in graph" },
            ],
            what_changed: "Customer denial increased fraud probability to 0.86 and triggered card block."
          }
        }));
      } else {
        setSimulatedVerdict("legitimate");
        setCaseData((prev: any) => ({
          ...prev,
          case: {
            ...prev.case,
            verdict: "legitimate",
            fraud_probability: 0.04,
            exposure_usd: 0.0,
            status: "closed_legitimate",
          },
          sar: { file: false, reason: "Rule R3: Cardholder confirmed transaction", narrative: "", subjects: [], total_amount_usd: 0, activity_dates: [] },
          next_best_actions: {
            ...prev.next_best_actions,
            final: [
              { action: "CLOSE_NO_FRAUD", route: "auto", reason: "R3: Customer confirmed transaction" }
            ],
            what_changed: "Customer confirmed purchase, lowering fraud probability to 0.04 and closing case."
          }
        }));
      }
      setIsSimulating(false);
    }, 600);
  };

  const handleExecuteAction = (actionName: string, route: string) => {
    if (route === "auto") {
      setApprovalSuccess(`Action '${actionName}' executed successfully by agent (auto-permitted). Logged to api/action_log.jsonl`);
      setTimeout(() => setApprovalSuccess(null), 4000);
    } else {
      setApprovalModalAction(actionName);
    }
  };

  const handleApproveL1L2 = () => {
    if (!approvalIdInput.trim()) {
      alert("Please enter a valid Approval Event ID (e.g. APP-EVT-9041)");
      return;
    }
    const act = approvalModalAction;
    setApprovalModalAction(null);
    setApprovalIdInput("");
    setApprovalSuccess(`Action '${act}' approved with ID '${approvalIdInput}' and executed. Logged to permission audit.`);
    setTimeout(() => setApprovalSuccess(null), 5000);
  };

  if (loading || !caseData) {
    return (
      <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
        <p>Retrieving case graph dossier from TigerGraph...</p>
      </div>
    );
  }

  const { case: c, next_best_actions: nba, sar, evidence_requests } = caseData;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <Link to="/cases" className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 font-mono">{id}</h1>
              <span className={`text-xs uppercase font-bold px-2.5 py-0.5 rounded border ${
                c.verdict === "fraud" ? "bg-rose-950/80 text-rose-300 border-rose-800" :
                c.verdict === "legitimate" ? "bg-emerald-950/80 text-emerald-300 border-emerald-800" :
                "bg-amber-950/80 text-amber-300 border-amber-800"
              }`}>
                {c.verdict}
              </span>
              <span className="text-xs text-slate-500 font-mono">Graph Vertex: {c.graph_case_id}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pattern: <span className="font-semibold text-slate-300">{c.pattern}</span> · Exposure: <span className="font-mono text-cyan-400">${c.exposure_usd?.toFixed(2) || '0.00'}</span>
            </p>
          </div>
        </div>

        {/* Meters: Risk & Confidence */}
        <div className="flex items-center gap-4 self-end md:self-auto">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Assessed Fraud Prob</div>
            <div className="text-lg font-bold font-mono text-cyan-400">{(c.fraud_probability * 100).toFixed(0)}%</div>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-purple-400">Confidence Gate (Diff B)</div>
            <div className="text-lg font-bold font-mono text-purple-300">0.98 / 0.70</div>
          </div>
          {sar.file && (
            <button
              onClick={() => setShowSarModal(true)}
              className="px-3 py-2 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-600/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View SAR Filing
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {approvalSuccess && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{approvalSuccess}</span>
        </div>
      )}

      {/* Simulation Bar (Evidence-Sufficiency Gating Loop) */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            Simulate Customer Verification Response (Policy Section 5)
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Demonstrates dynamic recommendation change: what the agent recommends before vs after verification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSimulate("deny")}
            disabled={isSimulating}
            className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800 text-rose-300 rounded text-xs font-medium transition-colors"
          >
            Simulate Denial ("Never Made It")
          </button>
          <button
            onClick={() => handleSimulate("confirm")}
            disabled={isSimulating}
            className="px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-800 text-emerald-300 rounded text-xs font-medium transition-colors"
          >
            Simulate Confirm ("It Was Me")
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid: Graph Topology (Left) + Reasoning & Decision (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Graph Topology (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Interactive Entity Subgraph Visualizer */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-200">Interactive Evidence Subgraph (TigerGraph Savanna)</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Differentiator A: Graph-Native Rings</span>
            </div>

            {/* Interactive Graph Canvas / SVG */}
            <div className="w-full h-72 bg-slate-950/90 rounded-lg border border-slate-800/80 relative overflow-hidden flex items-center justify-center p-4">
              <svg className="w-full h-full" viewBox="0 0 600 240">
                {/* Connecting Edges */}
                <line x1="120" y1="120" x2="260" y2="70" stroke="#334155" strokeWidth="2" strokeDasharray="4" />
                <line x1="260" y1="70" x2="400" y2="120" stroke="#0ea5e9" strokeWidth="2.5" />
                <line x1="400" y1="120" x2="520" y2="70" stroke="#f43f5e" strokeWidth="2" />
                <line x1="400" y1="120" x2="520" y2="170" stroke="#a855f7" strokeWidth="2" />
                <line x1="120" y1="120" x2="400" y2="120" stroke="#334155" strokeWidth="1.5" />

                {/* Node: Customer */}
                <g className="cursor-pointer">
                  <circle cx="120" cy="120" r="28" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                  <text x="120" y="117" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="bold">Customer</text>
                  <text x="120" y="130" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">C12382</text>
                </g>

                {/* Node: Card */}
                <g className="cursor-pointer">
                  <circle cx="260" cy="70" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                  <text x="260" y="67" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="bold">Card</text>
                  <text x="260" y="78" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">C12382-K1</text>
                </g>

                {/* Node: Transaction (Flagged) */}
                <g className="cursor-pointer">
                  <circle cx="400" cy="120" r="32" fill="#881337" stroke="#f43f5e" strokeWidth="2.5" />
                  <text x="400" y="116" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">Flagged Txn</text>
                  <text x="400" y="128" textAnchor="middle" fill="#fecdd3" fontSize="8" fontFamily="monospace">3514030</text>
                </g>

                {/* Node: Device Profile (Ring Anchor) */}
                <g className="cursor-pointer">
                  <circle cx="520" cy="70" r="26" fill="#1e1b4b" stroke="#a855f7" strokeWidth="2" />
                  <text x="520" y="67" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="bold">DeviceProfile</text>
                  <text x="520" y="78" textAnchor="middle" fill="#c084fc" fontSize="7" fontFamily="monospace">DEV-8891</text>
                </g>

                {/* Node: Connected Ring Card */}
                <g className="cursor-pointer">
                  <circle cx="520" cy="170" r="24" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                  <text x="520" y="167" textAnchor="middle" fill="#fef08a" fontSize="8" fontWeight="bold">Ring Card</text>
                  <text x="520" y="178" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">C08771-K1</text>
                </g>
              </svg>

              <div className="absolute bottom-2 left-2 flex items-center gap-3 text-[10px] text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span> Customer/Card</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Flagged Txn</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Shared Device</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Syndicate Card</span>
              </div>
            </div>

            {/* Topology details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-400">Connected Cards in Ring:</span>
                <div className="font-mono text-cyan-400 mt-0.5">
                  {c.connected_card_ids?.length ? c.connected_card_ids.join(", ") : "None (Single Card)"}
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-400">Shared Device Fingerprint:</span>
                <div className="font-mono text-purple-400 mt-0.5 truncate">
                  {c.connected_device_profiles?.length ? c.connected_device_profiles[0] : "None Detected"}
                </div>
              </div>
            </div>
          </div>

          {/* Evidence Claims List */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Synthesized Evidence Claims (GraphRAG)
            </h3>
            <div className="space-y-2">
              {c.evidence?.map((e: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {e.source} · {e.ref}
                    </span>
                    {e.entity_ids?.length > 0 && (
                      <span className="font-mono text-[10px] text-slate-500">
                        {e.entity_ids.join(", ")}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200">{e.claim}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Reasoning Trace, Decisions & Memory (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Decision & Action Panel (Before vs After) */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Next-Best-Actions (Approval Routed)
            </h3>

            {/* Before (Initial) */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                1. Initial Recommendation (Before Verification)
              </div>
              <div className="space-y-1.5">
                {nba?.initial?.map((a: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-slate-200">{a.action}</div>
                      <div className="text-[11px] text-slate-400">{a.reason}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      a.route === "auto" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                      a.route === "L1" ? "bg-cyan-950 text-cyan-300 border border-cyan-800" :
                      "bg-rose-950 text-rose-300 border border-rose-800"
                    }`}>
                      {a.route}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* After (Final) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                2. Final Recommendation (After Verification)
              </div>
              <div className="space-y-1.5">
                {nba?.final?.map((a: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950/90 border border-cyan-900/40 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-slate-100">{a.action}</div>
                      <div className="text-[11px] text-slate-400">{a.reason}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        a.route === "auto" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                        a.route === "L1" ? "bg-cyan-950 text-cyan-300 border border-cyan-800" :
                        "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}>
                        {a.route}
                      </span>
                      <button
                        onClick={() => handleExecuteAction(a.action, a.route)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-semibold transition-colors"
                      >
                        {a.route === "auto" ? "Execute" : "Approve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 italic mt-2">
                <strong>What Changed:</strong> {nba?.what_changed}
              </p>
            </div>
          </div>

          {/* Institutional Memory (Differentiator C) */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Institutional Memory Citations (Diff C)
            </h3>
            <p className="text-xs text-slate-400">
              Closed cases from July–October 2016 retrieved via <code>CASE_SIMILAR_TO</code> edges:
            </p>
            <div className="space-y-2">
              {c.similar_prior_cases?.length ? (
                c.similar_prior_cases.map((pcId: string) => (
                  <div key={pcId} className="p-2.5 rounded bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-amber-400 font-mono">{pcId}</div>
                      <div className="text-[11px] text-slate-400">Confirmed fraud pattern · Cited in summary</div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">sim=0.84</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 italic">No prior cases cited</div>
              )}
            </div>
          </div>

          {/* Investigation Summary & Stop Reason */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-2 text-xs">
            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Analyst Dossier Summary</div>
            <p className="text-slate-200 leading-relaxed">{c.summary}</p>
            <div className="pt-2 text-slate-400">
              <span className="font-semibold text-slate-300">Stop Reason:</span> {caseData.stop_reason}
            </div>
          </div>
        </div>
      </div>

      {/* SAR Modal */}
      {showSarModal && sar.file && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-slate-100">Suspicious Activity Report (FinCEN 31 CFR 1020.320)</h3>
              </div>
              <button onClick={() => setShowSarModal(false)} className="text-slate-400 hover:text-slate-200">
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <span className="text-slate-400 font-semibold">Filing Reason:</span>
                <p className="mt-0.5 text-slate-200 font-mono">{sar.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg">
                <div>
                  <span className="text-slate-500">Total Suspicious USD:</span>
                  <div className="font-bold text-cyan-400 font-mono text-sm">${sar.total_amount_usd?.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Activity Window:</span>
                  <div className="font-mono text-slate-300">{sar.activity_dates?.join(" to ")}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold">Subjects Named:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {sar.subjects?.map((s: string) => (
                    <span key={s} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold">Regulatory Narrative:</span>
                <div className="mt-1 p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-slate-200 leading-relaxed font-sans">
                  {sar.narrative}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSarModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Close SAR Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* L1/L2 Approval Modal */}
      {approvalModalAction && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-cyan-400">
              <Lock className="w-5 h-5" />
              <h3 className="font-bold text-slate-100">Action Approval Required</h3>
            </div>
            <p className="text-xs text-slate-400">
              Action <span className="font-mono text-cyan-300">{approvalModalAction}</span> requires formal sign-off under Policy Section 2.
            </p>
            <div>
              <label className="text-xs text-slate-300 block mb-1">Approval Event ID</label>
              <input
                type="text"
                placeholder="e.g. APP-EVT-2026-9041"
                value={approvalIdInput}
                onChange={(e) => setApprovalIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setApprovalModalAction(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveL1L2}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded text-xs font-bold"
              >
                Sign & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
