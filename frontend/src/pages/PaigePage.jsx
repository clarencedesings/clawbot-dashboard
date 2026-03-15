import { useEffect, useState, useCallback, useRef } from 'react'
import {
  PenLine,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Sparkles,
  X,
  ExternalLink,
  Clipboard,
  Trash2,
} from 'lucide-react'

export default function PaigePage() {
  const [status, setStatus] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genTimer, setGenTimer] = useState(0)
  const [previewPost, setPreviewPost] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [toast, setToast] = useState(null)
  const [confirmReject, setConfirmReject] = useState(null)
  const [published, setPublished] = useState([])
  const [copiedPin, setCopiedPin] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const intervalRef = useRef(null)
  const genTimerRef = useRef(null)

  const fetchData = useCallback(() => {
    Promise.all([
      fetch('/api/paige/status').then((r) => r.json()),
      fetch('/api/paige/staged').then((r) => r.json()),
      fetch('/api/paige/processed').then((r) => r.json()),
    ])
      .then(([statusData, stagedData, processedData]) => {
        setStatus(statusData)
        setPosts(stagedData.posts || [])
        setPublished(processedData.posts || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 15000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleGenerate = () => {
    setGenerating(true)
    setGenTimer(60)
    fetch('/api/paige/generate', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) showToast('Paige is writing a new post...')
        else showToast(d.error || 'Failed to start', 'error')
      })
      .catch(() => showToast('Failed to reach server', 'error'))

    genTimerRef.current = setInterval(() => {
      setGenTimer((t) => {
        if (t <= 1) {
          clearInterval(genTimerRef.current)
          setGenerating(false)
          fetchData()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const handlePreview = (filename) => {
    setPreviewLoading(true)
    fetch(`/api/paige/staged/${encodeURIComponent(filename)}`)
      .then((r) => r.json())
      .then((data) => setPreviewPost(data))
      .catch(() => showToast('Failed to load post', 'error'))
      .finally(() => setPreviewLoading(false))
  }

  const handleApprove = (filename) => {
    setActionLoading((p) => ({ ...p, [filename]: 'approve' }))
    fetch(`/api/paige/approve/${encodeURIComponent(filename)}`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          showToast(d.message)
          fetchData()
        } else {
          showToast(d.error || 'Publish failed', 'error')
        }
      })
      .catch(() => showToast('Failed to reach server', 'error'))
      .finally(() => setActionLoading((p) => ({ ...p, [filename]: null })))
  }

  const handleReject = (filename) => {
    setActionLoading((p) => ({ ...p, [filename]: 'reject' }))
    setConfirmReject(null)
    fetch(`/api/paige/reject/${encodeURIComponent(filename)}`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          showToast(d.message)
          fetchData()
        } else {
          showToast(d.error || 'Reject failed', 'error')
        }
      })
      .catch(() => showToast('Failed to reach server', 'error'))
      .finally(() => setActionLoading((p) => ({ ...p, [filename]: null })))
  }

  const handleDelete = (type, filename) => {
    setConfirmDelete(null)
    const url = type === 'staged'
      ? `/api/paige/staged/${encodeURIComponent(filename)}`
      : `/api/paige/processed/${encodeURIComponent(filename)}`
    fetch(url, { method: 'DELETE' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          showToast(d.message || 'Deleted')
          fetchData()
        } else {
          showToast(d.error || 'Delete failed', 'error')
        }
      })
      .catch(() => showToast('Failed to reach server', 'error'))
  }

  const renderMarkdown = (content) => {
    if (!content) return ''
    // Strip frontmatter
    let body = content
    if (body.startsWith('---')) {
      const end = body.indexOf('---', 3)
      if (end !== -1) body = body.slice(end + 3).trim()
    }
    // Basic markdown → HTML
    return body
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-5 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/\n\n/g, '<br/><br/>')
  }

  const isOnline = status?.status === 'online'

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
            <PenLine size={28} className="text-[#d4948a]" />
            <h2 className="text-2xl font-bold text-white">Paige</h2>
          </div>
          <p className="text-text-dim text-sm mt-1">
            AI Blog Writer for Phyllis Dianne Studio
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full shrink-0 ${
              isOnline ? 'bg-online' : 'bg-offline'
            }`}
          />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Status
            </p>
            <p className={`text-lg font-bold ${isOnline ? 'text-online' : 'text-offline'}`}>
              {loading && !status ? '—' : isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <Clock size={20} className="text-yellow-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Pending
            </p>
            <p className="text-xl font-bold text-white">
              {status?.staged_count ?? '—'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Published
            </p>
            <p className="text-xl font-bold text-white">
              {status?.processed_count ?? '—'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <XCircle size={20} className="text-red-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Rejected
            </p>
            <p className="text-xl font-bold text-white">
              {status?.rejected_count ?? '—'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-center">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: generating ? '#8b6b66' : '#d4948a' }}
          >
            <Sparkles size={16} />
            {generating ? `Writing... ${genTimer}s` : 'Write New Post'}
          </button>
        </div>
      </div>

      {/* Pending posts */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white">
            Awaiting Approval
          </h3>
          {posts.length > 0 && (
            <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded font-bold">
              {posts.length}
            </span>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <FileText size={32} className="text-text-dim mx-auto mb-3 opacity-50" />
            <p className="text-text-dim text-sm italic">
              {loading ? 'Loading...' : 'No posts awaiting approval'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.filename}
                className="bg-card rounded-xl border border-border p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-semibold text-lg">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-1">
                      {post.date && (
                        <span className="text-text-dim text-xs">{post.date}</span>
                      )}
                      {post.description && (
                        <span className="text-text-dim text-xs truncate">
                          {post.description}
                        </span>
                      )}
                    </div>
                    <p className="text-text-dim text-sm mt-3 leading-relaxed line-clamp-4">
                      {post.preview?.slice(0, 300)}
                      {post.preview?.length > 300 ? '...' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handlePreview(post.filename)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleApprove(post.filename)}
                      disabled={!!actionLoading[post.filename]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading[post.filename] === 'approve'
                        ? 'Publishing...'
                        : 'Approve & Publish'}
                    </button>
                    <button
                      onClick={() => setConfirmReject(post.filename)}
                      disabled={!!actionLoading[post.filename]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading[post.filename] === 'reject'
                        ? 'Rejecting...'
                        : 'Reject'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: 'staged', filename: post.filename, title: post.title })}
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

      {/* Published posts */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white">Published</h3>
          {published.length > 0 && (
            <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded font-bold">
              {published.length}
            </span>
          )}
        </div>

        {published.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <CheckCircle size={32} className="text-text-dim mx-auto mb-3 opacity-50" />
            <p className="text-text-dim text-sm italic">
              {loading ? 'Loading...' : 'No published posts yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {published.map((post) => (
              <div
                key={post.filename}
                className="bg-card rounded-xl border border-border p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-semibold">{post.title}</h4>
                    {post.date && (
                      <span className="text-text-dim text-xs">{post.date}</span>
                    )}
                    {post.body_preview && (
                      <p className="text-text-dim text-sm mt-2 leading-relaxed line-clamp-2">
                        {post.body_preview}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a
                      href="https://phyllisdiannestudio.com/blog"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink size={12} />
                      View on Blog
                    </a>
                    <button
                      onClick={() => {
                        const text = `${post.title}\n\n${(post.body_preview || '').slice(0, 200).trim()}...\n\nhttps://phyllisdiannestudio.com/blog`
                        navigator.clipboard.writeText(text).then(() => {
                          setCopiedPin(post.filename)
                          showToast('Copied for Pinterest!')
                          setTimeout(() => setCopiedPin(null), 2000)
                        })
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                      style={{
                        backgroundColor: copiedPin === post.filename ? '#22c55e' : '#d4948a',
                        color: '#fff',
                      }}
                    >
                      <Clipboard size={12} />
                      {copiedPin === post.filename ? 'Copied!' : 'Copy for Pinterest'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: 'processed', filename: post.filename, title: post.title })}
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

      {/* Full post preview modal */}
      {previewPost && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {previewPost.title}
                </h3>
                <div className="flex gap-3 mt-0.5">
                  {previewPost.date && (
                    <span className="text-text-dim text-xs">{previewPost.date}</span>
                  )}
                  {previewPost.description && (
                    <span className="text-text-dim text-xs">{previewPost.description}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPreviewPost(null)}
                className="text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {previewLoading ? (
                <p className="text-text-dim text-sm">Loading...</p>
              ) : (
                <div
                  className="prose prose-invert text-text text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(previewPost.content),
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white font-semibold text-lg mb-2">
              Delete {confirmDelete.type === 'staged' ? 'Draft' : 'Published Post'}?
            </h3>
            <p className="text-text-dim text-sm mb-2">
              &quot;{confirmDelete.title}&quot;
            </p>
            <p className="text-text-dim text-sm mb-6">
              {confirmDelete.type === 'processed'
                ? 'This will remove the file from processed/ and delete the blog post from the database. This cannot be undone.'
                : 'This will permanently delete the draft. This cannot be undone.'}
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
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject confirmation modal */}
      {confirmReject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white font-semibold text-lg mb-2">
              Reject Post?
            </h3>
            <p className="text-text-dim text-sm mb-6">
              This will move the post to the rejected folder and notify Phyllis.
              This action cannot be undone from the dashboard.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmReject(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(confirmReject)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
