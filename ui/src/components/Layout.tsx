import React, { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Shield,
  Layers,
  Network,
  LayoutDashboard,
  Search,
  Menu,
  X,
  ChevronRight
} from "lucide-react";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [quickSearch, setQuickSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  };

  const navItems = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/cases", label: "Cases", icon: Layers },
    { to: "/graph", label: "Entity Topology", icon: Network },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] text-slate-900 font-sans">
      {/* ── Desktop Light Sidebar (hidden on mobile, visible on md+) ────── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-white border-r border-slate-200 flex-col justify-between z-20">
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

      {/* ── Mobile Slide-Out Drawer (backdrop & menu) ────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="relative w-4/5 max-w-xs bg-white h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
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
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Quick Jump */}
              <div className="p-3 border-b border-slate-100">
                <form onSubmit={handleQuickJump} className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Jump to case ID (e.g. 001)..."
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </form>
              </div>

              {/* Mobile Nav Links */}
              <nav className="p-3 space-y-1 font-mono">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 py-1">
                  Navigation
                </div>
                {navItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={18} className="shrink-0 text-slate-500" />
                      <span>{label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="p-4 border-t border-slate-100 font-mono text-xs flex items-center justify-between bg-slate-50">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                TigerGraph Core
              </span>
              <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded text-[10px] font-bold">
                Connected
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Canvas Viewport ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Responsive Header */}
        <header className="h-14 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Brand / Desktop Title */}
            <div className="flex items-center gap-2">
              <span className="md:hidden font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600 inline" /> FraudLens
              </span>
              <span className="hidden md:inline">
                Investigation Environment · FraudGraph System of Record
              </span>
            </div>
          </div>

          {/* Header Badges & Search Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              title="Quick Jump"
            >
              <Search className="w-4 h-4" />
            </button>

            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] sm:text-xs">
              20 Cases
            </span>
            <span className="hidden sm:inline px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px]">
              Policy Engine v1.0
            </span>
          </div>
        </header>

        {/* Mobile Quick Search Bar (Collapsible) */}
        {mobileSearchOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 p-2.5 px-3 animate-in fade-in duration-150">
            <form onSubmit={handleQuickJump} className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                autoFocus
                placeholder="Jump to case (e.g. 001, HHG-014)..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-blue-500"
              />
            </form>
          </div>
        )}

        {/* Scrollable View (with bottom padding for mobile navigation bar) */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 pb-20 md:pb-6 bg-[#f8fafc]">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* ── Mobile Bottom Navigation Bar (thumb-friendly for phones) ──── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 backdrop-blur border-t border-slate-200 px-6 flex items-center justify-around z-30 font-mono">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to || (to === "/cases" && location.pathname.startsWith("/cases"));
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  isActive ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon size={18} className={isActive ? "text-blue-600" : "text-slate-400"} />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
