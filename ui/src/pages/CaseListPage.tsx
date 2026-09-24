import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  Search,
  Filter,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Play,
  Layers,
  Activity,
  ArrowRight
} from "lucide-react";

interface CaseRecord {
  case_id: string;
  opened_at?: string;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cases?limit=50")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.cases) {
          setCases(data.cases);
        } else if (Array.isArray(data)) {
          setCases(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredCases = cases.filter((c) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      c.case_id.toLowerCase().includes(s) ||
      (c.customer_id && c.customer_id.toLowerCase().includes(s)) ||
      (c.card_id && c.card_id.toLowerCase().includes(s)) ||
      (c.flagged_txn_id && c.flagged_txn_id.includes(s)) ||
      (c.trigger_text && c.trigger_text.toLowerCase().includes(s));

    const matchesType = filterType === "all" || c.trigger_type === filterType;
    const matchesVerdict = filterVerdict === "all" || c.verdict === filterVerdict;

    return matchesSearch && matchesType && matchesVerdict;
  });

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-400 font-mono text-[10px] uppercase font-bold">
              Benchmark Suite
            </span>
            <span className="text-xs text-slate-400 font-mono">20 Exam Cases (Isolated)</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight mt-1 flex items-center gap-2 font-mono">
            <Layers className="w-5 h-5 text-cyan-400" />
            Exam Case Triage Workstation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            System of Record: TigerGraph savannadb · Closed institutional cases isolated to graph memory
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
            Total: <strong className="text-slate-100">{cases.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
            Filtered: <strong className="text-cyan-400">{filteredCases.length}</strong>
          </span>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Case ID, Customer, Card, or Flagged Txn ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Trigger filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="all">All Triggers</option>
            <option value="risk_score">Risk Score Trigger</option>
            <option value="customer_report">Customer Report</option>
            <option value="analyst_request">Analyst Request</option>
          </select>

          {/* Verdict filter */}
          <select
            value={filterVerdict}
            onChange={(e) => setFilterVerdict(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="all">All Verdicts</option>
            <option value="fraud">Fraud</option>
            <option value="legitimate">Legitimate</option>
            <option value="suspicious">Suspicious</option>
          </select>
        </div>
      </div>

      {/* ── Dense Analytical Case Table ────────────────────────────────── */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950/80 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Case ID</th>
                <th className="px-4 py-3">Trigger Type</th>
                <th className="px-4 py-3">Customer / Card</th>
                <th className="px-4 py-3">Flagged Txn</th>
                <th className="px-4 py-3">Bank Score</th>
                <th className="px-4 py-3">Agent Prob</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Exposure</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredCases.map((c) => {
                const bScore =
                  typeof c.risk_score === "number"
                    ? c.risk_score
                    : parseFloat(String(c.risk_score) || "0.5");
                const aProb = c.confidence_score !== undefined ? c.confidence_score : 0.5;

                return (
                  <tr key={c.case_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-cyan-400">
                      <Link to={`/cases/${c.case_id}`} className="hover:underline flex items-center gap-1">
                        {c.case_id}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {c.trigger_type}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[11px]">
                      <div className="font-semibold text-slate-200">{c.customer_id}</div>
                      <div className="text-slate-400 text-[10px]">{c.card_id}</div>
                    </td>

                    <td className="px-4 py-3 text-slate-300">{c.flagged_txn_id}</td>

                    <td className="px-4 py-3">
                      <span className="text-slate-200 font-bold">{(bScore * 100).toFixed(0)}</span>
                      <span className="text-slate-400 text-[10px]"> / 100</span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`font-bold ${
                          aProb >= 0.75
                            ? "text-rose-400"
                            : aProb <= 0.20
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {(aProb * 100).toFixed(0)}%
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${
                          c.verdict === "fraud"
                            ? "bg-rose-950/80 text-rose-300 border-rose-800"
                            : c.verdict === "legitimate"
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                            : "bg-amber-950/80 text-amber-300 border-amber-800"
                        }`}
                      >
                        {c.verdict || "pending"}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-200">
                      {c.exposure_usd !== undefined && c.exposure_usd > 0 ? (
                        <span className="text-cyan-300">${c.exposure_usd.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-400">$0.00</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/cases/${c.case_id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-bold transition-colors"
                      >
                        <span>Dossier</span>
                        <ArrowUpRight className="w-3 h-3 text-cyan-400" />
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
