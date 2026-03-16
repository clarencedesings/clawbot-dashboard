import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Coffee,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
} from 'lucide-react'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KofiPage() {
  const [summary, setSummary] = useState(null)
  const [queue, setQueue] = useState([])
  const [processed, setProcessed] = useState([])
  const [loading, setLoading] = useState(false)
  const [kofiStats, setKofiStats] = useState(null)
  const intervalRef = useRef(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/kofi/summary').then((r) => r.json()),
      fetch('/api/kofi/queue').then((r) => r.json()),
      fetch('/api/kofi/processed').then((r) => r.json()),
    ])
      .then(([summaryData, queueData, processedData]) => {
        setSummary(summaryData)
        setQueue(queueData.files || [])
        setProcessed(processedData.files || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 30000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  useEffect(() => {
    fetch('/api/kofi/stats')
      .then(r => r.json())
      .then(d => setKofiStats(d))
      .catch(() => {})
  }, [])

  const pipelineStatus = summary?.pipeline_status || 'unknown'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Ko-fi Uploads</h2>
        <p className="text-text-dim text-sm mt-1">
          File upload pipeline status and history
        </p>
      </div>

      {/* Ko-fi Revenue & Orders */}
      {kofiStats && !kofiStats.error && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-text-dim text-xs uppercase tracking-wider mb-2">Ko-fi Revenue</p>
            <p className="text-2xl font-bold text-green-400">${kofiStats.total_revenue.toFixed(2)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-text-dim text-xs uppercase tracking-wider mb-2">Total Orders</p>
            <p className="text-2xl font-bold text-white">{kofiStats.total_orders}</p>
          </div>
        </div>
      )}

      {/* Recent Ko-fi Orders */}
      {kofiStats?.recent?.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-white font-semibold text-sm">Recent Ko-fi Orders</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-sidebar">
              <tr className="text-text-dim text-left text-xs">
                <th className="px-6 py-2.5">Date</th>
                <th className="px-6 py-2.5">Type</th>
                <th className="px-6 py-2.5">Amount</th>
              </tr>
            </thead>
            <tbody>
              {kofiStats.recent.map((t, i) => (
                <tr key={i} className="border-t border-border/50 hover:bg-sidebar/50">
                  <td className="px-6 py-2.5 text-text-dim">{t.timestamp ? new Date(t.timestamp).toLocaleDateString() : '—'}</td>
                  <td className="px-6 py-2.5 text-white">{t.type || '—'}</td>
                  <td className="px-6 py-2.5 text-green-400 font-semibold">${parseFloat(t.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <Upload size={20} className="text-yellow-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              In Queue
            </p>
            <p className="text-xl font-bold text-white">
              {summary?.queue_count ?? '—'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Processed
            </p>
            <p className="text-xl font-bold text-white">
              {summary?.processed_count ?? '—'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <XCircle size={20} className="text-red-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Failed
            </p>
            <p className="text-xl font-bold text-white">
              {summary?.failed_count ?? '—'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          {pipelineStatus === 'active' ? (
            <Clock size={20} className="text-accent" />
          ) : (
            <Coffee size={20} className="text-text-dim" />
          )}
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Pipeline
            </p>
            <p
              className={`text-xl font-bold capitalize ${
                pipelineStatus === 'active'
                  ? 'text-accent'
                  : pipelineStatus === 'idle'
                    ? 'text-text-dim'
                    : 'text-yellow-400'
              }`}
            >
              {loading && !summary ? '—' : pipelineStatus}
            </p>
          </div>
        </div>
      </div>

      {/* Last processed banner */}
      {summary?.last_processed && (
        <div className="bg-card rounded-xl border border-border p-4 mb-8 flex items-center gap-3">
          <FileText size={18} className="text-green-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Last Processed
            </p>
            <p className="text-white text-sm font-mono truncate">
              {summary.last_processed.filename}
            </p>
            <p className="text-text-dim text-xs mt-0.5">
              {summary.last_processed.timestamp}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Queue table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Upload size={16} className="text-yellow-400" />
            <h3 className="text-white font-semibold">Queue</h3>
            {queue.length > 0 && (
              <span className="ml-auto text-[10px] bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded font-bold">
                {queue.length}
              </span>
            )}
          </div>
          <div className="overflow-y-auto max-h-80">
            {queue.length === 0 ? (
              <div className="px-6 py-8 text-center text-text-dim italic text-sm">
                {loading ? 'Loading...' : 'Queue is empty'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-sidebar">
                  <tr className="text-text-dim text-left text-xs">
                    <th className="px-6 py-2.5">Filename</th>
                    <th className="px-6 py-2.5 w-24">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((file, i) => (
                    <tr
                      key={i}
                      className="border-t border-border/50 hover:bg-sidebar/50"
                    >
                      <td className="px-6 py-2.5 text-white font-mono text-xs truncate max-w-[200px]">
                        {file.filename}
                      </td>
                      <td className="px-6 py-2.5 text-text-dim text-xs">
                        {formatSize(file.size)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Processed table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" />
            <h3 className="text-white font-semibold">Recently Processed</h3>
          </div>
          <div className="overflow-y-auto max-h-80">
            {processed.length === 0 ? (
              <div className="px-6 py-8 text-center text-text-dim italic text-sm">
                {loading ? 'Loading...' : 'No processed files yet'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-sidebar">
                  <tr className="text-text-dim text-left text-xs">
                    <th className="px-6 py-2.5">Filename</th>
                    <th className="px-6 py-2.5 w-24">Size</th>
                    <th className="px-6 py-2.5 w-32">Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((file, i) => (
                    <tr
                      key={i}
                      className="border-t border-border/50 hover:bg-sidebar/50"
                    >
                      <td className="px-6 py-2.5 text-white font-mono text-xs truncate max-w-[180px]">
                        {file.filename}
                      </td>
                      <td className="px-6 py-2.5 text-text-dim text-xs">
                        {formatSize(file.size)}
                      </td>
                      <td className="px-6 py-2.5 text-text-dim text-xs">
                        {file.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline log */}
      {summary?.pipeline_log && (
        <div className="mt-6 bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <AlertCircle size={16} className="text-text-dim" />
            <h3 className="text-white font-semibold">Pipeline Log</h3>
          </div>
          <pre className="p-6 text-xs text-text-dim font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {summary.pipeline_log}
          </pre>
        </div>
      )}
    </div>
  )
}
