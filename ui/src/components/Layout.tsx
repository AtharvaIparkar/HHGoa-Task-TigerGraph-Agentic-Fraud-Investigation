import React, { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ShieldAlert,
  LayoutDashboard,
  Layers,
  Network,
  Activity,
  FileCheck2,
  Lock,
  Search,
  ExternalLink,
  Cpu,
  Database,
  Terminal,
  Zap
} from "lucide-react";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [quickSearch, setQuickSearch] = useState("");

  const handleQuickJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    const query = quickSearch.trim().toUpperCase();
    if (query.startsWith("HHG-") || query.startsWith("CASE-")) {
      navigate(`/cases/${query}`);
    } else if (/^\d+$/.test(query)) {
      const formatted = `HHG-${query.padStart(3, "0")}`;
      navigate(`/cases/${formatted}`);
    } else {
      navigate(`/cases?search=${encodeURIComponent(query)}`);
    }
    setQuickSearch("");
  };

  const navItems = [
    { to: "/dashboard", label: "Operations Triage", icon: LayoutDashboard, badge: "Live" },
    { to: "/cases", label: "Exam Case Workstation", icon: Layers, badge: "20" },
    { to: "/graph", label: "Graph Topology & Rings", icon: Network, badge: "Diff A" },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* ── Left Navigation Rail ────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-slate-900/90 border-r border-slate-800/90 flex flex-col justify-between">
        <div className="flex flex-col">
          {/* Brand & System of Record */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-md">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight text-slate-100 flex items-center gap-1.5">
                  FraudLens <span className="text-[10px] font-mono text-cyan-400 px-1 py-0.2 rounded bg-cyan-950 border border-cyan-800">TG-GSQL</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  TigerGraph Agentic Intelligence
                </div>
              </div>
            </div>
          </div>

          {/* Quick Case Switcher */}
          <div className="p-3 border-b border-slate-800/60">
            <form onSubmit={handleQuickJump} className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Jump to case (e.g. 001)..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-all"
              />
            </form>
          </div>

          {/* Main Navigation Links */}
          <div className="p-3 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-1.5">
              Investigation Operations
            </div>
            {navItems.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} className="shrink-0" />
                  <span>{label}</span>
                </div>
                {badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                    {badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          {/* Differentiators & Compliance */}
          <div className="p-3 space-y-1 border-t border-slate-800/60">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-1.5">
              Graph Engine &amp; Policies
            </div>
            <div className="px-3 py-2 text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  GraphRAG Gating
                </span>
                <span className="font-mono text-purple-300 text-[10px]">Diff B (Active)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  Case Memory
                </span>
                <span className="font-mono text-amber-300 text-[10px]">Diff C (Active)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-rose-400" />
                  SAR Compliance
                </span>
                <span className="font-mono text-rose-300 text-[10px]">31 CFR 1020</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live System Status / Telemetry Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 space-y-1.5 font-mono">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              TigerGraph Savanna
            </span>
            <span className="text-emerald-400 text-[10px]">Connected</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-cyan-400" />
              TigerGraph MCP
            </span>
            <span className="text-slate-300 text-[10px]">11 Tools Ready</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              Actions Mock Service
            </span>
            <span className="text-slate-300 text-[10px]">Port 8001</span>
          </div>
          <div className="pt-1 text-[9px] text-slate-400 text-center">
            Hacker House Goa 2026 · TigerGraph
          </div>
        </div>
      </aside>

      {/* ── Main Viewport ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Operational Status Bar */}
        <header className="h-12 bg-slate-900/60 backdrop-blur border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400">System:</span>
              <span className="text-slate-200 font-semibold">Production Fraud Intelligence Engine</span>
            </div>
            <span>/</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400">Scope:</span>
              <span className="text-cyan-400">20 Benchmark Exam Cases (Isolated)</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="hidden md:flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                GSQL v3.9
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                LangGraph FSM
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                Policy Engine v1.0
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
