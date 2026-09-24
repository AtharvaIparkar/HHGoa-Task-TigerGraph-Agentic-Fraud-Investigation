import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Lock,
  RefreshCw,
  Share2,
  Check,
  ChevronDown
} from "lucide-react";
import { InvestigationGraph, GraphNode, GraphLink } from "../components/InvestigationGraph";

export const CaseDetailPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const id = caseId ? caseId.toUpperCase() : "HHG-001";

  const [caseData, setCaseData] = useState<any>(null);
  const [subgraphData, setSubgraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showSarModal, setShowSarModal] = useState(false);
  const [approvalModalAction, setApprovalModalAction] = useState<string | null>(null);
  const [approvalIdInput, setApprovalIdInput] = useState("");
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);
  const [selectedEvidenceIdx, setSelectedEvidenceIdx] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/cases/${id}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/cases/${id}/subgraph`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([dossier, subgraph]) => {
        if (dossier) setCaseData(dossier);
        else setCaseData(getFallbackCase(id));

        if (subgraph && subgraph.nodes && subgraph.links) {
          setSubgraphData({ nodes: subgraph.nodes, links: subgraph.links });
        } else {
          setSubgraphData(generateFallbackSubgraph(id, dossier));
        }
        setLoading(false);
      })
      .catch(() => {
        const fb = getFallbackCase(id);
        setCaseData(fb);
        setSubgraphData(generateFallbackSubgraph(id, fb));
        setLoading(false);
      });
  }, [id]);

  function getFallbackCase(caseId: string) {
    const isRing = caseId === "HHG-014";
    const isHighSpend = caseId === "HHG-010";
    return {
      case_id: caseId,
      trigger_type: isRing ? "analyst_request" : "risk_score",
      trigger_text: isRing
        ? "Multiple cards observed using shared device profile DEV-889104b."
        : isHighSpend
        ? "High exposure transaction 3506725 ($1,000.03, online) flagged by risk model."
        : "Real-time model flagged transaction 3514030 ($77.07, billing region 444.0).",
      flagged_txn_id: isHighSpend ? "3506725" : isRing ? "3478561" : "3514030",
      card_id: isHighSpend ? "C10434-K1" : isRing ? "C13487-K1" : "C12382-K1",
      customer_id: isHighSpend ? "C10434" : isRing ? "C13487" : "C12382",
      risk_score: isHighSpend ? 0.9 : isRing ? 0.7 : 0.61,
      confidence_score: isRing ? 0.92 : isHighSpend ? 0.88 : 0.04,
      verdict: isRing || isHighSpend ? "fraud" : "legitimate",
      exposure_usd: isHighSpend ? 1000.03 : isRing ? 77.07 : 0.0,
      case: {
        verdict: isRing || isHighSpend ? "fraud" : "legitimate",
        fraud_probability: isRing ? 0.92 : isHighSpend ? 0.88 : 0.04,
        pattern: isRing ? "device_sharing_ring" : isHighSpend ? "card_not_present_fraud" : "single_merchant_low_risk",
        exposure_usd: isHighSpend ? 1000.03 : isRing ? 77.07 : 0.0,
        evidence: [
          { claim: `Transaction authorized for $${isHighSpend ? "1,000.03" : "77.07"}`, source: "graph", ref: "get_transaction_detail", entity_ids: [isHighSpend ? "3506725" : isRing ? "3478561" : "3514030"] },
          { claim: isRing ? "Device profile shared across 3 accounts" : "Velocity within expected customer baseline", source: "graph", ref: "shared_attribute_ring_detection", entity_ids: ["DEV-889104b"] },
          { claim: "Prior institutional case CC-0141 confirmed pattern match", source: "graph", ref: "prior_case_similarity", entity_ids: ["CC-0141"] },
        ],
        similar_prior_cases: ["CC-0141"],
        summary: `Investigation into alert ${caseId} completed. Evidence indicates ${isRing ? "coordinated device sharing" : isHighSpend ? "unauthorized card-not-present transaction" : "verified cardholder purchase"}.`,
      },
      next_best_actions: {
        initial: [
          { action: "VERIFY_WITH_CUSTOMER", route: "auto", reason: "Single risk score signal below 0.70 threshold; step-up verification required" },
        ],
        final: [
          { action: isRing || isHighSpend ? "BLOCK_CARD" : "CLOSE_NO_FRAUD", route: isHighSpend ? "L2" : isRing ? "L1" : "auto", reason: isRing || isHighSpend ? "Confirmed unauthorized transaction. Exposure bounded." : "Cardholder confirmed transaction; cleared without disruption." },
        ],
        what_changed: isRing || isHighSpend
          ? "Customer denial elevated assessed fraud probability, triggering card block under Rule R2."
          : "Customer confirmation lowered fraud probability to 0.04, enabling case closure under Rule R3.",
      },
      sar: {
        file: isHighSpend || isRing,
        reason: isHighSpend ? "FinCEN 31 CFR 1020.320: Exposure meets or exceeds $1,000." : "Rule R6: Multi-card syndication detected.",
        narrative: "This Suspicious Activity Report documents unauthorized financial transactions identified on the subject account.",
        subjects: [isHighSpend ? "C10434" : "C13487"],
        total_amount_usd: isHighSpend ? 1000.03 : 77.07,
        activity_dates: ["2016-12-01"],
      },
      stop_reason: "Customer verification settled the verdict.",
    };
  }

  function generateFallbackSubgraph(caseId: string, dossier: any): { nodes: GraphNode[]; links: GraphLink[] } {
    const txnId = dossier?.flagged_txn_id || "3514030";
    const custId = dossier?.customer_id || "C12382";
    const cardId = dossier?.card_id || `${custId}-K1`;
    const verdict = dossier?.verdict || "legitimate";

    const nodes: GraphNode[] = [
      { id: `txn_${txnId}`, label: `Txn ${txnId}`, type: "transaction", status: verdict === "fraud" ? "flagged" : "verified", details: { amount_usd: dossier?.exposure_usd || 77.07, risk_score: dossier?.risk_score || 0.61 } },
      { id: `cust_${custId}`, label: `Customer ${custId}`, type: "customer", status: "subject", details: { customer_id: custId } },
      { id: `card_${cardId}`, label: `Card ${cardId}`, type: "card", status: verdict === "fraud" ? "compromised" : "active", details: { card_id: cardId } },
      { id: `dev_${caseId}`, label: "Device Fingerprint", type: "device", status: "verified", details: { fingerprint: "Samsung SM-G892A" } },
      { id: `prior_CC-0141`, label: "Precedent CC-0141", type: "prior_case", status: "cited", details: { similarity: 0.84 } },
    ];

    const links: GraphLink[] = [
      { id: "l1", source: `txn_${txnId}`, target: `cust_${custId}`, type: "PERFORMED_BY", is_primary: true },
      { id: "l2", source: `txn_${txnId}`, target: `card_${cardId}`, type: "PAID_WITH", is_primary: true },
      { id: "l3", source: `cust_${custId}`, target: `card_${cardId}`, type: "HOLDS_CARD" },
      { id: "l4", source: `txn_${txnId}`, target: `dev_${caseId}`, type: "USED_DEVICE" },
      { id: "l5", source: `txn_${txnId}`, target: `prior_CC-0141`, type: "CASE_SIMILAR_TO" },
    ];

    return { nodes, links };
  }

  const handleSimulate = (state: "deny" | "confirm") => {
    if (state === "deny") {
      setCaseData((prev: any) => ({
        ...prev,
        verdict: "fraud",
        confidence_score: 0.94,
        exposure_usd: prev?.exposure_usd || 128.33,
        case: { ...prev.case, verdict: "fraud", fraud_probability: 0.94 },
        next_best_actions: {
          ...prev.next_best_actions,
          final: [
            { action: "BLOCK_CARD", route: "L1", reason: "Customer denied activity. Card suspended." },
            { action: "CREATE_CASE", route: "auto", reason: "Incident dossier recorded to graph." },
          ],
          what_changed: "Customer denial increased assessed fraud probability to 0.94, routing to Level 1 card suspension.",
        },
      }));
    } else {
      setCaseData((prev: any) => ({
        ...prev,
        verdict: "legitimate",
        confidence_score: 0.04,
        case: { ...prev.case, verdict: "legitimate", fraud_probability: 0.04 },
        sar: { file: false, reason: "Cardholder confirmed transaction", narrative: "", subjects: [], total_amount_usd: 0, activity_dates: [] },
        next_best_actions: {
          ...prev.next_best_actions,
          final: [
            { action: "CLOSE_NO_FRAUD", route: "auto", reason: "Cardholder verified transaction validity." },
          ],
          what_changed: "Customer confirmation lowered fraud probability to 0.04; closed without friction.",
        },
      }));
    }
  };

  const handleRunInvestigation = () => {
    setIsInvestigating(true);
    fetch("/api/investigate/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: id, subject_customer_ids: [caseData?.customer_id] }),
    })
      .then(() => {
        setTimeout(() => {
          setIsInvestigating(false);
          setApprovalSuccess(`Investigation refreshed for ${id}.`);
          setTimeout(() => setApprovalSuccess(null), 3000);
        }, 800);
      })
      .catch(() => setIsInvestigating(false));
  };

  const handleExecuteAction = (actionName: string, route: string) => {
    if (route === "auto") {
      setApprovalSuccess(`Action '${actionName}' executed autonomously.`);
      setTimeout(() => setApprovalSuccess(null), 3000);
    } else {
      setApprovalModalAction(actionName);
    }
  };

  const handleApprove = () => {
    if (!approvalIdInput.trim()) return;
    const act = approvalModalAction;
    setApprovalModalAction(null);
    setApprovalIdInput("");
    setApprovalSuccess(`Action '${act}' approved (${approvalIdInput}).`);
    setTimeout(() => setApprovalSuccess(null), 4000);
  };

  if (loading || !caseData) {
    return (
      <div className="py-24 text-center text-zinc-500 font-mono text-xs flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
        <span>Loading case dossier...</span>
      </div>
    );
  }

  const { case: c, next_best_actions: nba, sar } = caseData;
  const verdict = caseData.verdict || c?.verdict || "pending";
  const bankScore = typeof caseData.risk_score === "number" ? caseData.risk_score : 0.61;
  const agentConfidence = typeof caseData.confidence_score === "number" ? caseData.confidence_score : c?.fraud_probability || 0.5;

  return (
    <div className="space-y-6">
      {/* ── Case Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#1f2026] gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/cases"
            className="p-1.5 rounded bg-[#14151a] hover:bg-[#1a1c23] border border-[#222329] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-zinc-100 font-mono">{id}</h1>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                  verdict === "fraud"
                    ? "bg-rose-950/40 text-rose-300 border-rose-900/60"
                    : verdict === "legitimate"
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/60"
                    : "bg-amber-950/40 text-amber-300 border-amber-900/60"
                }`}
              >
                {verdict}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                Txn {caseData.flagged_txn_id}
              </span>
            </div>
            <div className="text-xs text-zinc-400 font-mono mt-0.5">
              Customer {caseData.customer_id} · Card {caseData.card_id} · Exposure{" "}
              <span className="text-zinc-200 font-semibold">
                ${caseData.exposure_usd?.toFixed(2) || "0.00"}
              </span>
            </div>
          </div>
        </div>

        {/* Quiet Risk Counters & Controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto font-mono">
          <div className="text-right px-3 py-1 bg-[#121317] border border-[#222329] rounded text-xs">
            <span className="text-zinc-400 text-[10px] block">Model Score</span>
            <span className="text-zinc-200 font-semibold">
              {(bankScore * 100).toFixed(0)} / 100
            </span>
          </div>

          <div className="text-right px-3 py-1 bg-[#121317] border border-[#222329] rounded text-xs">
            <span className="text-zinc-400 text-[10px] block">Assessed Risk</span>
            <span className={agentConfidence > 0.7 ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
              {(agentConfidence * 100).toFixed(0)}%
            </span>
          </div>

          {sar?.file && (
            <button
              onClick={() => setShowSarModal(true)}
              className="px-2.5 py-1.5 bg-[#1a1215] hover:bg-[#25171d] text-rose-300 border border-rose-900/50 rounded text-xs transition-colors"
            >
              SAR Report
            </button>
          )}

          <button
            onClick={handleRunInvestigation}
            disabled={isInvestigating}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isInvestigating ? "animate-spin" : ""}`} />
            <span>{isInvestigating ? "Running..." : "Re-investigate"}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Message */}
      {approvalSuccess && (
        <div className="p-2.5 bg-[#111c15] border border-emerald-900/50 text-emerald-300 text-xs rounded font-mono flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{approvalSuccess}</span>
        </div>
      )}

      {/* ── Quiet Simulation Control ─────────────────────────────────── */}
      <div className="p-3 bg-[#111216] border border-[#1f2026] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="text-zinc-400">
          <span className="text-zinc-200 font-medium mr-2">Customer Verification State:</span>
          Simulate customer response to observe dynamic policy adaptation.
        </div>
        <div className="flex items-center gap-2 font-mono">
          <button
            onClick={() => handleSimulate("confirm")}
            className="px-2.5 py-1 rounded bg-[#131a16] hover:bg-[#1a251e] border border-emerald-900/40 text-emerald-300 text-[11px] transition-colors"
          >
            Confirm: "It was me"
          </button>
          <button
            onClick={() => handleSimulate("deny")}
            className="px-2.5 py-1 rounded bg-[#1e1316] hover:bg-[#2a171d] border border-rose-900/40 text-rose-300 text-[11px] transition-colors"
          >
            Deny: "I never made this"
          </button>
        </div>
      </div>

      {/* ── Workspace 2-Column Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Investigation Graph & Evidence */}
        <div className="lg:col-span-7 space-y-5">
          {/* Entity Topology Graph */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono px-1">
              <span>Entity Relationship Graph</span>
              <span>{subgraphData?.nodes?.length || 0} entities</span>
            </div>

            {subgraphData && (
              <InvestigationGraph
                nodes={subgraphData.nodes}
                links={subgraphData.links}
                highlightedNodeIds={highlightedNodes}
                onNodeSelect={(node) => setSelectedNode(node)}
                selectedNodeId={selectedNode?.id}
              />
            )}
          </div>

          {/* Evidence Observations */}
          <div className="bg-[#111216] border border-[#1f2026] rounded-lg p-4 space-y-3">
            <div className="text-xs font-medium text-zinc-300 font-mono">
              Graph Evidence &amp; Observations
            </div>

            <div className="space-y-2">
              {c?.evidence?.map((e: any, idx: number) => {
                const isSelected = selectedEvidenceIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedEvidenceIdx(null);
                        setHighlightedNodes([]);
                      } else {
                        setSelectedEvidenceIdx(idx);
                        setHighlightedNodes(e.entity_ids || []);
                      }
                    }}
                    className={`p-2.5 rounded border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#181920] border-zinc-500 text-zinc-100"
                        : "bg-[#0e0f13] border-[#1f2026] text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mb-1">
                      <span>{e.ref || "OBSERVED"}</span>
                      {e.entity_ids?.length > 0 && <span>{e.entity_ids.join(", ")}</span>}
                    </div>
                    <p className="text-xs text-zinc-300 font-sans leading-normal">{e.claim}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Next-Best-Actions & Precedents */}
        <div className="lg:col-span-5 space-y-5">
          {/* Next-Best-Actions (Two-State Comparison) */}
          <div className="bg-[#111216] border border-[#1f2026] rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2026] pb-2 text-xs font-mono text-zinc-400">
              <span className="font-semibold text-zinc-200">Recommended Next-Best-Actions</span>
              <span>Policy Engine</span>
            </div>

            {/* Initial */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-mono text-zinc-400">
                1. Initial Assessment
              </div>
              {nba?.initial?.map((a: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-[#0e0f13] border border-[#1f2026] flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono text-zinc-200 font-medium">{a.action}</div>
                    <div className="text-[11px] text-zinc-400 font-sans">{a.reason}</div>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {a.route}
                  </span>
                </div>
              ))}
            </div>

            {/* Post-Verification */}
            <div className="space-y-1.5 pt-2 border-t border-[#1f2026]">
              <div className="text-[10px] uppercase font-mono text-zinc-400">
                2. Post-Verification Action
              </div>
              {nba?.final?.map((a: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-[#14151b] border border-[#262730] flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono text-zinc-100 font-medium">{a.action}</div>
                    <div className="text-[11px] text-zinc-400 font-sans">{a.reason}</div>
                  </div>
                  <button
                    onClick={() => handleExecuteAction(a.action, a.route)}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-mono transition-colors shrink-0 ml-2"
                  >
                    {a.route === "auto" ? "Execute" : "Approve"}
                  </button>
                </div>
              ))}

              {nba?.what_changed && (
                <div className="text-[11px] text-zinc-400 pt-1 leading-relaxed">
                  <span className="text-zinc-300 font-medium">Rationale: </span>
                  {nba.what_changed}
                </div>
              )}
            </div>
          </div>

          {/* Historical Precedents */}
          <div className="bg-[#111216] border border-[#1f2026] rounded-lg p-4 space-y-3">
            <div className="text-xs font-semibold text-zinc-200 font-mono">
              Institutional Case Precedents
            </div>
            <div className="space-y-2">
              {c?.similar_prior_cases?.length ? (
                c.similar_prior_cases.map((pcId: string) => (
                  <div
                    key={pcId}
                    className="p-2 rounded bg-[#0e0f13] border border-[#1f2026] flex items-center justify-between text-xs font-mono"
                  >
                    <span className="text-zinc-200">{pcId}</span>
                    <span className="text-zinc-400 text-[10px]">sim=0.84</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-zinc-400 font-mono">No prior cases cited</div>
              )}
            </div>
          </div>

          {/* Analyst Summary */}
          <div className="bg-[#111216] border border-[#1f2026] rounded-lg p-4 space-y-2 text-xs">
            <div className="text-zinc-400 font-mono text-[10px] uppercase">Dossier Summary</div>
            <p className="text-zinc-300 leading-relaxed font-sans">{c?.summary}</p>
          </div>
        </div>
      </div>

      {/* ── Minimalist SAR Modal ─────────────────────────────────────── */}
      {showSarModal && sar?.file && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#121317] border border-[#26272e] rounded-lg max-w-xl w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#222329] pb-3">
              <span className="font-semibold text-sm text-zinc-100 font-mono">
                Suspicious Activity Report
              </span>
              <button
                onClick={() => setShowSarModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-base"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 font-sans">
              <div className="font-mono text-zinc-400 text-[11px]">
                Reason: <span className="text-zinc-200">{sar.reason}</span>
              </div>
              <div className="p-3 bg-[#0c0d11] rounded border border-[#1f2026] text-xs font-mono">
                Total Exposure: ${sar.total_amount_usd?.toFixed(2)}
              </div>
              <div className="p-3 bg-[#0c0d11] rounded border border-[#1f2026] text-xs leading-relaxed">
                {sar.narrative}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSarModal(false)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Minimalist Action Sign-off Modal ─────────────────────────── */}
      {approvalModalAction && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#121317] border border-[#26272e] rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="font-semibold text-sm text-zinc-100 font-mono">
              Action Approval Required: {approvalModalAction}
            </div>
            <p className="text-xs text-zinc-400">
              Enter an Approval Event ID to authorize this privileged policy action.
            </p>
            <div>
              <input
                type="text"
                placeholder="e.g. APP-EVT-9041"
                value={approvalIdInput}
                onChange={(e) => setApprovalIdInput(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0c0d11] border border-[#26272e] rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 text-xs font-mono">
              <button
                onClick={() => setApprovalModalAction(null)}
                className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-3 py-1.5 bg-zinc-200 text-zinc-950 font-semibold rounded hover:bg-white"
              >
                Sign &amp; Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
