import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  X,
  Calendar,
  Trash2,
} from 'lucide-react'

const AGENTS = [
  { id: 'main', label: 'Jarvis (Main)' },
  { id: 'business', label: 'Business' },
  { id: 'research', label: 'Research' },
  { id: 'coder', label: 'Coder' },
  { id: 'paige', label: 'Paige (Blog Writer)' },
]

export default function TasksPage() {
  const [message, setMessage] = useState('')
  const [agent, setAgent] = useState('main')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState([])
  const [scheduled, setScheduled] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [cronExpr, setCronExpr] = useState('')
  const [cronMsg, setCronMsg] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(null)
  const intervalRef = useRef(null)

  const fetchHistory = useCallback(() => {
    fetch('/api/tasks/history')
      .then((r) => r.json())
      .then((data) => setHistory(data.history || []))
      .catch(() => {})
  }, [])

  const fetchScheduled = useCallback(() => {
    fetch('/api/tasks/scheduled')
      .then((r) => r.json())
      .then((data) => setScheduled(data.tasks || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchHistory()
    fetchScheduled()
    intervalRef.current = setInterval(() => {
      fetchHistory()
      fetchScheduled()
    }, 30000)
    return () => clearInterval(intervalRef.current)
  }, [fetchHistory, fetchScheduled])

  const handleSend = () => {
    if (!message.trim() || sending) return
    setSending(true)
    fetch('/api/tasks/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim(), agent }),
    })
      .then((r) => r.json())
      .then(() => {
        setMessage('')
        fetchHistory()
      })
      .catch(() => {})
      .finally(() => setSending(false))
  }

  const handleSchedule = () => {
    if (!cronExpr.trim() || !cronMsg.trim() || scheduling) return
    setScheduling(true)
    fetch('/api/tasks/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: cronExpr.trim(), message: cronMsg.trim() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCronExpr('')
          setCronMsg('')
          setShowModal(false)
          fetchScheduled()
        }
      })
      .catch(() => {})
      .finally(() => setScheduling(false))
  }

  const handleDeleteScheduled = (taskId) => {
    fetch(`/api/tasks/scheduled/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
    })
      .then(() => fetchScheduled())
      .catch(() => {})
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSend()
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Tasks & Commands</h2>
        <p className="text-text-dim text-sm mt-1">
          Send commands to agents and manage scheduled tasks
        </p>
      </div>

      {/* Quick Command Panel */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <h3 className="text-white font-semibold mb-4">Quick Command</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a command to Jarvis..."
          rows={3}
          className="w-full bg-sidebar border border-border rounded-lg px-4 py-3 text-white text-sm placeholder-text-dim resize-none focus:outline-none focus:border-accent"
        />
        <div className="flex items-center gap-3 mt-3">
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="bg-sidebar border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent cursor-pointer"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            <Send size={14} />
            {sending
              ? 'Sending...'
              : agent === 'main' || agent === 'paige'
                ? 'Send Command'
                : 'Send & Queue Review'}
          </button>
          <span className="text-text-dim text-xs ml-auto">Ctrl+Enter to send</span>
        </div>
      </div>

      {/* Recent Commands History */}
      <div className="bg-card rounded-xl border border-border overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-white font-semibold">Recent Commands</h3>
        </div>
        <div className="overflow-y-auto max-h-72">
          {history.length === 0 ? (
            <div className="px-6 py-8 text-center text-text-dim italic text-sm">
              No commands sent yet
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {history.slice(0, 5).map((item, i) => (
                <div key={i} className="px-6 py-3 flex items-start gap-3">
                  {item.status === 'sent' || item.status === 'approved' ? (
                    <CheckCircle size={16} className="text-green-400 shrink-0 mt-0.5" />
                  ) : item.status === 'queued' || item.status === 'pending_review' ? (
                    <Clock size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm line-clamp-2">{item.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-dim">
                      <span className="capitalize">{item.agent || 'main'}</span>
                      <span>{item.sent_at}</span>
                      {item.status === 'sent' ? (
                        <span className="text-green-400">Sent</span>
                      ) : item.status === 'approved' ? (
                        <span className="text-green-400">Approved</span>
                      ) : item.status === 'pending_review' ? (
                        <span className="text-yellow-400">Pending Review</span>
                      ) : item.status === 'queued' ? (
                        <span className="text-yellow-400">Queued</span>
                      ) : item.status === 'denied' ? (
                        <span className="text-red-400">Denied</span>
                      ) : (
                        <span className="text-red-400">Failed</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmDeleteHistory(i)}
                    className="text-text-dim hover:text-red-400 transition-colors cursor-pointer shrink-0 mt-0.5"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scheduled Tasks */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-accent" />
            <h3 className="text-white font-semibold">Scheduled Tasks</h3>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={12} />
            Add Schedule
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sidebar">
              <tr className="text-text-dim text-left text-xs">
                <th className="px-6 py-2.5">Schedule</th>
                <th className="px-6 py-2.5">Message / Task</th>
                <th className="px-6 py-2.5 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduled.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-text-dim italic">
                    No scheduled tasks
                  </td>
                </tr>
              ) : (
                scheduled.map((task, i) => (
                  <tr key={task.id || i} className="border-t border-border/50 hover:bg-sidebar/50">
                    <td className="px-6 py-2.5 font-mono text-accent text-xs">
                      {task.schedule}
                    </td>
                    <td className="px-6 py-2.5 text-white">{task.message}</td>
                    <td className="px-6 py-2.5">
                      {task.id && (
                        <button
                          onClick={() => handleDeleteScheduled(task.id)}
                          className="text-text-dim hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete History Confirm */}
      {confirmDeleteHistory !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-white font-semibold text-lg mb-2">Delete Command?</h3>
            <p className="text-text-dim text-sm mb-6">
              Remove this command from the recent history?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteHistory(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setHistory((prev) => prev.filter((_, idx) => idx !== confirmDeleteHistory))
                  setConfirmDeleteHistory(null)
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Add Scheduled Task</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-text-dim text-xs uppercase tracking-wider mb-1.5">
                  Cron Expression
                </label>
                <input
                  type="text"
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  placeholder="0 9 * * *"
                  className="w-full bg-sidebar border border-border rounded-lg px-4 py-2.5 text-white text-sm font-mono placeholder-text-dim focus:outline-none focus:border-accent"
                />
                <p className="text-text-dim text-[10px] mt-1">
                  minute hour day month weekday (e.g. &quot;0 9 * * *&quot; = daily at 9am)
                </p>
              </div>
              <div>
                <label className="block text-text-dim text-xs uppercase tracking-wider mb-1.5">
                  Message / Command
                </label>
                <textarea
                  value={cronMsg}
                  onChange={(e) => setCronMsg(e.target.value)}
                  placeholder="Check server status and report"
                  rows={3}
                  className="w-full bg-sidebar border border-border rounded-lg px-4 py-3 text-white text-sm placeholder-text-dim resize-none focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-text-dim hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={!cronExpr.trim() || !cronMsg.trim() || scheduling}
                  className="bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {scheduling ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
