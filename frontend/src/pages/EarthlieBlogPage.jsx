/**
 * EarthlieBlog — CLAWBOT Dashboard page for managing Earthlie blog posts.
 * Styled to match PaigePage layout and patterns.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Leaf,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Sparkles,
  X,
  ExternalLink,
  Trash2,
  RotateCcw,
  Edit3,
  Volume2,
  VolumeX,
} from "lucide-react"
import useSpeech from "../hooks/useSpeech"

const API = "/api/earthlie/api/internal/blog"

function seoScoreColor(score) {
  if (score >= 80) return "#22c55e"
  if (score >= 60) return "#f59e0b"
  return "#ef4444"
}

function seoScoreBg(score) {
  if (score >= 80) return "#22c55e22"
  if (score >= 60) return "#f59e0b22"
  return "#ef444422"
}

function statusBadge(status) {
  const styles = {
    pending: "bg-yellow-500/15 text-yellow-400",
    approved: "bg-green-500/15 text-green-400",
    rejected: "bg-red-500/15 text-red-400",
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles[status] || "bg-gray-700 text-gray-300"}`}>
      {status}
    </span>
  )
}

function renderMarkdown(text) {
  if (!text) return ""
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, "<br/><br/>")
}

export default function EarthlieBlogPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genTimer, setGenTimer] = useState(0)
  const [previewPost, setPreviewPost] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editMeta, setEditMeta] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [toast, setToast] = useState(null)
  const [confirmReject, setConfirmReject] = useState(null)
  const [rejectReason, setRejectReason] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [redoPost, setRedoPost] = useState(null)
  const [redoFeedback, setRedoFeedback] = useState("")
  const [redoLoading, setRedoLoading] = useState(false)
  const [topic, setTopic] = useState("")
  const genTimerRef = useRef(null)
  const { speak: speakRaw, stop: stopSpeaking, speakingId } = useSpeech()

  const stripMd = (text) =>
    (text || "")
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*\[\]()]/g, "")

  const speak = (text, id) => speakRaw(stripMd(text), id)

  const showToast = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(API)
      if (res.ok) setPosts(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
    const id = setInterval(fetchPosts, 15000)
    return () => clearInterval(id)
  }, [fetchPosts])

  const handleGenerate = () => {
    setGenerating(true)
    setGenTimer(90)
    fetch("/api/earthlie/api/internal/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim() || undefined }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) showToast("Blog bot is writing a new post...")
        else showToast(d.error || "Failed to start", "error")
      })
      .catch(() => {
        // Generate endpoint may not exist yet — just show timer
        showToast("Blog bot triggered (check cron.log)")
      })

    genTimerRef.current = setInterval(() => {
      setGenTimer((t) => {
        if (t <= 1) {
          clearInterval(genTimerRef.current)
          setGenerating(false)
          fetchPosts()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const handleApprove = async (id) => {
    setActionLoading((p) => ({ ...p, [id]: "approve" }))
    try {
      const res = await fetch(`${API}/${id}/approve`, { method: "PUT" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Approve failed (${res.status})`)
      }
      showToast("Post approved and published!")
      await fetchPosts()
    } catch (e) {
      showToast(e.message || "Failed to approve", "error")
    } finally {
      setActionLoading((p) => ({ ...p, [id]: null }))
    }
  }

  const handleReject = async (id) => {
    setActionLoading((p) => ({ ...p, [id]: "reject" }))
    setConfirmReject(null)
    try {
      await fetch(`${API}/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      })
      setRejectReason("")
      showToast("Post rejected")
      await fetchPosts()
    } catch {
      showToast("Failed to reject", "error")
    } finally {
      setActionLoading((p) => ({ ...p, [id]: null }))
    }
  }

  const handleDelete = async (id) => {
    setConfirmDelete(null)
    setActionLoading((p) => ({ ...p, [id]: "delete" }))
    try {
      await fetch(`${API}/${id}`, { method: "DELETE" })
      showToast("Post deleted")
      await fetchPosts()
    } catch {
      showToast("Failed to delete", "error")
    } finally {
      setActionLoading((p) => ({ ...p, [id]: null }))
    }
  }

  const handleEditOpen = (post) => {
    setEditTitle(post.title)
    setEditBody(post.body || "")
    setEditMeta(post.meta_description || "")
    setEditModal(post._id)
  }

  const handleEditSave = async () => {
    if (!editModal) return
    setEditLoading(true)
    try {
      const res = await fetch(`${API}/${editModal}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody, meta_description: editMeta }),
      })
      if (res.ok) {
        showToast("Post updated")
        setEditModal(null)
        await fetchPosts()
      } else {
        showToast("Save failed", "error")
      }
    } catch {
      showToast("Failed to save", "error")
    } finally {
      setEditLoading(false)
    }
  }

  const handleRedo = async () => {
    if (!redoPost || !redoFeedback.trim()) return
    setRedoLoading(true)
    try {
      const res = await fetch("/api/earthlie/api/internal/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_id: redoPost._id,
          title: redoPost.title,
          body: redoPost.body,
          feedback: redoFeedback.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Post rewritten successfully!")
        setRedoPost(null)
        setRedoFeedback("")
        await fetchPosts()
      } else {
        showToast(data.detail || "Rewrite failed", "error")
      }
    } catch {
      showToast("Failed to rewrite post", "error")
    } finally {
      setRedoLoading(false)
    }
  }

  const pending = posts.filter((p) => p.status === "pending")
  const approved = posts.filter((p) => p.status === "approved")
  const rejected = posts.filter((p) => p.status === "rejected")

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === "error" ? "bg-red-500/90 text-white" : "bg-green-500/90 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Leaf size={28} className="text-green-400" />
            <h2 className="text-2xl font-bold text-white">Earthlie Blog</h2>
          </div>
          <p className="text-text-dim text-sm mt-1">
            AI Blog Writer for Earthlie Designs
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <Clock size={20} className="text-yellow-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">Pending</p>
            <p className="text-xl font-bold text-white">{pending.length}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">Approved</p>
            <p className="text-xl font-bold text-white">{approved.length}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <XCircle size={20} className="text-red-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">Rejected</p>
            <p className="text-xl font-bold text-white">{rejected.length}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <FileText size={20} className="text-blue-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold text-white">{posts.length}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
          <input
            type="text"
            placeholder="Topic (optional — leave blank for random)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={generating}
            className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-border text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
          <button
            onClick={() => { handleGenerate(); setTopic(""); }}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-500"
          >
            <Sparkles size={16} />
            {generating ? `Writing... ${genTimer}s` : "Write New Post"}
          </button>
        </div>
      </div>

      {/* Pending posts */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white">Awaiting Approval</h3>
          {pending.length > 0 && (
            <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded font-bold">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <FileText size={32} className="text-text-dim mx-auto mb-3 opacity-50" />
            <p className="text-text-dim text-sm italic">
              {loading ? "Loading..." : "No posts awaiting approval"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((post) => (
              <div key={post._id} className="bg-card rounded-xl border border-border p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-semibold text-lg">{post.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-text-dim text-xs">
                        {new Date(post.created_at).toLocaleDateString("en-US", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </span>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex gap-1.5">
                          {post.tags.map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-sidebar text-text-dim rounded text-[10px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-text-dim text-sm mt-3 leading-relaxed line-clamp-4">
                      {post.meta_description}
                    </p>

                    {/* SEO Score inline */}
                    {post.seo_score != null && (
                      <div className="bg-sidebar rounded-lg border border-border p-4 mt-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="text-2xl font-bold"
                            style={{ color: seoScoreColor(post.seo_score) }}
                          >
                            {post.seo_score}/100
                          </span>
                          <span
                            className="text-lg font-bold px-2.5 py-0.5 rounded"
                            style={{
                              backgroundColor: seoScoreBg(post.seo_score),
                              color: seoScoreColor(post.seo_score),
                            }}
                          >
                            {post.seo_score >= 80 ? "A" : post.seo_score >= 60 ? "B" : "C"}
                          </span>
                          {post.seo_notes && (
                            <span className="text-text-dim text-xs">{post.seo_notes}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 items-end">
                    <button
                      onClick={() =>
                        speakingId === post._id ? stopSpeaking() : speak(post.body, post._id)
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        speakingId === post._id
                          ? "bg-accent/20 border border-accent text-accent"
                          : "bg-sidebar border border-border text-text-dim hover:text-white"
                      }`}
                      title={speakingId === post._id ? "Stop reading" : "Read aloud"}
                    >
                      {speakingId === post._id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      {speakingId === post._id ? "Stop" : "Listen"}
                    </button>
                    <button
                      onClick={() => setPreviewPost(post)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleEditOpen(post)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => { setRedoFeedback(""); setRedoPost(post) }}
                      disabled={!!actionLoading[post._id]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      Redo
                    </button>
                    <button
                      onClick={() => handleApprove(post._id)}
                      disabled={!!actionLoading[post._id]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading[post._id] === "approve" ? "Publishing..." : "Approve & Publish"}
                    </button>
                    <button
                      onClick={() => {
                        setRejectReason("")
                        setConfirmReject(post._id)
                      }}
                      disabled={!!actionLoading[post._id]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading[post._id] === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: post._id, title: post.title, type: "pending" })}
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

      {/* Approved posts */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white">Published</h3>
          {approved.length > 0 && (
            <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded font-bold">
              {approved.length}
            </span>
          )}
        </div>

        {approved.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <CheckCircle size={32} className="text-text-dim mx-auto mb-3 opacity-50" />
            <p className="text-text-dim text-sm italic">
              {loading ? "Loading..." : "No published posts yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approved.map((post) => (
              <div key={post._id} className="bg-card rounded-xl border border-border p-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-semibold">{post.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-text-dim text-xs">
                        {new Date(post.created_at).toLocaleDateString("en-US", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </span>
                      {post.seo_score != null && (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: seoScoreBg(post.seo_score),
                            color: seoScoreColor(post.seo_score),
                          }}
                        >
                          SEO {post.seo_score}
                        </span>
                      )}
                    </div>
                    <p className="text-text-dim text-sm mt-2 leading-relaxed line-clamp-2">
                      {post.meta_description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() =>
                        speakingId === post._id ? stopSpeaking() : speak(post.body, post._id)
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        speakingId === post._id
                          ? "bg-accent/20 border border-accent text-accent"
                          : "bg-sidebar border border-border text-text-dim hover:text-white"
                      }`}
                      title={speakingId === post._id ? "Stop reading" : "Read aloud"}
                    >
                      {speakingId === post._id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      {speakingId === post._id ? "Stop" : "Listen"}
                    </button>
                    <a
                      href={`https://earthliedesigns.com/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink size={12} />
                      View on Blog
                    </a>
                    <button
                      onClick={() => setConfirmDelete({ id: post._id, title: post.title, type: "approved" })}
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

      {/* Rejected posts */}
      {rejected.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-white">Rejected</h3>
            <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-bold">
              {rejected.length}
            </span>
          </div>
          <div className="space-y-3">
            {rejected.map((post) => (
              <div key={post._id} className="bg-card rounded-xl border border-border p-5 opacity-70">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-semibold">{post.title}</h4>
                    <span className="text-text-dim text-xs">
                      {new Date(post.created_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </span>
                    {post.rejection_reason && (
                      <p className="text-red-400 text-xs mt-2">Reason: {post.rejection_reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmDelete({ id: post._id, title: post.title, type: "rejected" })}
                    className="px-2 py-1.5 rounded-lg text-text-dim hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit post modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h3 className="text-white font-semibold text-lg">Edit Post</h3>
              <button onClick={() => setEditModal(null)} className="text-text-dim hover:text-white transition-colors cursor-pointer">
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
                <label className="text-text-dim text-xs uppercase tracking-wider block mb-1.5">Meta Description</label>
                <input
                  type="text"
                  value={editMeta}
                  onChange={(e) => setEditMeta(e.target.value)}
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
                {editLoading ? "Saving..." : "Save Changes"}
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
                <h3 className="text-white font-semibold text-lg">{previewPost.title}</h3>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-text-dim text-xs">
                    {new Date(previewPost.created_at).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </span>
                  {previewPost.seo_score != null && (
                    <span className="text-text-dim text-xs">SEO: {previewPost.seo_score}/100</span>
                  )}
                </div>
              </div>
              <button onClick={() => setPreviewPost(null)} className="text-text-dim hover:text-white transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div
                className="prose prose-invert text-text text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(previewPost.body) }}
              />
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
              <button onClick={() => { setConfirmReject(null); setRejectReason("") }} className="text-text-dim hover:text-white transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <p className="text-text-dim text-sm mb-4">
              Add a reason so the blog bot learns what to avoid in future posts.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Too generic, needs more product mentions, word count too low..."
              rows={3}
              className="w-full bg-sidebar border border-border rounded-lg px-4 py-3 text-white text-sm placeholder-text-dim resize-none focus:outline-none focus:border-accent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmReject(null); setRejectReason("") }}
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

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white font-semibold text-lg mb-2">Delete Post?</h3>
            <p className="text-text-dim text-sm mb-2">&quot;{confirmDelete.title}&quot;</p>
            <p className="text-text-dim text-sm mb-6">
              This will permanently delete the blog post. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redo modal */}
      {redoPost && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-blue-400" />
                <h3 className="text-white font-semibold text-lg">Redo Post</h3>
              </div>
              <button onClick={() => { setRedoPost(null); setRedoFeedback("") }} className="text-text-dim hover:text-white transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <p className="text-text-dim text-sm mb-2">
              Rewriting: <span className="text-white font-medium">{redoPost.title}</span>
            </p>
            <p className="text-text-dim text-xs mb-4">
              The AI will rewrite this post based on your feedback. The original will be replaced with the new version.
            </p>
            <textarea
              value={redoFeedback}
              onChange={(e) => setRedoFeedback(e.target.value)}
              placeholder="e.g. Make it more product-focused, add more about our dragons, shorter paragraphs, mention Kansas more..."
              rows={4}
              className="w-full bg-sidebar border border-border rounded-lg px-4 py-3 text-white text-sm placeholder-text-dim resize-none focus:outline-none focus:border-accent mb-4"
              disabled={redoLoading}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRedoPost(null); setRedoFeedback("") }}
                disabled={redoLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sidebar border border-border text-text-dim hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRedo}
                disabled={redoLoading || !redoFeedback.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {redoLoading ? (
                  <>
                    <RotateCcw size={14} className="animate-spin" />
                    Rewriting...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Rewrite Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
