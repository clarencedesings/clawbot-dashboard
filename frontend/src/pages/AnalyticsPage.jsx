import { useEffect, useState, useCallback, useRef } from 'react'
import { BarChart3, Eye, Users, Globe, Loader2, RefreshCw } from 'lucide-react'

const DOMAINS = ['earthliedesigns.com', 'phyllisdiannestudio.com']
const DOMAIN_LABELS = {
  'earthliedesigns.com': 'Earthlie Designs',
  'phyllisdiannestudio.com': 'Phyllis DiAnne Studio',
}
const DOMAIN_COLORS = {
  'earthliedesigns.com': '#e87722',
  'phyllisdiannestudio.com': '#7c3aed',
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <span className="text-text-dim text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  )
}

function MiniBar({ value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="w-full bg-border rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }}
      />
    </div>
  )
}

function DayChart({ days, label, color }) {
  const maxPV = Math.max(...days.map((d) => d.pageViews), 1)

  return (
    <div>
      <h4 className="text-sm font-medium text-text-dim mb-3">{label}</h4>
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {days.map((d) => {
          const h = Math.max((d.pageViews / maxPV) * 100, 4)
          const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
          })
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-text-dim">{d.pageViews}</span>
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${h}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                  minHeight: 4,
                }}
              />
              <span className="text-[10px] text-text-dim">{dayLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SitePanel({ domain, data }) {
  const label = DOMAIN_LABELS[domain]
  const color = DOMAIN_COLORS[domain]

  if (data.error) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-2">{label}</h3>
        <p className="text-red-400 text-sm">Error: {data.error}</p>
      </div>
    )
  }

  const { totals = {}, days = [], topCountries = [] } = data

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-lg font-bold text-white">{label}</h3>
        <span className="text-text-dim text-xs ml-auto">{domain}</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Eye} label="Page Views" value={totals.pageViews || 0} color="text-blue-400" />
        <StatCard icon={Users} label="Unique Visitors" value={totals.uniques || 0} color="text-green-400" />
        <StatCard icon={BarChart3} label="Total Requests" value={totals.requests || 0} color="text-yellow-400" />
      </div>

      {/* Daily chart */}
      {days.length > 0 && <DayChart days={days} label="Page Views (Last 7 Days)" color={color} />}

      {/* Top countries */}
      {topCountries.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-text-dim mb-3 flex items-center gap-2">
            <Globe size={14} /> Top Countries
          </h4>
          <div className="space-y-2">
            {topCountries.map((c) => (
              <div key={c.country} className="flex items-center gap-3 text-sm">
                <span className="text-white w-8 shrink-0">{c.country}</span>
                <div className="flex-1">
                  <MiniBar value={c.requests} max={topCountries[0].requests} />
                </div>
                <span className="text-text-dim text-xs w-16 text-right">
                  {c.requests.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error)
        } else {
          setData(d)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 300000) // refresh every 5 min
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Cloudflare Analytics</h2>
          <p className="text-text-dim text-sm mt-1">
            Traffic overview for the last 7 days
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-card border border-border text-text-dim hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-text-dim" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {DOMAINS.map((domain) => (
            <SitePanel key={domain} domain={domain} data={data[domain] || { error: 'No data' }} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
