import React, { useState } from "react";
import { Share2, Users, Search, Filter, ShieldAlert, AlertTriangle } from "lucide-react";
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
      total_exposure_usd: 3491.20,
      pattern: "card_not_present_new_device",
    },
    {
      component_id: "RING-002",
      size: 3,
      members: ["C12382", "C07297", "C08299"],
      cards: ["C12382-K1", "C07297-K1"],
      shared_device: "Billing Region 444.0 Cluster (REG-444)",
      confirmed_fraud_count: 2,
      total_exposure_usd: 1840.50,
      pattern: "out_of_region_use",
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
    },
  ];

  const currentRing = rings.find((r) => r.component_id === selectedRing) || rings[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-cyan-400" />
            Graph Topology Explorer & Syndicate Rings (Differentiator A)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            GSQL Connected Components &amp; Multi-Hop BFS Traversals over TigerGraph FraudGraph
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ring List (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Detected Fraud Rings ({rings.length})
          </div>
          <div className="space-y-2">
            {rings.map((r) => (
              <div
                key={r.component_id}
                onClick={() => setSelectedRing(r.component_id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedRing === r.component_id
                    ? "bg-slate-900 border-cyan-500 shadow-md"
                    : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-cyan-400 font-mono">{r.component_id}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                    {r.size} Accounts
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium mt-1 truncate">
                  {r.shared_device}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                  <span>Exposure: <strong className="text-slate-200 font-mono">${r.total_exposure_usd.toFixed(2)}</strong></span>
                  <span className="text-amber-400 font-mono">{r.confirmed_fraud_count} confirmed</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ring Topology Canvas (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  {currentRing.component_id} — Connected Component Topology
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Traversal: <code>(Customer)-[SHARED_DEVICE_PROFILE]-(Customer)</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                Typology: {currentRing.pattern}
              </span>
            </div>

            {/* SVG Visualizer */}
            <div className="w-full h-80 bg-slate-950 rounded-xl border border-slate-800/80 relative flex items-center justify-center p-4">
              <svg className="w-full h-full" viewBox="0 0 500 240">
                {/* Central Anchor: Shared Device */}
                <circle cx="250" cy="120" r="32" fill="#1e1b4b" stroke="#a855f7" strokeWidth="2.5" />
                <text x="250" y="116" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">Shared Device</text>
                <text x="250" y="128" textAnchor="middle" fill="#c084fc" fontSize="7" fontFamily="monospace">DEV-889104b</text>

                {/* Satellite Customers */}
                <line x1="250" y1="120" x2="110" y2="60" stroke="#a855f7" strokeWidth="2" strokeDasharray="3" />
                <circle cx="110" cy="60" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                <text x="110" y="58" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="bold">Customer</text>
                <text x="110" y="69" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">{currentRing.members[0] || 'C13487'}</text>

                <line x1="250" y1="120" x2="390" y2="60" stroke="#a855f7" strokeWidth="2" strokeDasharray="3" />
                <circle cx="390" cy="60" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                <text x="390" y="58" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="bold">Customer</text>
                <text x="390" y="69" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">{currentRing.members[1] || 'C08771'}</text>

                <line x1="250" y1="120" x2="110" y2="180" stroke="#a855f7" strokeWidth="2" strokeDasharray="3" />
                <circle cx="110" cy="180" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                <text x="110" y="178" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="bold">Customer</text>
                <text x="110" y="189" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">{currentRing.members[2] || 'C02194'}</text>

                <line x1="250" y1="120" x2="390" y2="180" stroke="#a855f7" strokeWidth="2" strokeDasharray="3" />
                <circle cx="390" cy="180" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                <text x="390" y="178" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="bold">Customer</text>
                <text x="390" y="189" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">{currentRing.members[3] || 'C09112'}</text>

                {/* Direct Cross-Card Sharing Edge */}
                <path d="M 110 60 Q 250 20 390 60" fill="none" stroke="#f43f5e" strokeWidth="2" />
                <text x="250" y="32" textAnchor="middle" fill="#f43f5e" fontSize="7" fontWeight="bold">SHARED_CARD</text>
              </svg>

              <div className="absolute bottom-3 left-3 text-[10px] text-slate-400 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                GSQL Algorithm: <code>connected_components(min_size=2)</code>
              </div>
            </div>

            {/* Member Details */}
            <div className="p-3 bg-slate-950 rounded-lg text-xs space-y-2">
              <div className="text-slate-400 font-semibold">Syndicate Ring Members &amp; Associated Payment Cards:</div>
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
