import { useEffect, useState, useCallback, useRef } from 'react'
import { Cpu, MemoryStick, HardDrive, Activity, Server, Thermometer } from 'lucide-react'

const ALLOWED_ACTIONS_MAP = {
  restart_phyllis_backend: true,
  restart_phyllis_frontend: true,
  restart_nginx: 'restart_phyllis_frontend',
  restart_paige_webhook: true,
  restart_openclaw_gateway: true,
  restart_ollama: true,
  restart_mongodb: true,
  restart_mongod: 'restart_mongodb',
  restart_cloudflared: true,
  restart_earthlie_backend: true,
  restart_earthlie_frontend: true,
}

const SERVICE_LABELS = {
  nginx: 'phyllis-frontend (nginx)',
}

const CONFIRM_ACTIONS = {
  restart_mongodb: 'Restarting MongoDB will briefly disconnect ALL running apps (Earthlie, Phyllis, CLAWBOT). Continue?',
  restart_mongod: 'Restarting MongoDB will briefly disconnect ALL running apps (Earthlie, Phyllis, CLAWBOT). Continue?',
}


export default function SystemPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionOutput, setActionOutput] = useState(null)
  const [actionRunning, setActionRunning] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const intervalRef = useRef(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/system')
      .then((r) => r.json())
      .then((d) => {
        console.log('System data received:', JSON.stringify(d, null, 2))
        setData(d)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 10000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const runAction = async (key) => {
    // Resolve alias (e.g. restart_mongod -> restart_mongodb)
    const mapped = ALLOWED_ACTIONS_MAP[key]
    const actionKey = typeof mapped === 'string' ? mapped : key
    setActionRunning(key)
    setActionOutput(null)
    try {
      const res = await fetch('/api/system/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionKey }),
      })
      const d = await res.json()
      setActionOutput(d.output || d.error || 'No output')
    } catch {
      setActionOutput('Request failed')
    }
    setActionRunning(null)
  }

  const handleRestart = (key) => {
    if (CONFIRM_ACTIONS[key]) {
      setConfirmAction(key)
    } else {
      runAction(key)
    }
  }

  const cpuVal = parseFloat(data?.cpu_percent) || 0
  const ramUsed = parseInt(data?.ram?.used_mb) || 0
  const ramTotal = parseInt(data?.ram?.total_mb) || 1
  const ramPct = ((ramUsed / ramTotal) * 100).toFixed(1)
  const gpu = data?.gpu

  const barColor = (pct) =>
    pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">System</h2>
        <p className="text-text-dim text-sm mt-1">
          CLAWBOT server resource monitoring
        </p>
      </div>

      {/* Resource gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* CPU */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={16} className="text-accent" />
            <p className="text-text-dim text-xs uppercase tracking-wider">CPU</p>
          </div>
          <p className="text-2xl font-bold text-white mb-2">
            {loading && !data ? '—' : `${cpuVal.toFixed(1)}%`}
          </p>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor(cpuVal)}`}
              style={{ width: `${Math.min(cpuVal, 100)}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <MemoryStick size={16} className="text-blue-400" />
            <p className="text-text-dim text-xs uppercase tracking-wider">RAM</p>
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            {loading && !data ? '—' : `${ramPct}%`}
          </p>
          <p className="text-text-dim text-xs mb-2">
            {ramUsed} MB / {ramTotal} MB
          </p>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor(parseFloat(ramPct))}`}
              style={{ width: `${Math.min(parseFloat(ramPct), 100)}%` }}
            />
          </div>
        </div>

        {/* Disk */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={16} className="text-green-400" />
            <p className="text-text-dim text-xs uppercase tracking-wider">Disk</p>
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            {loading && !data ? '—' : data?.disk?.percent || '—'}
          </p>
          <p className="text-text-dim text-xs mb-2">
            {data?.disk?.used || '—'} / {data?.disk?.total || '—'}
          </p>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor(parseInt(data?.disk?.percent) || 0)}`}
              style={{ width: data?.disk?.percent || '0%' }}
            />
          </div>
        </div>

        {/* GPU */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer size={16} className="text-orange-400" />
            <p className="text-text-dim text-xs uppercase tracking-wider">GPU</p>
          </div>
          {gpu ? (
            <>
              <p className="text-2xl font-bold text-white mb-1">{gpu.utilization}%</p>
              <p className="text-text-dim text-xs mb-1">
                {gpu.name} — {gpu.mem_used} / {gpu.mem_total} MB
              </p>
              <p className="text-text-dim text-xs mb-2">{gpu.temperature}°C</p>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor(parseInt(gpu.utilization) || 0)}`}
                  style={{ width: `${gpu.utilization}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-text-dim text-sm italic">
              {loading && !data ? '—' : 'Unavailable'}
            </p>
          )}
        </div>
      </div>

      {/* Services with inline restart */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Server size={16} className="text-accent" />
          <h3 className="text-white font-semibold">Services</h3>
        </div>
        {data?.services ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(data.services).map(([svc, status]) => {
                const name = svc.replace('.service', '')
                const isActive = status === 'active'
                const restartKey = `restart_${name.replaceAll('-', '_')}`
                const canRestart = restartKey in ALLOWED_ACTIONS_MAP
                return (
                  <div
                    key={svc}
                    className={`flex items-center justify-between bg-sidebar rounded-lg px-4 py-3 border ${
                      isActive ? 'border-green-500/20' : 'border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isActive ? 'bg-green-500 pulse-online' : 'bg-red-500 pulse-offline'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-white font-mono truncate">
                          {SERVICE_LABELS[name] || name}
                        </p>
                        <p
                          className={`text-[10px] ${
                            isActive ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {status}
                        </p>
                      </div>
                    </div>
                    {canRestart && (
                      <button
                        onClick={() => handleRestart(restartKey)}
                        disabled={actionRunning === restartKey}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded bg-sidebar border border-border text-yellow-500 hover:border-yellow-500/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait shrink-0 ml-2"
                      >
                        {actionRunning === restartKey ? '...' : '\u21ba Restart'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {actionOutput && (
              <pre className="mt-3 bg-black/30 rounded-lg p-3 text-xs text-green-400 font-mono whitespace-pre-wrap border border-border">
                {actionOutput}
              </pre>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-sidebar rounded-lg px-4 py-3 h-12 animate-pulse"
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog for dangerous restarts */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white font-semibold text-lg mb-3">Confirm Restart</h3>
            <p className="text-text-dim text-sm mb-6">
              {CONFIRM_ACTIONS[confirmAction]}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const key = confirmAction
                  setConfirmAction(null)
                  runAction(key)
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              >
                Yes, Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Processes */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <h3 className="text-white font-semibold">Top Processes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sidebar">
              <tr className="text-text-dim text-left text-xs">
                <th className="px-6 py-2.5">User</th>
                <th className="px-6 py-2.5 w-20">CPU %</th>
                <th className="px-6 py-2.5 w-20">MEM %</th>
                <th className="px-6 py-2.5">Command</th>
              </tr>
            </thead>
            <tbody>
              {data?.top_processes?.length > 0 ? (
                data.top_processes.map((proc, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/50 hover:bg-sidebar/50"
                  >
                    <td className="px-6 py-2.5 font-mono text-text-dim">
                      {proc.user}
                    </td>
                    <td className="px-6 py-2.5 font-mono text-white">
                      {proc.cpu}
                    </td>
                    <td className="px-6 py-2.5 font-mono text-white">
                      {proc.mem}
                    </td>
                    <td className="px-6 py-2.5 font-mono text-text-dim truncate max-w-[300px]">
                      {proc.cmd}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-text-dim italic"
                  >
                    {loading ? 'Loading...' : 'No process data'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
