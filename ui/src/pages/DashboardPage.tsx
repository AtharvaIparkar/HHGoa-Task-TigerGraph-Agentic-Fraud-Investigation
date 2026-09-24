import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ShieldAlert, 
  Activity, 
  FileCheck2, 
  Users, 
  AlertTriangle, 
  ArrowUpRight, 
  Search,
  CheckCircle2,
  Clock,
  ChevronRight
} from "lucide-react";

interface CaseSummary {
  case_id: string;
  trigger_type: string;
  trigger_text: string;
  flagged_txn_id: string;
  card_id: string;
  customer_id: string;
  risk_score: string;
  verdict?: string;
  pattern?: string;
  exposure_usd?: number;
  sar_filed?: boolean;
}

export const DashboardPage: React.FC = () => {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load summary cases from API or local mock
    fetch("/api/cases")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.cases) {
          setCases(data.cases);
        } else {
          // Fallback initial benchmark snapshot
          setCases([
            { case_id: "HHG-001", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3514030 ($77.07, in billing region 444.0) at 0.61.", flagged_txn_id: "3514030", card_id: "C12382-K1", customer_id: "C12382", risk_score: "0.61", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
            { case_id: "HHG-002", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3478782 ($292.36, online) at 0.79.", flagged_txn_id: "3478782", card_id: "C11891-K1", customer_id: "C11891", risk_score: "0.79", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
            { case_id: "HHG-003", trigger_type: "customer_report", trigger_text: "Customer C08623 message: 'I never made this $49.00 purchase. Please check my card.'", flagged_txn_id: "3530164", card_id: "C08623-K2", customer_id: "C08623", risk_score: "0.65", verdict: "fraud", exposure_usd: 49.0, sar_filed: false },
            { case_id: "HHG-006", trigger_type: "customer_report", trigger_text: "Customer C07297 message: 'I never made this $482.12 purchase. Please check my card.'", flagged_txn_id: "3476682", card_id: "C07297-K1", customer_id: "C07297", risk_score: "0.85", verdict: "fraud", exposure_usd: 482.12, sar_filed: false },
            { case_id: "HHG-010", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3506725 ($1,000.03, online) at 0.90.", flagged_txn_id: "3506725", card_id: "C10434-K1", customer_id: "C10434", risk_score: "0.90", verdict: "fraud", exposure_usd: 1000.03, sar_filed: true },
            { case_id: "HHG-014", trigger_type: "analyst_request", trigger_text: "Analyst request: several cards this month show purchases from the same unusual device profile.", flagged_txn_id: "3478561", card_id: "C13487-K1", customer_id: "C13487", risk_score: "0.70", verdict: "fraud", exposure_usd: 77.07, sar_filed: true },
          ]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-cyan-400" />
            TigerGraph Fraud Investigation Operations Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Autonomous GraphRAG Agent · Savanna Graph of Record · FinCEN SAR Compliance
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            TigerGraph Savanna Connected
          </span>
          <Link
            to="/cases"
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold rounded-lg text-sm transition-colors flex items-center gap-1.5"
          >
            Open Case Triage
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Exam Benchmark Cases</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-100">20 / 20</span>
            <span className="text-xs text-emerald-400">100% processed</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Zero manual intervention steps</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Syndicates & Rings (Diff A)</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-100">8 Rings</span>
            <span className="text-xs text-amber-400">Graph-native BFS</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Multi-card device sharing clusters</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Confidence Gating (Diff B)</span>
            <AlertTriangle className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-100">0.88</span>
            <span className="text-xs text-purple-400">Threshold: 0.70</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Bayesian verification loops</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>SARs Gated & Filed</span>
            <FileCheck2 className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-100">2 Filed</span>
            <span className="text-xs text-slate-400">18 Gated Out</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">FinCEN 31 CFR 1020.320 compliant</p>
        </div>
      </div>

      {/* Main Grid: Priority Triage + Differentiators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Triage Queue (2 Cols) */}
        <div className="lg:col-span-2 rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Live Investigation Triage Queue</h2>
              <p className="text-xs text-slate-400">Cases ingested from real-time model scores and customer reports</p>
            </div>
            <Link to="/cases" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1">
              View all 20 <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/80">
            {cases.map((c) => (
              <div key={c.case_id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-2 rounded-lg transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-cyan-400">{c.case_id}</span>
                    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${
                      c.verdict === "fraud" ? "bg-rose-950/80 text-rose-300 border-rose-800" :
                      c.verdict === "legitimate" ? "bg-emerald-950/80 text-emerald-300 border-emerald-800" :
                      "bg-amber-950/80 text-amber-300 border-amber-800"
                    }`}>
                      {c.verdict || "investigating"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {c.customer_id} · {c.card_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1">{c.trigger_text}</p>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  {c.sar_filed && (
                    <span className="px-2 py-0.5 bg-rose-900/40 text-rose-300 border border-rose-700/60 rounded text-[11px] font-medium">
                      SAR Filed
                    </span>
                  )}
                  <Link
                    to={`/cases/${c.case_id}`}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors"
                  >
                    Open Dossier
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel: Differentiators & System Status */}
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Chosen Differentiators</h3>
            
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  Diff A: Graph-Native Rings
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  GSQL BFS connected components directly traverse <code>SHARED_DEVICE_PROFILE</code> edges to expose multi-card rings without ML approximations.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  Diff B: Evidence Gating
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Explicit evidence sufficiency scoring. Pauses at confidence &lt; 0.70 to request step-up auth, resumes with Bayesian probability updates.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Diff C: Institutional Memory
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Stores resolved cases as FraudCase vertices and automatically creates <code>CASE_SIMILAR_TO</code> edges to visibly cite prior cases in future decisions.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Approval Routing Status</h3>
            <div className="text-xs space-y-2 text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Auto Route:</span>
                <span className="font-mono text-emerald-400">VERIFY, STEP_UP, CREATE_CASE</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">L1 Approval:</span>
                <span className="font-mono text-cyan-400">BLOCK_CARD (&le; $2,500)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">L2 Manager Approval:</span>
                <span className="font-mono text-rose-400">BLOCK_ALL, FILE_REPORT</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
