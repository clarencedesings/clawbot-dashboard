import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Send,
  Save,
  RefreshCw,
  Download,
  FileText,
  Trash2,
} from 'lucide-react'

export default function ApprovalPage() {
  const [pending, setPending] = useState([])
  const [history, setHistory] = useState({ approved: [], denied: [] })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [toast, setToast] = useState(null)
  const [confirmDeny, setConfirmDeny] = useState(null)
  const [denyReason, setDenyReason] = useState('')
  const [approveModal, setApproveModal] = useState(null)
  const [expandedResponse, setExpandedResponse] = useState({})
  const [savedResponses, setSavedResponses] = useState([])
  const [expandedSaved, setExpandedSaved] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null) // { type, filename, label }
  const intervalRef = useRef(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = useCallback(() => {
    Promise.all([
      fetch('/api/tasks/pending').then((r) => r.json()),
      fetch('/api/tasks/queue-history').then((r) => r.json()),
      fetch('/api/tasks/saved-responses').then((r) => r.json()),
    ])
      .then(([pendingData, historyData, savedData]) => {
        setPending(pendingData.tasks || [])
        setHistory({
          approved: historyData.approved || [],
          denied: historyData.denied || [],
        })
        setSavedResponses(savedData.responses || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 10000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const handleApprove = (filename, destination) => {
    setApproveModal(null)
    setActionLoading((p) => ({ ...p, [filename]: 'approve' }))
    fetch(`/api/tasks/approve/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination }),
    })
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

  const toggleResponse = (filename) => {
    setExpandedResponse((p) => ({ ...p, [filename]: !p[filename] }))
  }

  const handleDelete = (type, filename) => {
    const urlMap = {
      pending: `/api/tasks/pending/${encodeURIComponent(filename)}`,
      history: `/api/tasks/history/${encodeURIComponent(filename)}`,
      saved: `/api/tasks/saved-responses/${encodeURIComponent(filename)}`,
    }
    setConfirmDelete(null)
    fetch(urlMap[type], { method: 'DELETE' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          showToast('Deleted')
          fetchData()
        } else {
          showToast(d.error || 'Delete failed', 'error')
        }
      })
      .catch(() => showToast('Failed to reach server', 'error'))
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
            Review agent responses and approve delivery
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <Clock size={20} className="text-yellow-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Pending Review
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
            Pending Review
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
              {loading ? 'Loading...' : 'No tasks awaiting review'}
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
                      {task.is_redo && (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-medium flex items-center gap-1">
                          <RefreshCw size={10} />
                          Redo
                        </span>
                      )}
                      <span className="text-text-dim text-xs">
                        {formatTime(task.timestamp)}
                      </span>
                    </div>

                    {/* Original task */}
                    <div className="mb-3">
                      <p className="text-text-dim text-xs uppercase tracking-wider mb-1">Task</p>
                      <p className="text-white text-sm leading-relaxed">
                        {task.task}
                      </p>
                    </div>

                    {/* Agent response */}
                    <div>
                      <p className="text-text-dim text-xs uppercase tracking-wider mb-1">Agent Response</p>
                      <div className="bg-sidebar rounded-lg p-3 border border-border/50">
                        <p className={`text-white text-sm leading-relaxed whitespace-pre-wrap ${
                          !expandedResponse[task.filename] ? 'line-clamp-6' : ''
                        }`}>
                          {task.response || 'No response received'}
                        </p>
                        {task.response && task.response.length > 300 && (
                          <button
                            onClick={() => toggleResponse(task.filename)}
                            className="text-accent text-xs mt-2 hover:underline cursor-pointer"
                          >
                            {expandedResponse[task.filename] ? 'Show less' : 'Show full response'}
                          </button>
                        )}
                      </div>
                    </div>

                    {task.deny_reason && (
                      <div className="mt-2">
                        <p className="text-yellow-400 text-xs italic">
                          Previous feedback: {task.deny_reason}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setApproveModal(task.filename)}
                      disabled={!!actionLoading[task.filename]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading[task.filename] === 'approve'
                        ? 'Sending...'
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
                        ? 'Resending...'
                        : 'Deny & Redo'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: 'pending', filename: task.filename, label: task.task?.slice(0, 50) || task.filename })}
                      className="px-2 py-1.5 rounded-lg text-text-dim hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={14} />
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
                        <p className="text-white text-sm line-clamp-2">{task.task}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-dim">
                          <span className="capitalize">{task.agent}</span>
                          <span>{formatTime(task.approved_at || task.denied_at)}</span>
                          {task.status === 'approved' ? (
                            <span className="text-green-400">
                              Approved → {task.destination === 'file' ? 'File' : 'Telegram'}
                            </span>
                          ) : (
                            <span className="text-red-400">Denied & Resent</span>
                          )}
                          {task.reason && (
                            <span className="italic truncate">— {task.reason}</span>
                          )}
                        </div>
                      </div>
                      {task.filename && (
                        <button
                          onClick={() => setConfirmDelete({ type: 'history', filename: task.filename, label: task.task?.slice(0, 50) || task.filename })}
                          className="text-text-dim hover:text-red-400 transition-colors cursor-pointer shrink-0"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Responses */}
      {savedResponses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-white">Saved Responses</h3>
            <span className="text-[10px] bg-accent/15 text-accent-hover px-2 py-0.5 rounded font-bold">
              {savedResponses.length}
            </span>
          </div>
          <div className="space-y-4">
            {savedResponses.map((item) => (
              <div
                key={item.filename}
                className="bg-card rounded-xl border border-border p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-accent/15 text-accent-hover capitalize font-medium">
                        {item.agent}
                      </span>
                      <span className="text-text-dim text-xs">
                        {formatTime(item.approved_at || item.timestamp)}
                      </span>
                    </div>
                    <div className="mb-3">
                      <p className="text-text-dim text-xs uppercase tracking-wider mb-1">Task</p>
                      <p className="text-white text-sm">{item.task}</p>
                    </div>
                    <div>
                      <p className="text-text-dim text-xs uppercase tracking-wider mb-1">Response</p>
                      <div className="bg-sidebar rounded-lg p-3 border border-border/50">
                        <p className={`text-white text-sm leading-relaxed whitespace-pre-wrap ${
                          !expandedSaved[item.filename] ? 'line-clamp-6' : ''
                        }`}>
                          {item.response}
                        </p>
                        {item.response && item.response.length > 300 && (
                          <button
                            onClick={() => setExpandedSaved((p) => ({ ...p, [item.filename]: !p[item.filename] }))}
                            className="text-accent text-xs mt-2 hover:underline cursor-pointer"
                          >
                            {expandedSaved[item.filename] ? 'Show less' : 'Show full response'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={`/api/tasks/saved-responses/${encodeURIComponent(item.filename)}`}
                      download
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/15 text-accent-hover hover:bg-accent/25 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Download size={12} />
                      Download
                    </a>
                    <button
                      onClick={() => setConfirmDelete({ type: 'saved', filename: item.filename, label: item.task?.slice(0, 50) || item.filename })}
                      className="px-2 py-1.5 rounded-lg text-text-dim hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approve destination modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Send Where?</h3>
              <button
                onClick={() => setApproveModal(null)}
                className="text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-text-dim text-sm mb-5">
              Choose where to deliver the approved response.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(approveModal, 'telegram')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                <Send size={16} />
                Telegram
              </button>
              <button
                onClick={() => handleApprove(approveModal, 'file')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors cursor-pointer"
              >
                <Save size={16} />
                Save to File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-white font-semibold text-lg mb-2">Delete?</h3>
            <p className="text-text-dim text-sm mb-5">
              Delete &quot;{confirmDelete.label}...&quot;? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.type, confirmDelete.filename)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deny confirmation modal */}
      {confirmDeny && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Deny & Redo</h3>
              <button
                onClick={() => setConfirmDeny(null)}
                className="text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-text-dim text-sm mb-4">
              The task will be sent back to the agent with your feedback. The new response will appear here for review.
            </p>
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="What should the agent do differently?"
              rows={3}
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
                Deny & Resend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
