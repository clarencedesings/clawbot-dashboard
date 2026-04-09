import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play,
  Clock,
  Zap,
  Image,
  FolderUp,
  ToggleLeft,
  ToggleRight,
  Terminal,
  CircleDot,
} from 'lucide-react'

const ROSE = '#d4948a'

const CATEGORIES = [
  { value: 'coloring_pages', label: 'Coloring Pages' },
  { value: 'journals', label: 'Journals' },
]

const GENERATE_OPTIONS = [
  { value: 'single', label: 'Single page' },
  { value: 'five_pack', label: '5-page bundle' },
  { value: 'ten_pack', label: '10-page bundle' },
  { value: 'all', label: 'All three' },
]

export default function PhyllisBotControl() {
  const [botStatus, setBotStatus] = useState({ state: 'idle', lastRun: null, mode: 'ideogram' })
  const [theme, setTheme] = useState('')
  const [category, setCategory] = useState('coloring_pages')
  const [generate, setGenerate] = useState('all')
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('02:00')
  const [mode, setMode] = useState(() => localStorage.getItem('phyllis-bot-mode') || 'ideogram')
  const logRef = useRef(null)
  const logPollRef = useRef(null)
  const statusPollRef = useRef(null)
  const seenLinesRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (logPollRef.current) { clearInterval(logPollRef.current); logPollRef.current = null }
    if (statusPollRef.current) { clearInterval(statusPollRef.current); statusPollRef.current = null }
  }, [])

  useEffect(() => {
    fetch('/api/phyllis/bot/status')
      .then(r => r.json())
      .then(data => {
        setBotStatus(data)
        if (data.state === 'running') setRunning(true)
      })
      .catch(() => {})

    fetch('/api/phyllis/bot/schedule')
      .then(r => r.json())
      .then(data => {
        if (data.enabled != null) setScheduleEnabled(data.enabled)
        if (data.time) setScheduleTime(data.time)
      })
      .catch(() => {})

    return () => stopPolling()
  }, [stopPolling])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${ts}] ${msg}`])
  }

  const startPolling = useCallback(() => {
    seenLinesRef.current = 0

    // Poll log every 3s
    logPollRef.current = setInterval(() => {
      fetch('/api/phyllis/bot/log')
        .then(r => r.json())
        .then(data => {
          const lines = data.lines || []
          if (lines.length > seenLinesRef.current) {
            const newLines = lines.slice(seenLinesRef.current)
            seenLinesRef.current = lines.length
            setLogs(prev => [...prev, ...newLines])
          }
        })
        .catch(() => {})
    }, 3000)

    // Poll status every 5s
    statusPollRef.current = setInterval(() => {
      fetch('/api/phyllis/bot/status')
        .then(r => r.json())
        .then(data => {
          setBotStatus(data)
          if (data.state !== 'running') {
            setRunning(false)
            stopPolling()
            addLog('Bot run complete.')
          }
        })
        .catch(() => {})
    }, 5000)
  }, [stopPolling])

  const handleRun = async () => {
    if (!theme.trim()) return
    setRunning(true)
    setLogs([])
    addLog(`Starting bot — theme: "${theme}", category: ${category}, generate: ${generate}`)
    addLog(`Mode: ${mode === 'ideogram' ? 'Ideogram API' : 'Canva Drop'}`)

    try {
      const resp = await fetch('/api/phyllis/bot/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: theme.trim(), category, generate, mode }),
      })
      const data = await resp.json()
      if (resp.ok) {
        addLog('Bot started on CLAWBOT — polling log...')
        startPolling()
      } else {
        addLog(`Error: ${data.detail || 'Unknown error'}`)
        setRunning(false)
      }
    } catch (err) {
      addLog(`Error: ${err.message}`)
      setRunning(false)
    }
  }

  const handleScheduleToggle = () => {
    const next = !scheduleEnabled
    setScheduleEnabled(next)
    fetch('/api/phyllis/bot/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next, time: scheduleTime }),
    }).catch(() => {})
  }

  const handleScheduleTimeChange = (e) => {
    setScheduleTime(e.target.value)
    if (scheduleEnabled) {
      fetch('/api/phyllis/bot/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, time: e.target.value }),
      }).catch(() => {})
    }
  }

  const getNextRun = () => {
    if (!scheduleEnabled) return 'Disabled'
    const [h, m] = scheduleTime.split(':').map(Number)
    const now = new Date()
    const next = new Date()
    next.setHours(h, m, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' at ' + scheduleTime
  }

  const stateLabel = running ? 'Running' : botStatus.state === 'running' ? 'Running' : 'Idle'
  const stateColor = stateLabel === 'Running' ? 'bg-online pulse-online' : 'bg-text-dim'

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Bot Control</h2>
        <p className="text-text-dim text-sm mt-1">Phyllis image bot pipeline management</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Bot Status Card */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className={`w-2.5 h-2.5 rounded-full ${stateColor}`} />
            <h3 className="text-white font-semibold">Bot Status</h3>
            <span className="ml-auto text-xs px-2 py-1 rounded-full capitalize"
              style={{ background: `${ROSE}22`, color: ROSE }}>
              {stateLabel}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-dim">Mode</span>
              <span className="text-white flex items-center gap-1.5">
                {mode === 'ideogram' ? <Zap size={12} /> : <FolderUp size={12} />}
                {mode === 'ideogram' ? 'Ideogram Mode' : 'Canva Drop Mode'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Last Run</span>
              <span className="text-white">{botStatus.lastRun ? new Date(botStatus.lastRun).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Ideogram Credits</span>
              <span className="text-white">~$18.72 remaining</span>
            </div>
          </div>
        </div>

        {/* Schedule Settings */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={18} className="text-text-dim" />
            <h3 className="text-white font-semibold">Schedule</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-dim">Daily auto-run</span>
              <button onClick={handleScheduleToggle} className="cursor-pointer">
                {scheduleEnabled
                  ? <ToggleRight size={28} style={{ color: ROSE }} />
                  : <ToggleLeft size={28} className="text-text-dim" />
                }
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-dim">Run time</span>
              <input
                type="time"
                value={scheduleTime}
                onChange={handleScheduleTimeChange}
                className="bg-sidebar border border-border rounded-lg px-2 py-1 text-sm text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-dim">Next run</span>
              <span className="text-sm text-white">{getNextRun()}</span>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <CircleDot size={18} className="text-text-dim" />
            <h3 className="text-white font-semibold">Generation Mode</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setMode('ideogram'); localStorage.setItem('phyllis-bot-mode', 'ideogram') }}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                  mode === 'ideogram'
                    ? 'border-[#d4948a] text-[#d4948a]'
                    : 'border-border text-text-dim hover:border-[#d4948a]/50 hover:text-[#d4948a]'
                }`}
                style={mode === 'ideogram' ? { background: `${ROSE}15` } : {}}
              >
                <Zap size={20} />
                <span className="font-medium">Ideogram</span>
                <span className="text-[10px] opacity-70">AI generated</span>
              </button>
              <button
                onClick={() => { setMode('canva'); localStorage.setItem('phyllis-bot-mode', 'canva') }}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                  mode === 'canva'
                    ? 'border-[#d4948a] text-[#d4948a]'
                    : 'border-border text-text-dim hover:border-[#d4948a]/50 hover:text-[#d4948a]'
                }`}
                style={mode === 'canva' ? { background: `${ROSE}15` } : {}}
              >
                <FolderUp size={20} />
                <span className="font-medium">Canva Drop</span>
                <span className="text-[10px] opacity-70">Manual upload</span>
              </button>
            </div>
            <p className="text-xs text-text-dim">
              {mode === 'ideogram'
                ? 'Bot generates images via Ideogram API, then Claude writes product text.'
                : 'Upload Canva exports to the drop folder. Bot processes and queues them for review.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Run Bot Now */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Play size={18} style={{ color: ROSE }} />
          <h3 className="text-white font-semibold">Run Bot Now</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-text-dim mb-1 block">Theme</label>
            <input
              type="text"
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="e.g. ocean friends"
              className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-dim/50 focus:outline-none focus:border-[#d4948a]"
              disabled={running}
            />
          </div>
          <div>
            <label className="text-xs text-text-dim mb-1 block">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4948a] cursor-pointer"
              disabled={running}
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-dim mb-1 block">Generate</label>
            <select
              value={generate}
              onChange={e => setGenerate(e.target.value)}
              className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4948a] cursor-pointer"
              disabled={running}
            >
              {GENERATE_OPTIONS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRun}
              disabled={running || !theme.trim()}
              className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: ROSE }}
              onMouseEnter={e => { if (!e.target.disabled) e.target.style.background = '#c4847a' }}
              onMouseLeave={e => e.target.style.background = ROSE}
            >
              {running ? 'RUNNING...' : 'RUN BOT'}
            </button>
          </div>
        </div>

        {/* Log output */}
        {logs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Terminal size={14} className="text-text-dim" />
              <span className="text-xs text-text-dim">Output</span>
            </div>
            <div
              ref={logRef}
              className="bg-sidebar border border-border rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed"
            >
              {logs.map((line, i) => (
                <div key={i} className={line.includes('Error') ? 'text-red-400' : line.includes('Done') ? 'text-online' : 'text-text-dim'}>
                  {line}
                </div>
              ))}
              {running && (
                <div className="text-text-dim animate-pulse">▌</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Canva Drop info when in Canva mode */}
      {mode === 'canva' && (
        <div className="bg-card rounded-xl border border-border p-5" style={{ borderColor: `${ROSE}40` }}>
          <div className="flex items-center gap-3 mb-3">
            <FolderUp size={18} style={{ color: ROSE }} />
            <h3 className="text-white font-semibold">Canva Drop Mode Active</h3>
          </div>
          <p className="text-sm text-text-dim mb-3">
            Upload your Canva exports to the drop folder on CLAWBOT. The bot will process
            them into products and queue for review.
          </p>
          <div className="bg-sidebar rounded-lg p-3 font-mono text-xs text-text-dim">
            Drop folder: /home/clarence/phyllis-imagebot/canva-drop/
          </div>
        </div>
      )}
    </div>
  )
}
