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
  { to: '/paige', label: 'Paige', icon: PenLine },
]

export default function Sidebar() {
  const [serverOnline, setServerOnline] = useState(false)

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

  return (
    <aside className="w-56 bg-sidebar border-r border-border flex flex-col shrink-0">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-bold text-white tracking-tight">
          Clawbot
        </h1>
        <p className="text-xs text-text-dim mt-0.5">Dashboard v1.0</p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
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
            {item.label}
          </NavLink>
        ))}
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
