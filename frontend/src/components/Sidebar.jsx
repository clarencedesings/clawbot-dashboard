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
  Sun,
  Moon,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  FolderUp,
  ClipboardCheck,
  PackageCheck,
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

const PHYLLIS_ITEMS = [
  { to: '/phyllis/bot-control', label: 'Bot Control', icon: Bot },
  { to: '/phyllis/canva-drop', label: 'Canva Drop', icon: FolderUp },
  { to: '/phyllis/review-queue', label: 'Review Queue', icon: ClipboardCheck },
  { to: '/phyllis/published', label: 'Published', icon: PackageCheck },
]

export default function Sidebar({ onLogout }) {
  const [serverOnline, setServerOnline] = useState(false)
  const [notifs, setNotifs] = useState({ pending_tasks: 0, pending_posts: 0, total: 0 })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme_mode') || 'dark')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
  const [phyllisOpen, setPhyllisOpen] = useState(() => localStorage.getItem('phyllis_nav_open') !== 'false')
  const location = useLocation()

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme_mode', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

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

  // Mobile always uses expanded layout
  const isCollapsed = collapsed && !mobileOpen

  const sidebarContent = (
    <>
      {/* Header */}
      <div className={`border-b border-border flex items-center ${isCollapsed ? 'p-3 justify-center' : 'p-5 justify-between'}`}>
        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight">
              Clawbot
            </h1>
            <p className="text-xs text-text-dim mt-0.5">Dashboard v1.0</p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleCollapse}
            className="hidden md:flex text-text-dim hover:text-white transition-colors cursor-pointer p-1 rounded-md hover:bg-card"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-text-dim hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className={`flex-1 ${isCollapsed ? 'p-1.5' : 'p-3'} space-y-1 overflow-y-auto`}>
        {/* Phyllis Studio section */}
        <div className={`${isCollapsed ? '' : 'pb-2 mb-2'} border-b border-border`}>
          <button
            onClick={() => setPhyllisOpen(prev => {
              const next = !prev
              localStorage.setItem('phyllis_nav_open', String(next))
              return next
            })}
            title={isCollapsed ? 'Phyllis Studio' : undefined}
            className={`w-full flex items-center rounded-lg text-sm transition-all duration-200 ${
              isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            } text-[#d4948a] hover:bg-[#d4948a]/10`}
          >
            <Store size={18} className="shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left font-medium truncate">Phyllis Studio</span>
                <ChevronDown size={14} className={`transition-transform ${phyllisOpen ? '' : '-rotate-90'}`} />
              </>
            )}
          </button>
          {phyllisOpen && (
            <div className={`space-y-1 ${isCollapsed ? '' : 'mt-1'}`}>
              {PHYLLIS_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `w-full flex items-center rounded-lg text-sm transition-all duration-200 relative ${
                      isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-[#d4948a]/20 text-[#d4948a]'
                        : 'text-text-dim hover:bg-[#d4948a]/10 hover:text-[#d4948a]'
                    }`
                  }
                >
                  <item.icon size={18} className="shrink-0" />
                  {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {NAV_ITEMS.map((item) => {
          const badge = item.badgeKey ? notifs[item.badgeKey] || 0 : 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `w-full flex items-center rounded-lg text-sm transition-all duration-200 relative ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-accent text-white sidebar-active'
                    : 'text-text-dim hover:bg-card hover:text-white'
                }`
              }
            >
              <item.icon size={18} className="shrink-0" />
              {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!isCollapsed && badge > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                  {badge}
                </span>
              )}
              {isCollapsed && badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-1">
                  {badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={`border-t border-border space-y-2 ${isCollapsed ? 'p-2' : 'p-4 space-y-3'}`}>
        {!isCollapsed && <VoiceSelector />}
        <button
          onClick={toggleTheme}
          title={isCollapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
          className={`flex items-center rounded-lg text-text-dim hover:bg-card hover:text-white transition-colors cursor-pointer ${
            isCollapsed ? 'w-full justify-center p-2.5' : 'w-full gap-2 px-3 py-2 text-xs'
          }`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {!isCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <div className={`flex items-center ${isCollapsed ? 'justify-center py-1' : 'gap-2'}`}
          title={isCollapsed ? `Server: ${serverOnline ? 'Online' : 'Offline'}` : undefined}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              serverOnline ? 'bg-online pulse-online' : 'bg-offline pulse-offline'
            }`}
          />
          {!isCollapsed && (
            <span className="text-xs text-text-dim">
              Server: {serverOnline ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            title={isCollapsed ? 'Logout' : undefined}
            className={`flex items-center rounded-lg text-text-dim hover:bg-card hover:text-red-400 transition-colors cursor-pointer ${
              isCollapsed ? 'w-full justify-center p-2.5' : 'w-full gap-2 px-3 py-2 text-xs'
            }`}
          >
            <LogOut size={14} />
            {!isCollapsed && <span>Logout</span>}
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
          border-r border-border flex flex-col shrink-0 overflow-hidden
          fixed md:static inset-y-0 left-0 z-50
          transition-all duration-200 ease-in-out
          ${mobileOpen ? 'w-56 translate-x-0' : `-translate-x-full md:translate-x-0 ${isCollapsed ? 'md:w-[60px]' : 'md:w-56'}`}
        `}
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 6%, var(--color-sidebar)) 0%, var(--color-sidebar) 40%, color-mix(in srgb, var(--color-accent) 4%, var(--color-sidebar)) 100%)`,
        }}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
