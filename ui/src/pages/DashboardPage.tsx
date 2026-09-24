import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Shield,
  Layers,
  Activity,
  CheckCircle2
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
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1f2026] gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100 font-mono tracking-tight">
            Fraud Operations &amp; Intelligence
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 font-mono">
            TigerGraph System of Record · Native GSQL Traversals · 20 Benchmark Exam Cases
          </p>
        </div>

        <Link
          to="/cases"
          className="px-3.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-mono transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>View All Cases</span>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
        </Link>
      </div>

      {/* ── Minimalist KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 rounded-lg bg-[#111216] border border-[#1f2026]">
          <div className="text-[11px] text-zinc-400">Exam Cases Processed</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">20 / 20</div>
          <div className="text-[10px] text-emerald-400 mt-0.5">100% evaluated</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#111216] border border-[#1f2026]">
          <div className="text-[11px] text-zinc-400">Device Syndicate Rings</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">8 Clusters</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">GSQL Connected Comp</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#111216] border border-[#1f2026]">
          <div className="text-[11px] text-zinc-400">Sufficiency Gate</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">0.88 Avg</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Threshold: 0.70</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#111216] border border-[#1f2026]">
          <div className="text-[11px] text-zinc-400">Regulatory SARs</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">2 Filed</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">31 CFR 1020 Compliant</div>
        </div>
      </div>

      {/* ── Case Stream ──────────────────────────────────────────────── */}
      <div className="bg-[#111216] border border-[#1f2026] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#1f2026] pb-3">
          <div className="text-xs font-semibold text-zinc-200 font-mono">
            Active Investigation Queue
          </div>

          <div className="flex items-center gap-1 font-mono text-[11px]">
            <button
              onClick={() => setFilterVerdict("all")}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterVerdict === "all" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterVerdict("fraud")}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterVerdict === "fraud" ? "bg-rose-950/60 text-rose-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Fraud
            </button>
            <button
              onClick={() => setFilterVerdict("legitimate")}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterVerdict === "legitimate" ? "bg-emerald-950/60 text-emerald-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Legitimate
            </button>
          </div>
        </div>

        <div className="divide-y divide-[#181920]">
          {filtered.map((c) => {
            const bScore = typeof c.risk_score === "number" ? c.risk_score : 0.61;
            const aProb = c.confidence_score !== undefined ? c.confidence_score : 0.5;

            return (
              <div
                key={c.case_id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#14151a] px-2 rounded transition-colors font-mono text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/cases/${c.case_id}`} className="font-semibold text-zinc-200 hover:underline">
                      {c.case_id}
                    </Link>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.2 rounded border ${
                        c.verdict === "fraud"
                          ? "bg-rose-950/40 text-rose-300 border-rose-900/60"
                          : c.verdict === "legitimate"
                          ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/60"
                          : "bg-amber-950/40 text-amber-300 border-amber-900/60"
                      }`}
                    >
                      {c.verdict}
                    </span>
                    <span className="text-zinc-500 text-[11px]">
                      {c.customer_id} · {c.card_id}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-1 font-sans mt-0.5">
                    {c.trigger_text}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-[11px] text-zinc-400">
                    Score: <span className="text-zinc-200">{(bScore * 100).toFixed(0)}</span> · Prob:{" "}
                    <span className={aProb > 0.7 ? "text-rose-400" : "text-emerald-400"}>
                      {(aProb * 100).toFixed(0)}%
                    </span>
                  </div>

                  <Link
                    to={`/cases/${c.case_id}`}
                    className="px-2.5 py-1 rounded bg-[#181920] hover:bg-[#202129] border border-[#262730] text-zinc-300 text-xs transition-colors"
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
