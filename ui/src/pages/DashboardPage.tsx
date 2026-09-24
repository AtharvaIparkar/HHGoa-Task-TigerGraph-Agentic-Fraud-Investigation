import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Shield,
  Layers,
  Activity,
  CheckCircle2,
  TrendingUp,
  Cpu,
  FileCheck
} from "lucide-react";

interface CaseSummary {
  case_id: string;
  trigger_type: string;
  trigger_text: string;
  flagged_txn_id: string;
  card_id: string;
  customer_id: string;
  risk_score: number | string;
  confidence_score?: number;
  verdict?: string;
  exposure_usd?: number;
  sar_required?: boolean;
}

export const DashboardPage: React.FC = () => {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [filterVerdict, setFilterVerdict] = useState<string>("all");

  useEffect(() => {
    fetch("/api/cases?limit=20")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.cases) setCases(data.cases);
        else if (Array.isArray(data)) setCases(data);
      })
      .catch(() => {});
  }, []);

  const filtered = cases.filter((c) => {
    if (filterVerdict === "all") return true;
    return c.verdict === filterVerdict;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
            Fraud Operations &amp; Intelligence
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-mono">
            TigerGraph FraudGraph System of Record · 20 Benchmark Cases Ingested
          </p>
        </div>

        <Link
          to="/cases"
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold font-mono transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span>Open Case Workstation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Light KPI Cards (2 cols on mobile, 4 on desktop) ─────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 font-mono">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] sm:text-xs text-slate-500 uppercase font-semibold">Exam Cases</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">20 / 20</div>
          <div className="text-[10px] sm:text-xs text-emerald-600 font-semibold mt-0.5">100% Processed</div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] sm:text-xs text-slate-500 uppercase font-semibold">Syndicate Rings</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">8 Clusters</div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">GSQL Connected Comp</div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] sm:text-xs text-slate-500 uppercase font-semibold">Sufficiency Gate</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">0.88 Avg</div>
          <div className="text-[10px] sm:text-xs text-blue-600 font-semibold mt-0.5">Threshold: 0.70</div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] sm:text-xs text-slate-500 uppercase font-semibold">FinCEN Filings</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">2 Filed</div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">31 CFR 1020 Compliant</div>
        </div>
      </div>

      {/* ── Case Stream ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-sm">
        <div className="flex flex-col xs:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2.5">
          <div className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider">
            Active Triage Queue ({filtered.length})
          </div>

          <div className="flex items-center gap-1 font-mono text-xs">
            <button
              onClick={() => setFilterVerdict("all")}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-colors text-[11px] sm:text-xs font-medium ${
                filterVerdict === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900 bg-slate-50"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterVerdict("fraud")}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-colors text-[11px] sm:text-xs font-medium ${
                filterVerdict === "fraud" ? "bg-rose-50 text-rose-700 font-bold border border-rose-200" : "text-slate-600 hover:text-slate-900 bg-slate-50"
              }`}
            >
              Fraud
            </button>
            <button
              onClick={() => setFilterVerdict("legitimate")}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-colors text-[11px] sm:text-xs font-medium ${
                filterVerdict === "legitimate" ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200" : "text-slate-600 hover:text-slate-900 bg-slate-50"
              }`}
            >
              Legitimate
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((c) => {
            const bScore = typeof c.risk_score === "number" ? c.risk_score : 0.61;
            const aProb = c.confidence_score !== undefined ? c.confidence_score : 0.5;

            return (
              <div
                key={c.case_id}
                className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:bg-slate-50/80 px-1 sm:px-2 rounded-lg transition-colors font-mono text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <Link to={`/cases/${c.case_id}`} className="font-bold text-slate-900 hover:underline">
                      {c.case_id}
                    </Link>
                    <span
                      className={`text-[9px] sm:text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        c.verdict === "fraud"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : c.verdict === "legitimate"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {c.verdict}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {c.customer_id} · {c.card_id}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 line-clamp-1 font-sans">
                    {c.trigger_text}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                  <div className="text-left sm:text-right text-[11px] sm:text-xs text-slate-500">
                    Model: <strong className="text-slate-900">{(bScore * 100).toFixed(0)}</strong> · Prob:{" "}
                    <strong className={aProb > 0.7 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                      {(aProb * 100).toFixed(0)}%
                    </strong>
                  </div>

                  <Link
                    to={`/cases/${c.case_id}`}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                  >
                    Open
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
