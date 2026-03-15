import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  X,
} from 'lucide-react'

export default function ApprovalPage() {
  const [pending, setPending] = useState([])
  const [history, setHistory] = useState({ approved: [], denied: [] })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [toast, setToast] = useState(null)
  const [confirmDeny, setConfirmDeny] = useState(null)
  const [denyReason, setDenyReason] = useState('')
  const intervalRef = useRef(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = useCallback(() => {
    Promise.all([
      fetch('/api/tasks/pending').then((r) => r.json()),
      fetch('/api/tasks/queue-history').then((r) => r.json()),
    ])
      .then(([pendingData, historyData]) => {
        setPending(pendingData.tasks || [])
        setHistory({
          approved: historyData.approved || [],
          denied: historyData.denied || [],
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 10000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const handleApprove = (filename) => {
    setActionLoading((p) => ({ ...p, [filename]: 'approve' }))
    fetch(`/api/tasks/approve/${encodeURIComponent(filename)}`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          showToast(d.message)
          fetchData()
        } else {
          showToast(d.error || 'Approve failed', 'error')
        }
      })
      .catch(() => showToast('Failed to reach server', 'error'))
      .finally(() => setActionLoading((p) => ({ ...p, [filename]: null })))
  }

  const handleDeny = (filename) => {
    setActionLoading((p) => ({ ...p, [filename]: 'deny' }))
    setConfirmDeny(null)
    fetch(`/api/tasks/deny/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: denyReason }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          showToast(d.message)
          setDenyReason('')
          fetchData()
        } else {
          showToast(d.error || 'Deny failed', 'error')
        }
      })
      .catch(() => showToast('Failed to reach server', 'error'))
      .finally(() => setActionLoading((p) => ({ ...p, [filename]: null })))
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    try {
      const d = new Date(ts + 'Z')
      return d.toLocaleString()
    } catch {
      return ts
    }
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'error'
              ? 'bg-red-500/90 text-white'
              : 'bg-green-500/90 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-[#d4948a]" />
            <h2 className="text-2xl font-bold text-white">Task Approval</h2>
          </div>
          <p className="text-text-dim text-sm mt-1">
            Review and approve agent tasks before execution
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <Clock size={20} className="text-yellow-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Pending
            </p>
            <p className="text-xl font-bold text-white">
              {loading ? '—' : pending.length}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Approved
            </p>
            <p className="text-xl font-bold text-white">
              {loading ? '—' : history.approved.length}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <XCircle size={20} className="text-red-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Denied
            </p>
            <p className="text-xl font-bold text-white">
              {loading ? '—' : history.denied.length}
            </p>
          </div>
        </div>
      </div>

      {/* Pending Tasks */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white">
            Pending Approval
          </h3>
          {pending.length > 0 && (
            <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded font-bold">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <ShieldCheck size={32} className="text-text-dim mx-auto mb-3 opacity-50" />
            <p className="text-text-dim text-sm italic">
              {loading ? 'Loading...' : 'No tasks awaiting approval'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((task) => (
              <div
                key={task.filename}
                className="bg-card rounded-xl border border-border p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-accent/15 text-accent-hover capitalize font-medium">
                        {task.agent}
                      </span>
                      <span className="text-text-dim text-xs">
                        {formatTime(task.queued_at)}
                      </span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">
                      {task.message}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(task.filename)}
                      disabled={!!actionLoading[task.filename]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading[task.filename] === 'approve'
                        ? 'Executing...'
                        : 'Approve'}
                    </button>
                    <button
                      onClick={() => {
                        setDenyReason('')
                        setConfirmDeny(task.filename)
                      }}
                      disabled={!!actionLoading[task.filename]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading[task.filename] === 'deny'
                        ? 'Denying...'
                        : 'Deny'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {(history.approved.length > 0 || history.denied.length > 0) && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">History</h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-y-auto max-h-96">
              <div className="divide-y divide-border/50">
                {[...history.approved, ...history.denied]
                  .sort((a, b) => {
                    const ta = a.approved_at || a.denied_at || ''
                    const tb = b.approved_at || b.denied_at || ''
                    return tb.localeCompare(ta)
                  })
                  .map((task, i) => (
                    <div key={task.filename || i} className="px-6 py-3 flex items-start gap-3">
                      {task.status === 'approved' ? (
                        <CheckCircle size={16} className="text-green-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm line-clamp-2">{task.message}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-dim">
                          <span className="capitalize">{task.agent}</span>
                          <span>{formatTime(task.approved_at || task.denied_at)}</span>
                          {task.status === 'approved' ? (
                            <span className="text-green-400">Approved</span>
                          ) : (
                            <span className="text-red-400">Denied</span>
                          )}
                          {task.reason && (
                            <span className="italic truncate">— {task.reason}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deny confirmation modal */}
      {confirmDeny && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Deny Task?</h3>
              <button
                onClick={() => setConfirmDeny(null)}
                className="text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-text-dim text-sm mb-4">
              This task will be moved to the denied folder and will not be executed.
            </p>
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Reason for denial (optional)"
              rows={2}
              className="w-full bg-sidebar border border-border rounded-lg px-4 py-3 text-white text-sm placeholder-text-dim resize-none focus:outline-none focus:border-accent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeny(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeny(confirmDeny)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              >
                Yes, Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
