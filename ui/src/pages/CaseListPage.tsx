import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowUpRight } from "lucide-react";

interface CaseRecord {
  case_id: string;
  trigger_type: string;
  trigger_text: string;
  flagged_txn_id: string;
  card_id: string;
  customer_id: string;
  risk_score?: number | string;
  confidence_score?: number;
  verdict?: string;
  exposure_usd?: number;
  sar_required?: boolean;
}

export const CaseListPage: React.FC = () => {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterVerdict, setFilterVerdict] = useState<string>("all");

  useEffect(() => {
    fetch("/api/cases?limit=50")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.cases) setCases(data.cases);
        else if (Array.isArray(data)) setCases(data);
      })
      .catch(() => {});
  }, []);

  const filtered = cases.filter((c) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      c.case_id.toLowerCase().includes(s) ||
      (c.customer_id && c.customer_id.toLowerCase().includes(s)) ||
      (c.card_id && c.card_id.toLowerCase().includes(s)) ||
      (c.flagged_txn_id && c.flagged_txn_id.includes(s)) ||
      (c.trigger_text && c.trigger_text.toLowerCase().includes(s));

    const matchType = filterType === "all" || c.trigger_type === filterType;
    const matchVerdict = filterVerdict === "all" || c.verdict === filterVerdict;

    return matchSearch && matchType && matchVerdict;
  });

  return (
    <div className="space-y-5 font-mono">
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1f2026] gap-3">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">
            Case Workstation
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            20 Exam Benchmark Cases · Ingested &amp; Evaluated
          </p>
        </div>

        <div className="text-xs text-zinc-500">
          Showing {filtered.length} of {cases.length} cases
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter by case, customer, or transaction ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#111216] border border-[#222329] rounded text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-[#111216] border border-[#222329] rounded text-xs text-zinc-300 px-2.5 py-1.5 focus:outline-none focus:border-zinc-500"
        >
          <option value="all">All Trigger Sources</option>
          <option value="risk_score">Risk Score</option>
          <option value="customer_report">Customer Report</option>
          <option value="analyst_request">Analyst Request</option>
        </select>

        <select
          value={filterVerdict}
          onChange={(e) => setFilterVerdict(e.target.value)}
          className="bg-[#111216] border border-[#222329] rounded text-xs text-zinc-300 px-2.5 py-1.5 focus:outline-none focus:border-zinc-500"
        >
          <option value="all">All Decisions</option>
          <option value="fraud">Fraud</option>
          <option value="legitimate">Legitimate</option>
        </select>
      </div>

      {/* ── Clean Table ──────────────────────────────────────────────── */}
      <div className="rounded-lg bg-[#111216] border border-[#1f2026] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#0e0f13] text-zinc-500 text-[10px] uppercase border-b border-[#1f2026]">
              <tr>
                <th className="px-3.5 py-2.5">Case ID</th>
                <th className="px-3.5 py-2.5">Trigger</th>
                <th className="px-3.5 py-2.5">Customer / Card</th>
                <th className="px-3.5 py-2.5">Txn ID</th>
                <th className="px-3.5 py-2.5">Model Score</th>
                <th className="px-3.5 py-2.5">Assessed Risk</th>
                <th className="px-3.5 py-2.5">Verdict</th>
                <th className="px-3.5 py-2.5">Exposure</th>
                <th className="px-3.5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181920]">
              {filtered.map((c) => {
                const bScore = typeof c.risk_score === "number" ? c.risk_score : 0.61;
                const aProb = c.confidence_score !== undefined ? c.confidence_score : 0.5;

                return (
                  <tr key={c.case_id} className="hover:bg-[#14151b] transition-colors">
                    <td className="px-3.5 py-2.5 font-semibold text-zinc-100">
                      <Link to={`/cases/${c.case_id}`} className="hover:underline">
                        {c.case_id}
                      </Link>
                    </td>

                    <td className="px-3.5 py-2.5 text-zinc-400 text-[11px]">
                      {c.trigger_type}
                    </td>

                    <td className="px-3.5 py-2.5 text-[11px]">
                      <span className="text-zinc-200">{c.customer_id}</span>
                      <span className="text-zinc-500 ml-1.5">{c.card_id}</span>
                    </td>

                    <td className="px-3.5 py-2.5 text-zinc-300 text-[11px]">
                      {c.flagged_txn_id}
                    </td>

                    <td className="px-3.5 py-2.5 text-zinc-300">
                      {(bScore * 100).toFixed(0)}
                    </td>

                    <td className="px-3.5 py-2.5">
                      <span className={aProb > 0.7 ? "text-rose-400" : "text-emerald-400"}>
                        {(aProb * 100).toFixed(0)}%
                      </span>
                    </td>

                    <td className="px-3.5 py-2.5">
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
                    </td>

                    <td className="px-3.5 py-2.5 text-zinc-300">
                      ${c.exposure_usd?.toFixed(2) || "0.00"}
                    </td>

                    <td className="px-3.5 py-2.5 text-right">
                      <Link
                        to={`/cases/${c.case_id}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#181920] hover:bg-[#202129] border border-[#262730] text-zinc-300 text-[11px] transition-colors"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="w-3 h-3 text-zinc-400" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
