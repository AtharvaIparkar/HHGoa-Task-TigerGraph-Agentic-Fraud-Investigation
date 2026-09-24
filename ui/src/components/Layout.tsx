import { Outlet, NavLink } from 'react-router-dom'
import {
  ShieldAlert, LayoutDashboard, List, Network, Activity
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/cases',     label: 'Cases',        Icon: List            },
  { to: '/graph',     label: 'Graph',        Icon: Network         },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-700">
          <ShieldAlert className="text-cyan-400" size={22} />
          <span className="font-semibold text-slate-100 text-sm leading-tight">
            Fraud<br />
            <span className="text-cyan-400 font-bold">Investigator</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
          Hacker House Goa 2026 · TigerGraph
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center gap-2">
          <Activity size={14} className="text-green-400" />
          <span className="text-xs text-slate-500">TigerGraph FraudGraph connected</span>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
