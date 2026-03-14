import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR']
const SOURCES = ['All Sources', 'telegram', 'gateway', 'agent', 'heartbeat']

const LEVEL_COLORS = {
  INFO: 'text-blue-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  DEBUG: 'text-text-dim',
}

export default function LogsPage() {
  const [logs, setLogs] = useState([])
  const [level, setLevel] = useState('ALL')
  const [source, setSource] = useState('All Sources')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  const fetchLogs = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (level !== 'ALL') params.set('level', level)
    if (source !== 'All Sources') params.set('source', source)
    const qs = params.toString()
    fetch(`/api/logs${qs ? '?' + qs : ''}`)
      .then((r) => r.json())
      .then((data) => setLogs(data.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [level, source])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 10000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchLogs])

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">System Logs</h2>
        <p className="text-text-dim text-sm mt-1">
          Live feed from CLAWBOT gateway
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Level toggles */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                level === l
                  ? 'bg-accent text-white'
                  : 'bg-card text-text-dim hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Source dropdown */}
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-dim focus:outline-none focus:border-accent"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
            autoRefresh
              ? 'border-accent bg-accent/15 text-accent-hover'
              : 'border-border bg-card text-text-dim'
          }`}
        >
          Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
        </button>

        {/* Manual refresh */}
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-text-dim hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>

        <span className="text-xs text-text-dim ml-auto">
          {logs.length} entries
        </span>
      </div>

      {/* Log Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 bg-sidebar">
              <tr className="text-text-dim text-left">
                <th className="px-4 py-2.5 w-40">Timestamp</th>
                <th className="px-4 py-2.5 w-16">Level</th>
                <th className="px-4 py-2.5 w-24">Source</th>
                <th className="px-4 py-2.5">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-text-dim italic"
                  >
                    {loading ? 'Loading logs...' : 'No log entries found'}
                  </td>
                </tr>
              ) : (
                logs.map((entry, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/50 hover:bg-sidebar/50"
                  >
                    <td className="px-4 py-2 text-text-dim whitespace-nowrap">
                      {entry.timestamp || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`font-semibold ${LEVEL_COLORS[entry.level] || 'text-text-dim'}`}
                      >
                        {entry.level}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-text-dim">{entry.source}</td>
                    <td className="px-4 py-2 text-white break-all">
                      {entry.message}
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
