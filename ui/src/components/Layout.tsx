import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Shield,
  Layers,
  Network,
  LayoutDashboard,
  Search,
  ArrowRight
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
    <div className="flex h-screen overflow-hidden bg-[#0c0d11] text-[#ededee] font-sans">
      {/* ── Minimalist Sidebar ────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-[#0e0f13] border-r border-[#1f2026] flex flex-col justify-between">
        <div className="flex flex-col">
          {/* Logo / Brand */}
          <div className="px-5 py-4 border-b border-[#1f2026]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-xs tracking-tight text-zinc-100">
                FraudLens
              </span>
              <span className="text-[10px] text-zinc-500 font-mono ml-auto">v1.2</span>
            </div>
          </div>

          {/* Clean Quick Search */}
          <div className="p-3 border-b border-[#1f2026]">
            <form onSubmit={handleQuickJump} className="relative">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Find case (e.g. 001)..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-[#14151a] border border-[#222329] rounded text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono transition-colors"
              />
            </form>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-0.5">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[#181920] text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14151a]"
                  }`
                }
              >
                <Icon size={14} className="shrink-0 text-zinc-400" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Quiet System Footnote */}
        <div className="px-5 py-3 border-t border-[#1f2026] text-[10px] text-zinc-500 font-mono flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            TigerGraph
          </span>
          <span>Online</span>
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Minimal Top Header */}
        <header className="h-11 bg-[#0c0d11] border-b border-[#1f2026] px-6 flex items-center justify-between shrink-0 text-xs font-mono text-zinc-500">
          <div>Investigation Environment · System of Record: TigerGraph</div>
          <div className="flex items-center gap-3">
            <span>20 Exam Benchmarks</span>
            <span>·</span>
            <span className="text-zinc-300">Policy v1.0</span>
          </div>
        </header>

        {/* Scrollable View */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#0c0d11]">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
