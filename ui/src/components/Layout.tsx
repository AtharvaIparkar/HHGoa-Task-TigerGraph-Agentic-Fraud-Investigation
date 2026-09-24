import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Shield,
  Layers,
  Network,
  LayoutDashboard,
  Search,
  ExternalLink
} from "lucide-react";

export default function Layout() {
  const navigate = useNavigate();
  const [quickSearch, setQuickSearch] = useState("");

  const handleQuickJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    const query = quickSearch.trim().toUpperCase();
    if (query.startsWith("HHG-") || query.startsWith("CASE-")) {
      navigate(`/cases/${query}`);
    } else if (/^\d+$/.test(query)) {
      navigate(`/cases/HHG-${query.padStart(3, "0")}`);
    } else {
      navigate(`/cases?search=${encodeURIComponent(query)}`);
    }
    setQuickSearch("");
  };

  const navItems = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/cases", label: "Cases", icon: Layers },
    { to: "/graph", label: "Entity Topology", icon: Network },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] text-slate-900 font-sans">
      {/* ── Modern Light Sidebar ────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between">
        <div className="flex flex-col">
          {/* Logo / Brand */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-slate-900 block leading-tight">
                  FraudLens
                </span>
                <span className="text-[10px] text-slate-400 font-mono">TigerGraph Core</span>
              </div>
            </div>
          </div>

          {/* Clean Quick Search */}
          <div className="p-3 border-b border-slate-100">
            <form onSubmit={handleQuickJump} className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Jump to case (e.g. 001)..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-mono transition-colors"
              />
            </form>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 py-1 font-mono">
              Operations
            </div>
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`
                }
              >
                <Icon size={16} className="shrink-0 text-slate-500" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Quiet Footnote */}
        <div className="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            TigerGraph
          </span>
          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
            Connected
          </span>
        </div>
      </aside>

      {/* ── Main Canvas Viewport ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sleek Light Header */}
        <header className="h-13 bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0 text-xs font-mono text-slate-500">
          <div>Investigation Environment · FraudGraph System of Record</div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
              20 Benchmark Cases
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px]">
              Policy Engine v1.0
            </span>
          </div>
        </header>

        {/* Scrollable View */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
