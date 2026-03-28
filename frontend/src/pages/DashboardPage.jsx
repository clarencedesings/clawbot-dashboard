import { useEffect, useState, useCallback, useRef } from 'react'
import { Send, CheckCircle, XCircle, HardDrive, Play, Square, RotateCw, Loader2, Server } from 'lucide-react'
import BotCard from '../components/BotCard'

const EARTHLIE_SERVICES = ['EarthlieBackend', 'EarthlieFrontend', 'MongoDB']

export default function DashboardPage() {
  const [bots, setBots] = useState([])
  const [health, setHealth] = useState(null)
  const [summary, setSummary] = useState(null)
  const [quickCmd, setQuickCmd] = useState('')
  const [sending, setSending] = useState(false)
  const [recentCmds, setRecentCmds] = useState([])
  const intervalRef = useRef(null)
  const [earthlieStatus, setEarthlieStatus] = useState({})
  const [earthlieLoading, setEarthlieLoading] = useState({})
  const earthlieIntervalRef = useRef(null)

  const fetchAll = useCallback(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => setBots(data.bots || []))
      .catch(() => setBots([]))

    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'unreachable' }))

    fetch('/api/dashboard/summary')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => setSummary(null))

    fetch('/api/tasks/history')
      .then((r) => r.json())
      .then((data) => setRecentCmds((data.history || []).slice(0, 3)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, 30000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAll])

  const fetchEarthlieStatus = useCallback(() => {
    fetch('/api/earthlie/services/status')
      .then((r) => r.json())
      .then((data) => setEarthlieStatus(data.services || {}))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchEarthlieStatus()
    earthlieIntervalRef.current = setInterval(fetchEarthlieStatus, 30000)
    return () => clearInterval(earthlieIntervalRef.current)
  }, [fetchEarthlieStatus])

  const handleServiceAction = (service, action) => {
    const key = `${service}-${action}`
    setEarthlieLoading((prev) => ({ ...prev, [key]: true }))
    fetch(`/api/earthlie/services/${service}/${action}`, { method: 'POST' })
      .then((r) => r.json())
      .then(() => {
        setTimeout(fetchEarthlieStatus, 2000)
      })
      .catch(() => {})
      .finally(() => setEarthlieLoading((prev) => ({ ...prev, [key]: false })))
  }

  const formatModel = (m) => {
    if (!m) return '—'
    const lower = m.toLowerCase()
    if (lower.includes('claude-sonnet')) return 'Claude Sonnet'
    if (lower.includes('claude-opus')) return 'Claude Opus'
    if (lower.includes('llama')) return 'Llama 3.1'
    return m.includes('/') ? m.split('/').pop() : m
  }

  const handleQuickSend = () => {
    if (!quickCmd.trim() || sending) return
    setSending(true)
    fetch('/api/tasks/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: quickCmd.trim(), agent: 'main' }),
    })
      .then((r) => r.json())
      .then(() => {
        setQuickCmd('')
        fetch('/api/tasks/history')
          .then((r) => r.json())
          .then((data) => setRecentCmds((data.history || []).slice(0, 3)))
          .catch(() => {})
      })
      .catch(() => {})
      .finally(() => setSending(false))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleQuickSend()
    }
  }

  const online = summary?.online_bots ?? bots.filter((b) => b.status === 'online').length
  const total = summary?.total_bots ?? bots.length
  const pendingTotal = (summary?.pending_posts ?? 0) + (summary?.pending_tasks ?? 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-text-dim text-sm mt-1">
            Clawbot system overview
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              health?.status === 'ok' ? 'bg-online' : 'bg-offline'
            }`}
          />
          <span className="text-text-dim">
            API: {health?.status || 'checking...'}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Bots Online
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {online}/{total}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Gateway
          </p>
          <p className={`text-2xl font-bold mt-1 ${summary?.gateway_online ? 'text-online' : 'text-offline'}`}>
            {summary?.gateway_online ? 'Online' : 'Offline'}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Sessions Today
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {summary?.sessions_today ?? '—'}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Pending Reviews
          </p>
          <p className={`text-2xl font-bold mt-1 ${pendingTotal > 0 ? 'text-yellow-400' : 'text-white'}`}>
            {pendingTotal}
          </p>
          {pendingTotal > 0 && (
            <p className="text-text-dim text-xs mt-1">
              {summary?.pending_posts > 0 ? `${summary.pending_posts} post${summary.pending_posts > 1 ? 's' : ''}` : ''}
              {summary?.pending_posts > 0 && summary?.pending_tasks > 0 ? ', ' : ''}
              {summary?.pending_tasks > 0 ? `${summary.pending_tasks} task${summary.pending_tasks > 1 ? 's' : ''}` : ''}
            </p>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Paige
          </p>
          <p className={`text-2xl font-bold mt-1 ${summary?.paige_status ? 'text-online' : 'text-offline'}`}>
            {summary?.paige_status ? 'Online' : 'Offline'}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Model
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatModel(summary?.model)}
          </p>
        </div>
      </div>

      {/* Bot Cards + Disk Usage */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Bots</h3>
        {summary?.disk_used && summary.disk_used !== '—' && (
          <div className="flex items-center gap-2 text-sm text-text-dim">
            <HardDrive size={14} />
            <span>Disk: {summary.disk_used} / {summary.disk_total}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>

      {/* Earthlie Services */}
      <div className="bg-card rounded-xl border border-border p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Server size={18} className="text-accent" />
          <h3 className="text-white font-semibold">Earthlie Services</h3>
        </div>
        <div className="space-y-3">
          {EARTHLIE_SERVICES.map((svc) => {
            const status = earthlieStatus[svc] || 'Unknown'
            const isRunning = status === 'Running'
            return (
              <div key={svc} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-online' : 'bg-offline'}`} />
                  <span className="text-white text-sm font-medium">{svc}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${isRunning ? 'bg-online/15 text-online' : 'bg-offline/15 text-offline'}`}>
                    {status}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleServiceAction(svc, 'start')}
                      disabled={!!earthlieLoading[`${svc}-start`]}
                      title="Start"
                      className="p-1.5 rounded-md bg-sidebar border border-border hover:border-online/50 text-text-dim hover:text-online transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {earthlieLoading[`${svc}-start`] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => handleServiceAction(svc, 'stop')}
                      disabled={!!earthlieLoading[`${svc}-stop`]}
                      title="Stop"
                      className="p-1.5 rounded-md bg-sidebar border border-border hover:border-offline/50 text-text-dim hover:text-offline transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {earthlieLoading[`${svc}-stop`] ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                    </button>
                    <button
                      onClick={() => handleServiceAction(svc, 'restart')}
                      disabled={!!earthlieLoading[`${svc}-restart`]}
                      title="Restart"
                      className="p-1.5 rounded-md bg-sidebar border border-border hover:border-accent/50 text-text-dim hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {earthlieLoading[`${svc}-restart`] ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Command */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-white font-semibold mb-3">Quick Command</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={quickCmd}
            onChange={(e) => setQuickCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a quick command to Jarvis..."
            className="flex-1 bg-sidebar border border-border rounded-lg px-4 py-2.5 text-white text-sm placeholder-text-dim focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleQuickSend}
            disabled={!quickCmd.trim() || sending}
            className="bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            <Send size={14} />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {recentCmds.length > 0 && (
          <div className="mt-3 space-y-2">
            {recentCmds.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {item.status === 'sent' ? (
                  <CheckCircle size={12} className="text-green-400 shrink-0" />
                ) : (
                  <XCircle size={12} className="text-red-400 shrink-0" />
                )}
                <span className="text-text-dim truncate flex-1">{item.message}</span>
                <span className="text-text-dim shrink-0">{item.sent_at}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
