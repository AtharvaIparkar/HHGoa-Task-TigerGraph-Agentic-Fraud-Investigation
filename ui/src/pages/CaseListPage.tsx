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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Case Workstation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            20 Exam Benchmark Cases · Ingested &amp; Evaluated
          </p>
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong className="text-slate-900">{filtered.length}</strong> of {cases.length} cases
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by case ID, customer, card, or transaction..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm transition-colors"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg text-xs text-slate-700 px-3 py-2 focus:outline-none focus:border-blue-500 shadow-sm"
        >
          <option value="all">All Trigger Sources</option>
          <option value="risk_score">Risk Score Trigger</option>
          <option value="customer_report">Customer Report</option>
          <option value="analyst_request">Analyst Request</option>
        </select>

        <select
          value={filterVerdict}
          onChange={(e) => setFilterVerdict(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg text-xs text-slate-700 px-3 py-2 focus:outline-none focus:border-blue-500 shadow-sm"
        >
          <option value="all">All Decisions</option>
          <option value="fraud">Fraud</option>
          <option value="legitimate">Legitimate</option>
        </select>
      </div>

      {/* ── Crisp Light Table ──────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 font-mono">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Case ID</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Customer / Card</th>
                <th className="px-4 py-3">Txn ID</th>
                <th className="px-4 py-3">Model Score</th>
                <th className="px-4 py-3">Assessed Prob</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Exposure</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const bScore = typeof c.risk_score === "number" ? c.risk_score : 0.61;
                const aProb = c.confidence_score !== undefined ? c.confidence_score : 0.5;

                return (
                  <tr key={c.case_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-blue-600">
                      <Link to={`/cases/${c.case_id}`} className="hover:underline">
                        {c.case_id}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {c.trigger_type}
                    </td>

                    <td className="px-4 py-3 text-[11px]">
                      <span className="font-semibold text-slate-900">{c.customer_id}</span>
                      <span className="text-slate-400 ml-1.5">{c.card_id}</span>
                    </td>

                    <td className="px-4 py-3 text-slate-600 text-[11px]">
                      {c.flagged_txn_id}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {(bScore * 100).toFixed(0)} <span className="text-[10px] text-slate-400">/ 100</span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`font-semibold ${aProb > 0.7 ? "text-rose-600" : "text-emerald-600"}`}>
                        {(aProb * 100).toFixed(0)}%
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                          c.verdict === "fraud"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : c.verdict === "legitimate"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {c.verdict}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-900 font-semibold">
                      ${c.exposure_usd?.toFixed(2) || "0.00"}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/cases/${c.case_id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
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
