import React, { useState } from "react";
import {
  Share2,
  Users,
  Search,
  Filter,
  ShieldAlert,
  AlertTriangle,
  Network,
  Cpu,
  ArrowRight,
  Database,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-400 font-mono text-[10px] uppercase font-bold">
              Differentiator A
            </span>
            <span className="text-xs text-slate-400 font-mono">TigerGraph Native GSQL BFS</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight mt-1 flex items-center gap-2 font-mono">
            <Network className="w-5 h-5 text-cyan-400" />
            Graph Topology Explorer &amp; Syndicate Rings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            GSQL Connected Components traversals over FraudGraph · Real-time device sharing syndicates
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/cases/${currentRing.anchor_case}`}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 rounded-lg text-xs font-mono font-bold transition-colors flex items-center gap-1.5"
          >
            <span>Inspect Anchor {currentRing.anchor_case}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Main Layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ring List (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 font-mono">
            Detected Fraud Rings ({rings.length})
          </div>
          <div className="space-y-2">
            {rings.map((r) => (
              <div
                key={r.component_id}
                onClick={() => setSelectedRing(r.component_id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedRing === r.component_id
                    ? "bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/30"
                    : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-cyan-400 font-mono">{r.component_id}</span>
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                    {r.size} Accounts
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-sans mt-1.5 line-clamp-1">
                  {r.shared_device}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80">
                  <span>
                    Exposure: <strong className="text-slate-200">${r.total_exposure_usd.toFixed(2)}</strong>
                  </span>
                  <span className="text-amber-400">{r.confirmed_fraud_count} confirmed</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ring Topology Canvas (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2 font-mono text-sm">
                  <Users className="w-4 h-4 text-cyan-400" />
                  {currentRing.component_id} — Connected Component Topology
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Traversal: <code>(Customer)-[SHARED_DEVICE_PROFILE]-(Customer)</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs border border-slate-700">
                Typology: {currentRing.pattern}
              </span>
            </div>

            {/* SVG Visualizer */}
            <div className="w-full h-80 bg-slate-950 rounded-xl border border-slate-800/80 relative flex items-center justify-center p-4 overflow-hidden select-none">
              {/* Radar grid dots */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                <defs>
                  <pattern id="grid-dots-ring" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#475569" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-dots-ring)" />
              </svg>

              <svg className="w-full h-full" viewBox="0 0 520 250">
                {/* Central Anchor: Shared Device */}
                <circle cx="260" cy="125" r="34" fill="#2e1065" stroke="#a855f7" strokeWidth="2.5" />
                <text x="260" y="121" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">
                  Shared Device
                </text>
                <text x="260" y="133" textAnchor="middle" fill="#c084fc" fontSize="7.5" fontFamily="monospace">
                  DEV-889104b
                </text>

                {/* Satellite Customer 1 */}
                <line x1="260" y1="125" x2="110" y2="60" stroke="#a855f7" strokeWidth="2" strokeDasharray="3" />
                <circle cx="110" cy="60" r="26" fill="#082f49" stroke="#0ea5e9" strokeWidth="2" />
                <text x="110" y="58" textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontWeight="bold">
                  Customer
                </text>
                <text x="110" y="70" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                  {currentRing.members[0] || "C13487"}
                </text>

                {/* Satellite Customer 2 */}
                <line x1="260" y1="125" x2="410" y2="60" stroke="#a855f7" strokeWidth="2" strokeDasharray="3" />
                <circle cx="410" cy="60" r="26" fill="#082f49" stroke="#0ea5e9" strokeWidth="2" />
                <text x="410" y="58" textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontWeight="bold">
                  Customer
                </text>
                <text x="410" y="70" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                  {currentRing.members[1] || "C08771"}
                </text>

                {/* Satellite Customer 3 */}
                <line x1="260" y1="125" x2="110" y2="190" stroke="#a855f7" strokeWidth="2" strokeDasharray="3" />
                <circle cx="110" cy="190" r="26" fill="#082f49" stroke="#0ea5e9" strokeWidth="2" />
                <text x="110" y="188" textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontWeight="bold">
                  Customer
                </text>
                <text x="110" y="200" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                  {currentRing.members[2] || "C02194"}
                </text>

                {/* Satellite Customer 4 */}
                <line x1="260" y1="125" x2="410" y2="190" stroke="#a855f7" strokeWidth="2" strokeDasharray="3" />
                <circle cx="410" cy="190" r="26" fill="#082f49" stroke="#0ea5e9" strokeWidth="2" />
                <text x="410" y="188" textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontWeight="bold">
                  Customer
                </text>
                <text x="410" y="200" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                  {currentRing.members[3] || "C09112"}
                </text>

                {/* Direct Cross-Card Sharing Edge */}
                <path d="M 110 60 Q 260 20 410 60" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 2" />
                <rect x="220" y="16" width="80" height="15" rx="3" fill="#0b0f19" stroke="#4c0519" strokeWidth="1" />
                <text x="260" y="27" textAnchor="middle" fill="#f43f5e" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
                  SHARED_CARD_RING
                </text>
              </svg>

              <div className="absolute bottom-3 left-3 text-[10px] text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800 font-mono">
                GSQL Algorithm: <code>connected_components(min_size=2)</code>
              </div>
            </div>

            {/* Member Details */}
            <div className="p-3 bg-slate-950 rounded-lg text-xs space-y-2 border border-slate-800">
              <div className="text-slate-400 font-mono text-[11px] font-bold">
                Syndicate Ring Members &amp; Associated Payment Cards:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                {currentRing.members.map((m, i) => (
                  <div key={m} className="p-2 bg-slate-900 border border-slate-800 rounded">
                    <div className="text-cyan-400 font-bold">{m}</div>
                    <div className="text-slate-400 text-[10px]">{currentRing.cards[i] || `${m}-K1`}</div>
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
