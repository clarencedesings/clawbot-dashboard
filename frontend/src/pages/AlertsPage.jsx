import { useEffect, useState, useCallback, useRef } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle,
  X,
} from 'lucide-react'

const SEVERITY_CONFIG = {
  critical: {
    border: 'border-l-red-500',
    badge: 'bg-red-500/15 text-red-400',
    icon: XCircle,
    countBg: 'bg-red-500',
  },
  warning: {
    border: 'border-l-yellow-500',
    badge: 'bg-yellow-500/15 text-yellow-400',
    icon: AlertTriangle,
    countBg: 'bg-yellow-500',
  },
  error: {
    border: 'border-l-orange-500',
    badge: 'bg-orange-500/15 text-orange-400',
    icon: AlertCircle,
    countBg: 'bg-orange-500',
  },
  info: {
    border: 'border-l-blue-500',
    badge: 'bg-blue-500/15 text-blue-400',
    icon: Info,
    countBg: 'bg-blue-500',
  },
}

const FILTERS = ['ALL', 'CRITICAL', 'WARNING', 'ERROR', 'INFO']

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  const fetchAlerts = useCallback(() => {
    setLoading(true)
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((data) => setAlerts(data.alerts || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAlerts()
    intervalRef.current = setInterval(fetchAlerts, 60000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAlerts])

  const dismiss = (id) => {
    fetch(`/api/alerts/${id}/dismiss`, { method: 'POST' })
      .then(() => setAlerts((prev) => prev.filter((a) => a.id !== id)))
      .catch(() => {})
  }

  const filtered =
    filter === 'ALL'
      ? alerts
      : alerts.filter((a) => a.severity === filter.toLowerCase())

  const counts = {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    error: alerts.filter((a) => a.severity === 'error').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Alerts</h2>
        <p className="text-text-dim text-sm mt-1">
          System events and notifications
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 mb-6">
        {Object.entries(counts).map(([sev, count]) => {
          const cfg = SEVERITY_CONFIG[sev]
          return (
            <div
              key={sev}
              className="flex items-center gap-2 bg-card rounded-lg border border-border px-3 py-2"
            >
              <span
                className={`w-5 h-5 rounded-full ${cfg.countBg} text-white text-xs flex items-center justify-center font-bold`}
              >
                {count}
              </span>
              <span className="text-text-dim text-xs capitalize">{sev}</span>
            </div>
          )
        })}
      </div>

      {/* Filter buttons */}
      <div className="flex rounded-lg overflow-hidden border border-border mb-6 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              filter === f
                ? 'bg-accent text-white'
                : 'bg-card text-text-dim hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle size={48} className="text-online mb-4" />
          <h3 className="text-lg font-semibold text-white">
            No alerts — all systems normal
          </h3>
          <p className="text-text-dim text-sm mt-1">
            {loading ? 'Checking...' : 'Everything is running smoothly'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info
            const Icon = cfg.icon
            return (
              <div
                key={alert.id}
                className={`bg-card rounded-xl border border-border border-l-4 ${cfg.border} p-4 flex items-start gap-4`}
              >
                <Icon size={20} className={cfg.badge.split(' ')[1]} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${cfg.badge}`}
                    >
                      {alert.type}
                    </span>
                    <span
                      className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${cfg.badge}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-white text-sm line-clamp-2">
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-dim">
                    <span>{alert.timestamp || '—'}</span>
                    {alert.count > 1 && (
                      <span className="bg-border rounded px-1.5 py-0.5">
                        {alert.count} occurrences
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismiss(alert.id)}
                  className="text-text-dim hover:text-white transition-colors cursor-pointer shrink-0 mt-1"
                  title="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
