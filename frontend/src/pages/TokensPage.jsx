import { useEffect, useState, useCallback, useRef } from 'react'
import { Zap, Clock, AlertCircle, DollarSign, ExternalLink } from 'lucide-react'

const STAT_CARDS = [
  { key: 'requests_total', label: 'Total Requests', icon: Zap, color: 'text-accent', format: (v) => v },
  { key: 'avg_response_ms', label: 'Avg Response', icon: Clock, color: 'text-blue-400', format: (v) => `${v}ms` },
  { key: 'errors_total', label: 'Total Errors', icon: AlertCircle, color: 'text-red-400', format: (v) => v },
  { key: 'estimated_cost', label: 'Est. Total Cost', icon: DollarSign, color: 'text-green-400', format: (v) => `$${v.toFixed(3)}` },
]

export default function TokensPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/tokens')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 60000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const hourly = data?.hourly_breakdown || []
  const maxReqs = Math.max(1, ...hourly.map((h) => h.requests))
  const activity = data?.recent_activity || []

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Token Usage</h2>
        <p className="text-text-dim text-sm mt-1">
          API usage and cost tracking
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const value = data?.[card.key] ?? 0
          return (
            <div
              key={card.key}
              className="bg-card rounded-xl border border-border p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className={card.color} />
                <p className="text-text-dim text-xs uppercase tracking-wider">
                  {card.label}
                </p>
              </div>
              <p className="text-2xl font-bold text-white">
                {loading && !data ? '—' : card.format(value)}
              </p>
            </div>
          )
        })}
        {/* Balance card — links to Anthropic Console */}
        <a
          href="https://console.anthropic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card rounded-xl border border-border p-4 hover:border-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink size={16} className="text-yellow-400" />
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Balance
            </p>
          </div>
          <p className="text-sm font-semibold text-accent-hover">
            Check Anthropic Console
          </p>
        </a>
      </div>

      {/* Hourly Chart */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <h3 className="text-white font-semibold mb-4">
          Requests — Hourly Activity
        </h3>
        <div className="flex items-end gap-1 h-40">
          {hourly.map((h, i) => {
            const pct = (h.requests / maxReqs) * 100
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center group"
              >
                <div className="relative w-full flex justify-center">
                  <div className="absolute -top-6 hidden group-hover:block bg-sidebar text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                    {h.requests}
                  </div>
                  <div
                    className="w-full max-w-[20px] bg-accent rounded-t transition-all hover:bg-accent-hover"
                    style={{
                      height: `${Math.max(h.requests > 0 ? 4 : 0, (pct / 100) * 140)}px`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 mt-2">
          {hourly.map((h, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[9px] text-text-dim"
            >
              {i % 3 === 0 ? h.hour.replace(':00', '') : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-white font-semibold">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sidebar">
              <tr className="text-text-dim text-left text-xs">
                <th className="px-6 py-2.5 w-28">Time</th>
                <th className="px-6 py-2.5">Model</th>
                <th className="px-6 py-2.5 w-28">Duration</th>
                <th className="px-6 py-2.5 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-text-dim italic"
                  >
                    {loading ? 'Loading...' : 'No recent activity'}
                  </td>
                </tr>
              ) : (
                activity.map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/50 hover:bg-sidebar/50"
                  >
                    <td className="px-6 py-2.5 font-mono text-text-dim">
                      {row.time}
                    </td>
                    <td className="px-6 py-2.5 text-white">{row.model}</td>
                    <td className="px-6 py-2.5 font-mono text-text-dim">
                      {row.duration_ms != null ? `${row.duration_ms}ms` : '—'}
                    </td>
                    <td className="px-6 py-2.5">
                      {row.status === 'error' ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400">
                          Error
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/15 text-green-400">
                          Success
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
