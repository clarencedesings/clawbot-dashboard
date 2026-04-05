import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
  Monitor,
  Network,
  ListChecks,
  ScrollText,
  Bell,
  Coins,
  BrainCircuit,
  Store,
  Coffee,
  PenLine,
  ShieldCheck,
  Wrench,
  Box,
  Leaf,
  BarChart3,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import VoiceSelector from './VoiceSelector'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/system', label: 'System', icon: Monitor },
  { to: '/bots', label: 'Bots', icon: Bot },
  { to: '/gateway', label: 'Gateway', icon: Network },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/tokens', label: 'Tokens', icon: Coins },
  { to: '/memory', label: 'Memory', icon: BrainCircuit },
  { to: '/store', label: 'Store', icon: Store },
  { to: '/kofi', label: 'Ko-fi', icon: Coffee },
  { to: '/paige', label: 'Paige', icon: PenLine, badgeKey: 'pending_posts' },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck, badgeKey: 'pending_tasks' },
  { to: '/ollama', label: 'Ollama', icon: Box },
  { to: '/earthlie-blog', label: 'Earthlie Blog', icon: Leaf },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/tools', label: 'Tools', icon: Wrench },
]

export default function Sidebar({ onLogout }) {
  const [serverOnline, setServerOnline] = useState(false)
  const [notifs, setNotifs] = useState({ pending_tasks: 0, pending_posts: 0, total: 0 })
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const poll = () => {
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => setServerOnline(d.status === 'ok'))
        .catch(() => setServerOnline(false))
    }
    poll()
    const id = setInterval(poll, 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const pollNotifs = () => {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((data) => {
          setNotifs(data)
          document.title = data.total > 0
            ? `(${data.total}) CLAWBOT Dashboard`
            : 'CLAWBOT Dashboard'
        })
        .catch(() => {})
    }
    pollNotifs()
    const id = setInterval(pollNotifs, 15000)
    return () => clearInterval(id)
  }, [])

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Clawbot
          </h1>
          <p className="text-xs text-text-dim mt-0.5">Dashboard v1.0</p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-text-dim hover:text-white transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const badge = item.badgeKey ? notifs[item.badgeKey] || 0 : 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-text-dim hover:bg-card hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                  {badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
      <div className="p-4 border-t border-border space-y-3">
        <VoiceSelector />
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              serverOnline ? 'bg-online' : 'bg-offline'
            }`}
          />
          <span className="text-xs text-text-dim">
            Server: {serverOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-dim hover:bg-card hover:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 bg-sidebar border border-border rounded-lg p-2 text-text-dim hover:text-white transition-colors cursor-pointer"
      >
        <Menu size={20} />
        {notifs.total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
            {notifs.total}
          </span>
        )}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — always visible on md+, overlay on mobile */}
      <aside
        className={`
          w-56 bg-sidebar border-r border-border flex flex-col shrink-0
          fixed md:static inset-y-0 left-0 z-50
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
