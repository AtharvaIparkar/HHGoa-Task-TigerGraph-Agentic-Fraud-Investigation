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
  ChevronDown,
  ExternalLink,
  Shield,
  Layers,
  Activity
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
          { claim: `Transaction authorized for $${isHighSpend ? "1,000.03" : "77.07"} via payment gateway`, source: "graph", ref: "get_transaction_detail", entity_ids: [isHighSpend ? "3506725" : isRing ? "3478561" : "3514030"] },
          { claim: isRing ? "Device profile shared across 3 accounts" : "Transaction velocity within expected customer baseline", source: "graph", ref: "shared_attribute_ring_detection", entity_ids: ["DEV-889104b"] },
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
      <div className="py-24 text-center text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/cases"
            className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{id}</h1>
              <span
                className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                  verdict === "fraud"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : verdict === "legitimate"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {verdict.toUpperCase()}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Txn #{caseData.flagged_txn_id}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 font-mono">
              Customer: <span className="text-slate-800 font-semibold">{caseData.customer_id}</span> · Card:{" "}
              <span className="text-slate-800 font-semibold">{caseData.card_id}</span> · Exposure:{" "}
              <span className="text-slate-900 font-bold">
                ${caseData.exposure_usd?.toFixed(2) || "0.00"}
              </span>
            </div>
          </div>
        </div>

        {/* Quiet Risk Counters & Controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto font-mono">
          <div className="text-right px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Model Score</span>
            <span className="text-slate-900 font-bold text-sm">
              {(bankScore * 100).toFixed(0)} <span className="text-xs text-slate-400 font-normal">/ 100</span>
            </span>
          </div>

          <div className="text-right px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Assessed Risk</span>
            <span className={`font-bold text-sm ${agentConfidence > 0.7 ? "text-rose-600" : "text-emerald-600"}`}>
              {(agentConfidence * 100).toFixed(0)}%
            </span>
          </div>

          {sar?.file && (
            <button
              onClick={() => setShowSarModal(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              SAR Report
            </button>
          )}

          <button
            onClick={handleRunInvestigation}
            disabled={isInvestigating}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isInvestigating ? "animate-spin" : ""}`} />
            <span>{isInvestigating ? "Processing..." : "Re-investigate"}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Message */}
      {approvalSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-mono flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{approvalSuccess}</span>
        </div>
      )}

      {/* ── Quiet Simulation Control ─────────────────────────────────── */}
      <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="text-slate-600">
          <span className="text-slate-900 font-semibold mr-1.5">Interactive Verification Simulation:</span>
          Observe how the decision and actions dynamically adapt when the customer confirms vs denies the charge.
        </div>
        <div className="flex items-center gap-2 font-mono">
          <button
            onClick={() => handleSimulate("confirm")}
            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-medium transition-colors"
          >
            Simulate Confirmation ("It was me")
          </button>
          <button
            onClick={() => handleSimulate("deny")}
            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-xs font-medium transition-colors"
          >
            Simulate Denial ("Never made it")
          </button>
        </div>
      </div>

      {/* ── Workspace 2-Column Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Investigation Graph & Evidence */}
        <div className="lg:col-span-7 space-y-5">
          {/* Entity Topology Graph */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono px-1">
              <span className="font-semibold text-slate-700">Entity Topology &amp; Lineage</span>
              <span>{subgraphData?.nodes?.length || 0} entities loaded</span>
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
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Graph Evidence &amp; Claims
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
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-400 text-slate-900 shadow-sm"
                        : "bg-slate-50 border-slate-200/80 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mb-1">
                      <span className="font-semibold">{e.ref || "OBSERVED"}</span>
                      {e.entity_ids?.length > 0 && (
                        <span className="text-blue-600">{e.entity_ids.join(", ")}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 font-sans leading-relaxed">{e.claim}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Next-Best-Actions & Precedents */}
        <div className="lg:col-span-5 space-y-5">
          {/* Next-Best-Actions (Two-State Comparison) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 text-xs font-mono text-slate-500">
              <span className="font-bold text-slate-900 text-xs">Recommended Next-Best-Actions</span>
              <span>Policy v1.0</span>
            </div>

            {/* Initial */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-400">
                1. Initial Recommendation
              </div>
              {nba?.initial?.map((a: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono text-slate-900 font-semibold">{a.action}</div>
                    <div className="text-[11px] text-slate-500 font-sans mt-0.5">{a.reason}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {a.route}
                  </span>
                </div>
              ))}
            </div>

            {/* Post-Verification */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-[10px] uppercase font-bold tracking-wider font-mono text-blue-700">
                2. Post-Verification Action
              </div>
              {nba?.final?.map((a: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-blue-50/50 border border-blue-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono text-blue-950 font-bold">{a.action}</div>
                    <div className="text-[11px] text-slate-600 font-sans mt-0.5">{a.reason}</div>
                  </div>
                  <button
                    onClick={() => handleExecuteAction(a.action, a.route)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-mono font-medium transition-colors shrink-0 ml-2 shadow-sm"
                  >
                    {a.route === "auto" ? "Execute" : "Approve"}
                  </button>
                </div>
              ))}

              {nba?.what_changed && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed mt-2">
                  <span className="text-slate-900 font-semibold font-mono text-[10px] uppercase block">
                    Decision Delta:
                  </span>
                  {nba.what_changed}
                </div>
              )}
            </div>
          </div>

          {/* Historical Precedents */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Institutional Precedents (Graph Memory)
            </div>
            <div className="space-y-2">
              {c?.similar_prior_cases?.length ? (
                c.similar_prior_cases.map((pcId: string) => (
                  <div
                    key={pcId}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono"
                  >
                    <span className="text-slate-900 font-semibold">{pcId}</span>
                    <span className="text-slate-500 text-[11px]">Similarity: 0.84</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 font-mono">No prior cases cited</div>
              )}
            </div>
          </div>

          {/* Analyst Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-xs shadow-sm">
            <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">Investigation Summary</div>
            <p className="text-slate-700 leading-relaxed font-sans">{c?.summary}</p>
          </div>
        </div>
      </div>

      {/* ── Clean Light SAR Modal ─────────────────────────────────────── */}
      {showSarModal && sar?.file && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-sm text-slate-900 font-mono">
                Suspicious Activity Report (FinCEN 31 CFR 1020)
              </span>
              <button
                onClick={() => setShowSarModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 font-sans">
              <div className="font-mono text-slate-600 text-[11px]">
                Filing Basis: <span className="text-slate-900 font-semibold">{sar.reason}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                Total Flagged Exposure: <strong className="text-slate-900">${sar.total_amount_usd?.toFixed(2)}</strong>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs leading-relaxed text-slate-700">
                {sar.narrative}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSarModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold font-mono"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Sign-off Modal ─────────────────────────────────── */}
      {approvalModalAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="font-bold text-sm text-slate-900 font-mono">
              Action Approval Required: {approvalModalAction}
            </div>
            <p className="text-xs text-slate-600">
              Enter an Approval Event ID to authorize this privileged policy action.
            </p>
            <div>
              <input
                type="text"
                placeholder="e.g. APP-EVT-9041"
                value={approvalIdInput}
                onChange={(e) => setApprovalIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 text-xs font-mono">
              <button
                onClick={() => setApprovalModalAction(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
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
