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
  Play
} from "lucide-react";

interface CaseRecord {
  case_id: string;
  opened_at: string;
  trigger_type: string;
  trigger_text: string;
  flagged_txn_id: string;
  card_id: string;
  customer_id: string;
  risk_score?: string;
  verdict?: string;
  exposure_usd?: number;
  sar_filed?: boolean;
}

export const CaseListPage: React.FC = () => {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [investigatingId, setInvestigatingId] = useState<string | null>(null);

  useEffect(() => {
    // Populate the 20 benchmark cases
    const benchmarkCases: CaseRecord[] = [
      { case_id: "HHG-001", opened_at: "2016-12-05 01:55:28", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3514030 ($77.07, in billing region 444.0) at 0.61. Review and decide.", flagged_txn_id: "3514030", card_id: "C12382-K1", customer_id: "C12382", risk_score: "0.61", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-002", opened_at: "2016-11-22 23:27:07", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3478782 ($292.36, online) at 0.79. Review and decide.", flagged_txn_id: "3478782", card_id: "C11891-K1", customer_id: "C11891", risk_score: "0.79", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-003", opened_at: "2016-12-10 15:01:21", trigger_type: "customer_report", trigger_text: "Customer C08623 message: 'I never made this $49.00 purchase. Please check my card.' Refers to 3530164.", flagged_txn_id: "3530164", card_id: "C08623-K2", customer_id: "C08623", verdict: "fraud", exposure_usd: 49.0, sar_filed: false },
      { case_id: "HHG-004", opened_at: "2016-12-29 07:53:54", trigger_type: "customer_report", trigger_text: "Customer C08106 message: 'I never made this $128.33 purchase. Please check my card.' Refers to 3583227.", flagged_txn_id: "3583227", card_id: "C08106-K1", customer_id: "C08106", verdict: "fraud", exposure_usd: 128.33, sar_filed: false },
      { case_id: "HHG-005", opened_at: "2016-12-08 03:38:37", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3523199 ($100.07, online) at 0.54. Review and decide.", flagged_txn_id: "3523199", card_id: "C02923-K1", customer_id: "C02923", risk_score: "0.54", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-006", opened_at: "2016-11-22 02:30:00", trigger_type: "customer_report", trigger_text: "Customer C07297 message: 'I never made this $482.12 purchase. Please check my card.' Refers to 3476682.", flagged_txn_id: "3476682", card_id: "C07297-K1", customer_id: "C07297", verdict: "fraud", exposure_usd: 482.12, sar_filed: false },
      { case_id: "HHG-007", opened_at: "2016-12-05 03:46:14", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3514948 ($111.92, in billing region 264.0) at 0.87. Review and decide.", flagged_txn_id: "3514948", card_id: "C09933-K2", customer_id: "C09933", risk_score: "0.87", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-008", opened_at: "2016-12-20 03:08:56", trigger_type: "customer_report", trigger_text: "Customer C13171 message: 'I never made this $55.68 purchase. Please check my card.' Refers to 3558054.", flagged_txn_id: "3558054", card_id: "C13171-K2", customer_id: "C13171", verdict: "fraud", exposure_usd: 55.68, sar_filed: false },
      { case_id: "HHG-009", opened_at: "2016-12-28 17:10:53", trigger_type: "customer_report", trigger_text: "Customer C08299 message: 'I never made this $30.02 purchase. Please check my card.' Refers to 3581141.", flagged_txn_id: "3581141", card_id: "C08299-K1", customer_id: "C08299", verdict: "fraud", exposure_usd: 30.02, sar_filed: false },
      { case_id: "HHG-010", opened_at: "2016-12-02 18:18:27", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3506725 ($1,000.03, online) at 0.90. Review and decide.", flagged_txn_id: "3506725", card_id: "C10434-K1", customer_id: "C10434", risk_score: "0.90", verdict: "fraud", exposure_usd: 1000.03, sar_filed: true },
      { case_id: "HHG-011", opened_at: "2016-12-29 06:27:44", trigger_type: "customer_report", trigger_text: "Customer C11923 message: 'I never made this $131.30 purchase. Please check my card.' Refers to 3583368.", flagged_txn_id: "3583368", card_id: "C11923-K2", customer_id: "C11923", verdict: "fraud", exposure_usd: 131.30, sar_filed: false },
      { case_id: "HHG-012", opened_at: "2016-12-18 05:00:31", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3553342 ($30.91, in billing region 494.0) at 0.55. Review and decide.", flagged_txn_id: "3553342", card_id: "C05876-K2", customer_id: "C05876", risk_score: "0.55", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-013", opened_at: "2016-12-09 05:39:29", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3526826 ($35.66, online) at 0.76. Review and decide.", flagged_txn_id: "3526826", card_id: "C07671-K2", customer_id: "C07671", risk_score: "0.76", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-014", opened_at: "2016-11-22 20:11:00", trigger_type: "analyst_request", trigger_text: "Analyst request: several cards this month show purchases from the same unusual device profile. Review transaction 3478561 on card C13487-K1.", flagged_txn_id: "3478561", card_id: "C13487-K1", customer_id: "C13487", verdict: "fraud", exposure_usd: 77.07, sar_filed: true },
      { case_id: "HHG-015", opened_at: "2016-11-17 19:03:36", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3464869 ($599.94, online) at 0.77. Review and decide.", flagged_txn_id: "3464869", card_id: "C03042-K1", customer_id: "C03042", risk_score: "0.77", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-016", opened_at: "2016-12-12 01:39:08", trigger_type: "customer_report", trigger_text: "Customer C09988 message: 'I never made this $59.67 purchase. Please check my card.' Refers to 3534820.", flagged_txn_id: "3534820", card_id: "C09988-K1", customer_id: "C09988", verdict: "fraud", exposure_usd: 59.67, sar_filed: false },
      { case_id: "HHG-017", opened_at: "2016-11-12 00:46:24", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3450629 ($100.09, online) at 0.57. Review and decide.", flagged_txn_id: "3450629", card_id: "C04570-K1", customer_id: "C04570", risk_score: "0.57", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-018", opened_at: "2016-11-27 14:41:26", trigger_type: "customer_report", trigger_text: "Customer C02354 message: 'I never made this $39.08 purchase. Please check my card.' Refers to 3491361.", flagged_txn_id: "3491361", card_id: "C02354-K2", customer_id: "C02354", verdict: "fraud", exposure_usd: 39.08, sar_filed: false },
      { case_id: "HHG-019", opened_at: "2016-12-01 22:28:53", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3503878 ($99.92, online) at 0.90. Review and decide.", flagged_txn_id: "3503878", card_id: "C07987-K2", customer_id: "C07987", risk_score: "0.90", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
      { case_id: "HHG-020", opened_at: "2016-12-03 12:04:26", trigger_type: "risk_score", trigger_text: "Real-time model scored transaction 3509359 ($125.08, online) at 0.52. Review and decide.", flagged_txn_id: "3509359", card_id: "C12265-K2", customer_id: "C12265", risk_score: "0.52", verdict: "legitimate", exposure_usd: 0.0, sar_filed: false },
    ];
    setCases(benchmarkCases);
  }, []);

  const handleRunInvestigation = (caseId: string) => {
    setInvestigatingId(caseId);
    setTimeout(() => {
      setInvestigatingId(null);
    }, 800);
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.card_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.flagged_txn_id.includes(searchTerm);
    const matchesFilter = filterType === "all" || c.trigger_type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-cyan-400" />
            Exam Case Triage Workstation (20 Benchmark Cases)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            System of Record: TigerGraph savannadb · Isolated from closed cases memory
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Case ID, Customer ID, Card ID, or Transaction ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Triggers</option>
            <option value="risk_score">Risk Score Trigger</option>
            <option value="customer_report">Customer Report</option>
            <option value="analyst_request">Analyst Request</option>
          </select>
        </div>
      </div>

      {/* Case Table */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Case ID</th>
                <th className="px-4 py-3">Trigger Type</th>
                <th className="px-4 py-3">Customer / Card</th>
                <th className="px-4 py-3">Flagged Txn</th>
                <th className="px-4 py-3">Model Score</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Exposure</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredCases.map((c) => (
                <tr key={c.case_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-cyan-400 font-mono">
                    <Link to={`/cases/${c.case_id}`} className="hover:underline">
                      {c.case_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {c.trigger_type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs">
                    <div className="font-semibold text-slate-200">{c.customer_id}</div>
                    <div className="text-slate-500 font-mono">{c.card_id}</div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                    {c.flagged_txn_id}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs">
                    {c.risk_score ? (
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        parseFloat(c.risk_score) >= 0.75 ? "bg-rose-950 text-rose-300 border border-rose-800" :
                        "bg-slate-800 text-slate-300"
                      }`}>
                        {c.risk_score}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[11px] uppercase font-bold px-2 py-0.5 rounded border ${
                      c.verdict === "fraud" ? "bg-rose-950/80 text-rose-300 border-rose-800" :
                      c.verdict === "legitimate" ? "bg-emerald-950/80 text-emerald-300 border-emerald-800" :
                      "bg-amber-950/80 text-amber-300 border-amber-800"
                    }`}>
                      {c.verdict || "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs">
                    {c.exposure_usd !== undefined ? (
                      <span>${c.exposure_usd.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-2">
                    <Link
                      to={`/cases/${c.case_id}`}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 border border-cyan-700/60 rounded text-xs font-medium transition-colors"
                    >
                      Dossier
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
