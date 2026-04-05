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
  RotateCcw,
  RefreshCw,
  Terminal,
  Edit3,
  Volume2,
  VolumeX,
} from 'lucide-react'
import useSpeech from '../hooks/useSpeech'
import { useToast } from '../components/ToastProvider'

export default function PaigePage() {
  const [status, setStatus] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genTimer, setGenTimer] = useState(0)
  const [previewPost, setPreviewPost] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const showToast = useToast()
  const [confirmReject, setConfirmReject] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [published, setPublished] = useState([])
  const [copiedPin, setCopiedPin] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [resendModal, setResendModal] = useState(null)
  const [resendFeedback, setResendFeedback] = useState('')
  const [cronLog, setCronLog] = useState(null)
  const [cronLoading, setCronLoading] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [scheduledDates, setScheduledDates] = useState({})
  const [postCategories, setPostCategories] = useState({})
  const [postTags, setPostTags] = useState({})
  const [seoResults, setSeoResults] = useState({})
  const [seoLoading, setSeoLoading] = useState({})
  const [topic, setTopic] = useState('')
  const intervalRef = useRef(null)
  const genTimerRef = useRef(null)

  const { speak: speakRaw, stop: stopSpeaking, speakingId } = useSpeech()
  const stripMd = (text) =>
    (text || '')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*\[\]()]/g, '')
  const speak = (text, id) => speakRaw(stripMd(text), id)

  const fetchCronLog = useCallback(() => {
    setCronLoading(true)
    fetch('/api/paige/cron-log')
      .then((r) => r.json())
      .then(setCronLog)
      .catch(() => {})
      .finally(() => setCronLoading(false))
  }, [])

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
    fetchCronLog()
  }, [fetchCronLog])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 15000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])


  const handleGenerate = () => {
    setGenerating(true)
    setGenTimer(60)
    fetch('/api/paige/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim() || undefined }),
    })
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
    fetch(`/api/paige/approve/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_date: scheduledDates[filename] || '',
        category: postCategories[filename] || '',
        tags: (postTags[filename] || '').split(',').map((t) => t.trim()).filter(Boolean),
      }),
    })
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
    const reason = rejectReason.trim()
    setActionLoading((p) => ({ ...p, [filename]: 'reject' }))
    setConfirmReject(null)
    setRejectReason('')
    fetch(`/api/paige/reject/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
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

  const handleResend = (filename) => {
    setActionLoading((p) => ({ ...p, [filename]: 'resend' }))
    setResendModal(null)
    fetch(`/api/paige/resend/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: resendFeedback }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          showToast('Paige is rewriting this post...')
          setResendFeedback('')
          fetchData()
        } else {
          showToast(d.error || 'Resend failed', 'error')
        }
      })
      .catch(() => showToast('Failed to reach server', 'error'))
      .finally(() => setActionLoading((p) => ({ ...p, [filename]: null })))
  }

  const handleEditOpen = (filename) => {
    fetch(`/api/paige/staged/${encodeURIComponent(filename)}`)
      .then((r) => r.json())
      .then((data) => {
        let body = data.content || ''
        if (body.startsWith('---')) {
          const end = body.indexOf('---', 3)
          if (end !== -1) body = body.slice(end + 3).trim()
        }
        setEditTitle(data.title || '')
        setEditBody(body)
        setEditModal(filename)
      })
      .catch(() => showToast('Failed to load post for editing', 'error'))
  }

  const handleEditSave = () => {
    if (!editModal) return
    setEditLoading(true)
    fetch(`/api/paige/staged/${encodeURIComponent(editModal)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          showToast('Post updated')
          setEditModal(null)
          fetchData()
        } else {
          showToast(d.error || 'Save failed', 'error')
        }
      })
      .catch(() => showToast('Failed to reach server', 'error'))
      .finally(() => setEditLoading(false))
  }

  const handleSeoPreview = async (post) => {
    setSeoLoading((prev) => ({ ...prev, [post.filename]: true }))
    setSeoResults((prev) => ({ ...prev, [post.filename]: null }))
    try {
      // First fetch full content
      const contentRes = await fetch(
        `/api/paige/staged/${encodeURIComponent(post.filename)}`,
      )
      const contentData = await contentRes.json()
      let fullBody = contentData.body || contentData.content || post.preview || ''
      // Strip frontmatter if present
      if (fullBody.startsWith('---')) {
        const end = fullBody.indexOf('---', 3)
        if (end !== -1) fullBody = fullBody.slice(end + 3).trim()
      }

      const res = await fetch('/api/paige/seo-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: post.title, content: fullBody }),
      })
      const data = await res.json()
      setSeoResults((prev) => ({ ...prev, [post.filename]: data }))
    } catch {
      setSeoResults((prev) => ({
        ...prev,
        [post.filename]: { error: 'Request failed' },
      }))
    }
    setSeoLoading((prev) => ({ ...prev, [post.filename]: false }))
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full shrink-0 ${
              isOnline ? 'bg-online pulse-online' : 'bg-offline pulse-offline'
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
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
          <input
            type="text"
            placeholder="Topic (optional — leave blank for random)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={generating}
            className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-border text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#d4948a]"
          />
          <button
            onClick={() => { handleGenerate(); setTopic(''); }}
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
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
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
                    {seoResults[post.filename] && !seoResults[post.filename].error && (
                      <div className="bg-sidebar rounded-lg border border-border p-4 mt-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="text-2xl font-bold"
                              style={{
                                color:
                                  seoResults[post.filename].score >= 80
                                    ? '#22c55e'
                                    : seoResults[post.filename].score >= 60
                                      ? '#f59e0b'
                                      : '#ef4444',
                              }}
                            >
                              {seoResults[post.filename].score}/100
                            </span>
                            <span
                              className="text-lg font-bold px-2.5 py-0.5 rounded"
                              style={{
                                backgroundColor:
                                  seoResults[post.filename].score >= 80
                                    ? '#22c55e22'
                                    : seoResults[post.filename].score >= 60
                                      ? '#f59e0b22'
                                      : '#ef444422',
                                color:
                                  seoResults[post.filename].score >= 80
                                    ? '#22c55e'
                                    : seoResults[post.filename].score >= 60
                                      ? '#f59e0b'
                                      : '#ef4444',
                              }}
                            >
                              {seoResults[post.filename].grade}
                            </span>
                            <span className="text-text-dim text-xs">
                              {seoResults[post.filename].summary}
                            </span>
                          </div>
                          <button
                            onClick={() => setSeoResults(prev => ({ ...prev, [post.filename]: null }))}
                            className="text-text-dim hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
                            title="Close SEO results"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(seoResults[post.filename].checks || []).map((check, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-[11px]"
                            >
                              <span>{check.passed ? '\u2705' : '\u274c'}</span>
                              <div>
                                <span className="text-white font-semibold">
                                  {check.label}:{' '}
                                </span>
                                <span className="text-text-dim">{check.note}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {seoResults[post.filename]?.error && (
                      <p className="text-red-400 text-xs mt-2">
                        SEO Error: {seoResults[post.filename].error}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 items-end">
                    <button
                      onClick={() =>
                        speakingId === post.filename
                          ? stopSpeaking()
                          : speak(post.preview || post.title, post.filename)
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                        speakingId === post.filename
                          ? 'bg-accent text-white'
                          : 'bg-sidebar border border-border text-text-dim hover:text-white'
                      }`}
                    >
                      {speakingId === post.filename ? (
                        <><VolumeX size={12} /> Stop</>
                      ) : (
                        <><Volume2 size={12} /> Listen</>
                      )}
                    </button>
                    <button
                      onClick={() => handlePreview(post.filename)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleEditOpen(post.filename)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleSeoPreview(post)}
                      disabled={seoLoading[post.filename]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {seoLoading[post.filename] ? 'Analyzing...' : 'SEO'}
                    </button>
                    <div>
                      <label className="text-text-dim text-[11px] block mb-1">Publish Date</label>
                      <input
                        type="date"
                        value={scheduledDates[post.filename] || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setScheduledDates((prev) => ({ ...prev, [post.filename]: e.target.value }))}
                        className="bg-sidebar border border-border text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-text-dim text-[11px] block mb-1">Category</label>
                      <input
                        type="text"
                        placeholder="e.g. Easter, Kawaii"
                        value={postCategories[post.filename] || ''}
                        onChange={(e) => setPostCategories((prev) => ({ ...prev, [post.filename]: e.target.value }))}
                        className="bg-sidebar border border-border text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent w-32"
                      />
                    </div>
                    <div>
                      <label className="text-text-dim text-[11px] block mb-1">Tags</label>
                      <input
                        type="text"
                        placeholder="tag1, tag2"
                        value={postTags[post.filename] || ''}
                        onChange={(e) => setPostTags((prev) => ({ ...prev, [post.filename]: e.target.value }))}
                        className="bg-sidebar border border-border text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent w-40"
                      />
                    </div>
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
                      onClick={() => {
                        setResendFeedback('')
                        setResendModal(post.filename)
                      }}
                      disabled={!!actionLoading[post.filename]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-600 hover:bg-yellow-500 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      {actionLoading[post.filename] === 'resend'
                        ? 'Resending...'
                        : 'Resend'}
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
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
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
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() =>
                        speakingId === post.filename
                          ? stopSpeaking()
                          : speak(post.body_preview || post.title, post.filename)
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                        speakingId === post.filename
                          ? 'bg-accent text-white'
                          : 'bg-sidebar border border-border text-text-dim hover:text-white'
                      }`}
                    >
                      {speakingId === post.filename ? (
                        <><VolumeX size={12} /> Stop</>
                      ) : (
                        <><Volume2 size={12} /> Listen</>
                      )}
                    </button>
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

      {/* Cron Log */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Terminal size={18} className="text-text-dim" />
            <h3 className="text-lg font-semibold text-white">Cron Log</h3>
            {cronLog?.status && cronLog.status !== 'unknown' && (
              cronLog.status === 'success' ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <XCircle size={16} className="text-red-400" />
              )
            )}
          </div>
          <button
            onClick={fetchCronLog}
            disabled={cronLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={cronLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {cronLog?.last_run && (
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-sm">
              <span className="text-text-dim">Last run:</span>
              <span className="text-white font-mono text-xs">{cronLog.last_run}</span>
              {cronLog.status === 'success' ? (
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/15 text-green-400 ml-2">OK</span>
              ) : cronLog.status === 'error' ? (
                <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 ml-2">Error</span>
              ) : null}
            </div>
          )}
          <div className="overflow-y-auto max-h-64 p-4">
            {!cronLog || cronLog.lines.length === 0 ? (
              <p className="text-text-dim text-sm italic text-center py-4">
                {cronLoading ? 'Loading...' : 'No log entries found'}
              </p>
            ) : (
              <pre className="text-xs font-mono text-text-dim leading-relaxed whitespace-pre-wrap">
                {cronLog.lines.slice(-10).map((l, i) => (
                  <div key={i} className={l.message && /error|traceback|exception|failed/i.test(l.message) ? 'text-red-400' : ''}>
                    {l.timestamp && <span className="text-text-dim/60">{l.timestamp} </span>}
                    {l.message}
                  </div>
                ))}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Edit post modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h3 className="text-white font-semibold text-lg">Edit Post</h3>
              <button
                onClick={() => setEditModal(null)}
                className="text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="text-text-dim text-xs uppercase tracking-wider block mb-1.5">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-sidebar border border-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-text-dim text-xs uppercase tracking-wider block mb-1.5">Body</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={18}
                  className="w-full bg-sidebar border border-border rounded-lg px-4 py-3 text-white text-sm font-mono leading-relaxed focus:outline-none focus:border-accent resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Resend to Paige modal */}
      {resendModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Resend to Paige</h3>
              <button
                onClick={() => setResendModal(null)}
                className="text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-text-dim text-sm mb-4">
              The current draft will be deleted and Paige will rewrite the post. Add optional feedback to guide the rewrite.
            </p>
            <textarea
              value={resendFeedback}
              onChange={(e) => setResendFeedback(e.target.value)}
              placeholder="e.g. Make it more fun, Focus more on kids, Add more detail about..."
              rows={3}
              className="w-full bg-sidebar border border-border rounded-lg px-4 py-3 text-white text-sm placeholder-text-dim resize-none focus:outline-none focus:border-accent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResendModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResend(resendModal)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-500 text-white transition-colors cursor-pointer flex items-center gap-2"
              >
                <RotateCcw size={14} />
                Resend
              </button>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Reject Post?</h3>
              <button
                onClick={() => { setConfirmReject(null); setRejectReason('') }}
                className="text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-text-dim text-sm mb-4">
              This will move the post to the rejected folder. Add a reason so Paige learns what to avoid in future posts.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Too salesy, Not relevant to our audience, Tone doesn't match brand..."
              rows={3}
              className="w-full bg-sidebar border border-border rounded-lg px-4 py-3 text-white text-sm placeholder-text-dim resize-none focus:outline-none focus:border-accent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmReject(null); setRejectReason('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(confirmReject)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
