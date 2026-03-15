import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
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
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
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
]

export default function Sidebar() {
  const [serverOnline, setServerOnline] = useState(false)
  const [notifs, setNotifs] = useState({ pending_tasks: 0, pending_posts: 0, total: 0 })

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

  return (
    <aside className="w-56 bg-sidebar border-r border-border flex flex-col shrink-0">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-bold text-white tracking-tight">
          Clawbot
        </h1>
        <p className="text-xs text-text-dim mt-0.5">Dashboard v1.0</p>
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
      <div className="p-4 border-t border-border">
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
      </div>
    </aside>
  )
}
