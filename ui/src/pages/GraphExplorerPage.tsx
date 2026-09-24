import React, { useState } from "react";
import {
  Users,
  Network,
  ArrowRight,
  Shield,
  Layers,
  Info
} from "lucide-react";
import { Link } from "react-router-dom";

interface FraudRingItem {
  component_id: string;
  size: number;
  members: string[];
  cards: string[];
  shared_device: string;
  confirmed_fraud_count: number;
  total_exposure_usd: number;
  pattern: string;
  anchor_case: string;
}

export const GraphExplorerPage: React.FC = () => {
  const [selectedRing, setSelectedRing] = useState<string>("RING-001");

  const rings: FraudRingItem[] = [
    {
      component_id: "RING-001",
      size: 4,
      members: ["C13487", "C08771", "C02194", "C09112"],
      cards: ["C13487-K1", "C08771-K1", "C02194-K2"],
      shared_device: "SAMSUNG SM-G892A Build/NRD90M (DEV-889104b)",
      confirmed_fraud_count: 3,
      total_exposure_usd: 3491.2,
      pattern: "card_not_present_new_device",
      anchor_case: "HHG-014",
    },
    {
      component_id: "RING-002",
      size: 3,
      members: ["C12382", "C07297", "C08299"],
      cards: ["C12382-K1", "C07297-K1"],
      shared_device: "Billing Region 444.0 Cluster (REG-444)",
      confirmed_fraud_count: 2,
      total_exposure_usd: 1840.5,
      pattern: "out_of_region_use",
      anchor_case: "HHG-001",
    },
    {
      component_id: "RING-003",
      size: 2,
      members: ["C10434", "C08106"],
      cards: ["C10434-K1", "C08106-K1"],
      shared_device: "Proxy Cluster (192.241.218.0/24)",
      confirmed_fraud_count: 2,
      total_exposure_usd: 1128.36,
      pattern: "card_testing",
      anchor_case: "HHG-010",
    },
  ];

  const currentRing = rings.find((r) => r.component_id === selectedRing) || rings[0];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 font-mono">
            <Network className="w-5 h-5 text-blue-600" />
            Entity Topology &amp; Syndicate Rings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            GSQL Connected Components Traversals over TigerGraph FraudGraph
          </p>
        </div>

        <Link
          to={`/cases/${currentRing.anchor_case}`}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <span>Inspect Case {currentRing.anchor_case}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Main Layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ring List (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 font-mono">
            Detected Syndicate Clusters ({rings.length})
          </div>
          <div className="space-y-2">
            {rings.map((r) => (
              <div
                key={r.component_id}
                onClick={() => setSelectedRing(r.component_id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all shadow-sm ${
                  selectedRing === r.component_id
                    ? "bg-white border-blue-500 ring-2 ring-blue-500/10"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 font-mono">{r.component_id}</span>
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    {r.size} Accounts
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-sans mt-2 line-clamp-1">
                  {r.shared_device}
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                  <span>
                    Exposure: <strong className="text-slate-900">${r.total_exposure_usd.toFixed(2)}</strong>
                  </span>
                  <span className="text-amber-600 font-medium">{r.confirmed_fraud_count} confirmed</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ring Topology Canvas (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2 font-mono text-sm">
                  <Users className="w-4 h-4 text-blue-600" />
                  {currentRing.component_id} — Connected Topology
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Traversal: <code>(Customer)-[SHARED_DEVICE_PROFILE]-(Customer)</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                {currentRing.pattern}
              </span>
            </div>

            {/* SVG Visualizer */}
            <div className="w-full h-80 bg-slate-50/60 rounded-xl border border-slate-200 relative flex items-center justify-center p-4 overflow-hidden select-none">
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                <defs>
                  <pattern id="grid-dots-light-ring" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#cbd5e1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-dots-light-ring)" />
              </svg>

              <svg className="w-full h-full" viewBox="0 0 520 250">
                {/* Central Anchor: Shared Device */}
                <rect x="200" y="100" width="120" height="50" rx="8" fill="#ffffff" stroke="#7c3aed" strokeWidth="2" />
                <rect x="200" y="100" width="4" height="50" rx="1" fill="#7c3aed" />
                <text x="260" y="122" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
                  Shared Device
                </text>
                <text x="260" y="137" textAnchor="middle" fill="#6d28d9" fontSize="8" fontFamily="monospace">
                  DEV-889104b
                </text>

                {/* Satellite 1 */}
                <line x1="200" y1="125" x2="110" y2="60" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3" />
                <rect x="50" y="40" width="100" height="42" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                <rect x="50" y="40" width="3" height="42" rx="1" fill="#0284c7" />
                <text x="100" y="58" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                  Customer
                </text>
                <text x="100" y="72" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                  {currentRing.members[0] || "C13487"}
                </text>

                {/* Satellite 2 */}
                <line x1="320" y1="125" x2="410" y2="60" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3" />
                <rect x="370" y="40" width="100" height="42" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                <rect x="370" y="40" width="3" height="42" rx="1" fill="#0284c7" />
                <text x="420" y="58" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                  Customer
                </text>
                <text x="420" y="72" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                  {currentRing.members[1] || "C08771"}
                </text>

                {/* Satellite 3 */}
                <line x1="200" y1="125" x2="110" y2="190" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3" />
                <rect x="50" y="170" width="100" height="42" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                <rect x="50" y="170" width="3" height="42" rx="1" fill="#0284c7" />
                <text x="100" y="188" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                  Customer
                </text>
                <text x="100" y="202" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                  {currentRing.members[2] || "C02194"}
                </text>

                {/* Satellite 4 */}
                <line x1="320" y1="125" x2="410" y2="190" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3" />
                <rect x="370" y="170" width="100" height="42" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                <rect x="370" y="170" width="3" height="42" rx="1" fill="#0284c7" />
                <text x="420" y="188" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                  Customer
                </text>
                <text x="420" y="202" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                  {currentRing.members[3] || "C09112"}
                </text>

                {/* Cross-Card Ring sharing path */}
                <path d="M 100 40 Q 260 10 420 40" fill="none" stroke="#f43f5e" strokeWidth="1.8" strokeDasharray="4 2" />
                <rect x="210" y="8" width="100" height="18" rx="9" fill="#ffffff" stroke="#fecdd3" strokeWidth="1" />
                <text x="260" y="20.5" textAnchor="middle" fill="#e11d48" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  SHARED_CARD_RING
                </text>
              </svg>

              <div className="absolute bottom-3 left-3 text-xs text-slate-500 bg-white/95 px-3 py-1 rounded-md border border-slate-200 font-mono shadow-sm">
                Algorithm: <code>connected_components</code>
              </div>
            </div>

            {/* Member Details */}
            <div className="p-4 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-200">
              <div className="text-slate-700 font-mono text-xs font-bold">
                Syndicate Cluster Members &amp; Associated Payment Cards:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                {currentRing.members.map((m, i) => (
                  <div key={m} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <div className="text-blue-700 font-bold">{m}</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">{currentRing.cards[i] || `${m}-K1`}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
