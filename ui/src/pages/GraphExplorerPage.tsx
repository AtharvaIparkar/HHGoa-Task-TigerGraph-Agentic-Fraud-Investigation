import React, { useState, useEffect } from "react";
import {
  Users,
  Network,
  ArrowRight,
  Shield,
  Layers,
  Info,
  Loader2,
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

// Static dataset derived from connected_components GSQL query (offline fallback).
// Members/devices are consistent with the MCP tools.py connected_components fallback
// which returns these exact 3 rings when TigerGraph is offline.
// Edge type used in schema: SHARED_DEVICE_PROFILE (not "SHARED_CARD_RING" — that edge
// does not exist in the graph schema).
const STATIC_RINGS: FraudRingItem[] = [
  {
    component_id: "RING-001",
    size: 4,
    members: ["C13487", "C08771", "C02194", "C09112"],
    cards: ["C13487-K1", "C08771-K1", "C02194-K2", "C09112-K1"],
    shared_device: "SAMSUNG SM-G892A (DEV-889104b)",
    confirmed_fraud_count: 3,
    total_exposure_usd: 3491.20,
    pattern: "card_not_present_new_device",
    anchor_case: "HHG-014",
  },
  {
    component_id: "RING-002",
    size: 3,
    members: ["C12382", "C07297", "C08299"],
    cards: ["C12382-K1", "C07297-K1", "C08299-K1"],
    shared_device: "Billing Region 444.0 Cluster (REG-444)",
    confirmed_fraud_count: 2,
    total_exposure_usd: 1840.50,
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

export const GraphExplorerPage: React.FC = () => {
  const [selectedRing, setSelectedRing] = useState<string>("RING-001");
  const [rings, setRings] = useState<FraudRingItem[]>(STATIC_RINGS);
  const [tgConnected, setTgConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Attempt to fetch live component data from /api/graph/stats
  useEffect(() => {
    setLoading(true);
    fetch("/api/graph/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.components && data.components.length > 0) {
          // Map live components to FraudRingItem shape
          const liveRings: FraudRingItem[] = data.components.map(
            (c: any, idx: number) => ({
              component_id: c.component_id || `RING-${String(idx + 1).padStart(3, "0")}`,
              size: c.size || c.members?.length || 0,
              members: c.members || [],
              cards: (c.members || []).map((m: string) => `${m}-K1`),
              shared_device: c.shared_device || "Unknown shared attribute",
              confirmed_fraud_count: c.confirmed_fraud_count ?? 0,
              total_exposure_usd: parseFloat(c.total_exposure ?? c.total_exposure_usd ?? 0),
              pattern: c.pattern || "unknown",
              anchor_case: c.anchor_case || "",
            })
          );
          setRings(liveRings.length > 0 ? liveRings : STATIC_RINGS);
          setTgConnected(!!data.tigergraph_connected);
        } else {
          // Fall back to static dataset
          setRings(STATIC_RINGS);
          setTgConnected(false);
        }
      })
      .catch(() => {
        setRings(STATIC_RINGS);
        setTgConnected(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentRing = rings.find((r) => r.component_id === selectedRing) || rings[0];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 font-mono">
            <Network className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Entity Topology &amp; Syndicate Rings</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-mono">
            GSQL Connected Components via{" "}
            <code className="text-blue-600">(Customer)-[SHARED_DEVICE_PROFILE]-(Customer)</code>
            {" "}traversal · TigerGraph FraudGraph
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* TigerGraph connection status badge */}
          <span
            className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono font-semibold border ${
              tgConnected === true
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : tgConnected === false
                ? "bg-slate-50 text-slate-500 border-slate-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                tgConnected === true
                  ? "bg-emerald-500"
                  : tgConnected === false
                  ? "bg-slate-400"
                  : "bg-amber-400"
              }`}
            />
            {tgConnected === true
              ? "TigerGraph Live"
              : tgConnected === false
              ? "Demo Dataset"
              : "Connecting…"}
          </span>

          {currentRing?.anchor_case && (
            <Link
              to={`/cases/${currentRing.anchor_case}`}
              className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Inspect Case {currentRing.anchor_case}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Main Layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ring List (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Detected Syndicate Clusters ({rings.length})
            </div>
            {loading && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
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
                  {currentRing?.component_id} — Connected Topology
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {/* Correct schema edge type — SHARED_DEVICE_PROFILE exists in graph/schema.gsql */}
                  Traversal: <code>(Customer)-[SHARED_DEVICE_PROFILE]-(Customer)</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                {currentRing?.pattern}
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
                {/* Central Anchor: Shared Device (SHARED_DEVICE_PROFILE schema vertex) */}
                <rect x="200" y="100" width="120" height="50" rx="8" fill="#ffffff" stroke="#7c3aed" strokeWidth="2" />
                <rect x="200" y="100" width="4" height="50" rx="1" fill="#7c3aed" />
                <text x="260" y="122" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
                  Shared Device
                </text>
                <text x="260" y="137" textAnchor="middle" fill="#6d28d9" fontSize="8" fontFamily="monospace">
                  {currentRing?.shared_device?.split("(")[1]?.replace(")", "") ||
                    currentRing?.shared_device?.slice(0, 18) ||
                    "DeviceProfile"}
                </text>

                {/* Satellite 1 */}
                <line x1="200" y1="125" x2="110" y2="60" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3" />
                <rect x="50" y="40" width="100" height="42" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                <rect x="50" y="40" width="3" height="42" rx="1" fill="#0284c7" />
                <text x="100" y="58" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">Customer</text>
                <text x="100" y="72" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                  {currentRing?.members[0] || "—"}
                </text>

                {/* Satellite 2 */}
                <line x1="320" y1="125" x2="410" y2="60" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3" />
                <rect x="370" y="40" width="100" height="42" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                <rect x="370" y="40" width="3" height="42" rx="1" fill="#0284c7" />
                <text x="420" y="58" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">Customer</text>
                <text x="420" y="72" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                  {currentRing?.members[1] || "—"}
                </text>

                {/* Satellite 3 */}
                <line x1="200" y1="125" x2="110" y2="190" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3" />
                <rect x="50" y="170" width="100" height="42" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                <rect x="50" y="170" width="3" height="42" rx="1" fill="#0284c7" />
                <text x="100" y="188" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">Customer</text>
                <text x="100" y="202" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                  {currentRing?.members[2] || "—"}
                </text>

                {/* Satellite 4 (only rendered if ring has 4+ members) */}
                {(currentRing?.members.length ?? 0) >= 4 && (
                  <>
                    <line x1="320" y1="125" x2="410" y2="190" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3" />
                    <rect x="370" y="170" width="100" height="42" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                    <rect x="370" y="170" width="3" height="42" rx="1" fill="#0284c7" />
                    <text x="420" y="188" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">Customer</text>
                    <text x="420" y="202" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                      {currentRing?.members[3]}
                    </text>
                  </>
                )}

                {/* SHARED_DEVICE_PROFILE edge label — correct schema edge type */}
                <path d="M 100 40 Q 260 10 420 40" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeDasharray="4 2" />
                <rect x="185" y="8" width="150" height="18" rx="9" fill="#ffffff" stroke="#ddd6fe" strokeWidth="1" />
                <text x="260" y="20.5" textAnchor="middle" fill="#7c3aed" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  SHARED_DEVICE_PROFILE
                </text>
              </svg>

              <div className="absolute bottom-3 left-3 text-xs text-slate-500 bg-white/95 px-3 py-1 rounded-md border border-slate-200 font-mono shadow-sm">
                Algorithm: <code>connected_components</code>
              </div>

              {!tgConnected && (
                <div className="absolute top-3 right-3 text-[10px] text-slate-400 bg-white/90 px-2 py-1 rounded border border-slate-200 font-mono">
                  Demo dataset · Connect TigerGraph for live data
                </div>
              )}
            </div>

            {/* Member Details */}
            <div className="p-4 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-200">
              <div className="text-slate-700 font-mono text-xs font-bold">
                Syndicate Cluster Members &amp; Associated Payment Cards:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                {(currentRing?.members || []).map((m, i) => (
                  <div key={m} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <div className="text-blue-700 font-bold">{m}</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      {currentRing?.cards[i] || `${m}-K1`}
                    </div>
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
