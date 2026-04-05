import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Activity,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Coffee,
  PenLine,
  Leaf,
  Bot,
  Send,
} from 'lucide-react'

const MAX_ITEMS = 25

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date)) return dateStr
  const now = new Date()
  const diffMs = now - date
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function truncate(str, len = 50) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
}

export default function ActivityFeed() {
  const [events, setEvents] = useState([])
  const [newKeys, setNewKeys] = useState(new Set())
  const intervalRef = useRef(null)
  const isFirstLoad = useRef(true)
  const prevKeysRef = useRef(new Set())

  const fetchEvents = useCallback(() => {
    Promise.all([
      fetch('/api/tasks/queue-history').then((r) => r.json()).catch(() => ({ approved: [], denied: [] })),
      fetch('/api/kofi/stats').then((r) => r.json()).catch(() => ({ recent: [] })),
      fetch('/api/store/recent-orders').then((r) => r.json()).catch(() => ({ orders: [] })),
      fetch('/api/paige/processed').then((r) => r.json()).catch(() => ({ posts: [] })),
      fetch('/api/earthlie/api/internal/blog').then((r) => r.json()).catch(() => []),
      fetch('/api/tasks/history').then((r) => r.json()).catch(() => ({ history: [] })),
    ]).then(([taskHistory, kofiStats, storeOrders, paigePosts, earthliePosts, tasksHistory]) => {
      const items = []

      // Task approvals/denials
      for (const t of taskHistory.approved || []) {
        items.push({
          key: `task-approved-${t.filename || t.approved_at}`,
          icon: 'approved',
          text: `Task approved — ${truncate(t.task)}`,
          time: t.approved_at,
          category: 'task',
        })
      }
      for (const t of taskHistory.denied || []) {
        items.push({
          key: `task-denied-${t.filename || t.denied_at}`,
          icon: 'denied',
          text: `Task denied — ${truncate(t.task)}`,
          time: t.denied_at,
          category: 'task',
        })
      }

      // Ko-fi sales
      for (const t of kofiStats.recent || []) {
        items.push({
          key: `kofi-${t.timestamp}-${t.amount}`,
          icon: 'kofi',
          text: `Ko-fi ${t.type || 'sale'} — $${parseFloat(t.amount || 0).toFixed(2)}`,
          time: t.timestamp,
          category: 'kofi',
        })
      }

      // Store orders
      for (const o of storeOrders.orders || []) {
        items.push({
          key: `order-${o.id || o.created_at}`,
          icon: 'order',
          text: `New order — $${parseFloat(o.amount || 0).toFixed(2)}${o.products?.length ? ` (${truncate(o.products.join(', '), 30)})` : ''}`,
          time: o.created_at,
          category: 'store',
        })
      }

      // Paige published posts
      for (const p of (paigePosts.posts || []).slice(0, 10)) {
        items.push({
          key: `paige-${p.filename}`,
          icon: 'paige',
          text: `Paige post published — ${truncate(p.title)}`,
          time: p.date,
          category: 'paige',
        })
      }

      // Earthlie blog posts
      const earthlieArr = Array.isArray(earthliePosts) ? earthliePosts : earthliePosts.posts || []
      for (const p of earthlieArr.slice(0, 10)) {
        if (p.status === 'approved' || p.status === 'published') {
          items.push({
            key: `earthlie-approved-${p._id || p.id || p.title}`,
            icon: 'earthlie-approved',
            text: `Blog post approved — ${truncate(p.title)}`,
            time: p.approved_at || p.created_at || p.date,
            category: 'earthlie',
          })
        } else if (p.status === 'rejected') {
          items.push({
            key: `earthlie-rejected-${p._id || p.id || p.title}`,
            icon: 'earthlie-rejected',
            text: `Blog post rejected — ${truncate(p.title)}`,
            time: p.rejected_at || p.created_at || p.date,
            category: 'earthlie',
          })
        }
      }

      // Jarvis commands sent
      for (const t of (tasksHistory.history || []).slice(0, 10)) {
        items.push({
          key: `cmd-${t.sent_at}-${t.message?.slice(0, 20)}`,
          icon: 'command',
          text: `Command sent �� ${truncate(t.message)}`,
          time: t.sent_at,
          category: 'command',
        })
      }

      // Sort by time descending, take top MAX_ITEMS
      items.sort((a, b) => {
        const da = a.time ? new Date(a.time) : new Date(0)
        const db = b.time ? new Date(b.time) : new Date(0)
        return db - da
      })
      const top = items.slice(0, MAX_ITEMS)

      // Track new items for animation
      const currentKeys = new Set(top.map((e) => e.key))
      if (isFirstLoad.current) {
        isFirstLoad.current = false
      } else {
        const fresh = new Set()
        for (const k of currentKeys) {
          if (!prevKeysRef.current.has(k)) fresh.add(k)
        }
        if (fresh.size > 0) {
          setNewKeys(fresh)
          setTimeout(() => setNewKeys(new Set()), 600)
        }
      }
      prevKeysRef.current = currentKeys
      setEvents(top)
    })
  }, [])

  useEffect(() => {
    fetchEvents()
    intervalRef.current = setInterval(fetchEvents, 30000)
    return () => clearInterval(intervalRef.current)
  }, []) // intentionally only on mount — fetchEvents uses ref for prevKeys comparison

  const iconFor = (type) => {
    switch (type) {
      case 'approved': return <CheckCircle size={14} className="text-green-400" />
      case 'denied': return <XCircle size={14} className="text-red-400" />
      case 'kofi': return <Coffee size={14} className="text-yellow-400" />
      case 'order': return <ShoppingCart size={14} className="text-blue-400" />
      case 'paige': return <PenLine size={14} className="text-accent-hover" />
      case 'earthlie-approved': return <Leaf size={14} className="text-green-400" />
      case 'earthlie-rejected': return <Leaf size={14} className="text-red-400" />
      case 'command': return <Send size={14} className="text-accent" />
      default: return <Bot size={14} className="text-text-dim" />
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={18} className="text-accent" />
        <h3 className="text-white font-semibold">Activity Feed</h3>
        {events.length > 0 && (
          <span className="text-[10px] bg-accent/15 text-accent-hover px-2 py-0.5 rounded font-bold">
            {events.length}
          </span>
        )}
      </div>
      <div className="overflow-y-auto max-h-80 space-y-0.5">
        {events.length === 0 ? (
          <p className="text-text-dim text-sm py-4 text-center">No recent activity</p>
        ) : (
          events.map((evt) => (
            <div
              key={evt.key}
              className={`flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-sidebar/50 transition-all duration-300 ${
                newKeys.has(evt.key) ? 'animate-fade-in bg-accent/5' : ''
              }`}
            >
              <span className="shrink-0 mt-0.5">{iconFor(evt.icon)}</span>
              <span className="text-sm text-white flex-1 min-w-0 truncate">
                {evt.text}
              </span>
              <span className="text-xs text-text-dim shrink-0 whitespace-nowrap">
                {timeAgo(evt.time)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
