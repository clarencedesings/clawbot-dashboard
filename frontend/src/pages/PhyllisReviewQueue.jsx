import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle,
  RefreshCw,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Image,
  Pencil,
  Check,
  X,
  Sparkles,
  Download,
  Package,
} from 'lucide-react'

const ROSE = '#d4948a'
const SAGE = '#8aad91'

const TYPE_LABELS = {
  single: 'Single',
  five_pack: '5-Pack',
  ten_pack: '10-Pack',
}

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'coloring_pages', label: 'Coloring Pages' },
  { value: 'journals', label: 'Journals' },
]

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

function InlineEdit({ value, onSave, className, multiline }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const save = () => {
    if (draft.trim() && draft !== value) onSave(draft.trim())
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true) }}
        className={`cursor-pointer hover:bg-sidebar/50 rounded px-1 -mx-1 transition-colors group inline-flex items-center gap-1 ${className}`}
        title="Click to edit"
      >
        {value}
        <Pencil size={10} className="opacity-0 group-hover:opacity-50 shrink-0" />
      </span>
    )
  }

  if (multiline) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
          className="bg-sidebar border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#d4948a] resize-none"
          rows={3}
          autoFocus
        />
        <div className="flex gap-1">
          <button onClick={save} className="text-online hover:text-white cursor-pointer"><Check size={14} /></button>
          <button onClick={() => setEditing(false)} className="text-text-dim hover:text-white cursor-pointer"><X size={14} /></button>
        </div>
      </div>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className={`bg-sidebar border border-border rounded px-2 py-0.5 text-white focus:outline-none focus:border-[#d4948a] ${className}`}
        style={{ width: Math.max(100, draft.length * 8) }}
        autoFocus
      />
      <button onClick={save} className="text-online hover:text-white cursor-pointer"><Check size={14} /></button>
      <button onClick={() => setEditing(false)} className="text-text-dim hover:text-white cursor-pointer"><X size={14} /></button>
    </span>
  )
}

function PriceEdit({ cents, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState((cents / 100).toFixed(2))

  const save = () => {
    const val = Math.round(parseFloat(draft) * 100)
    if (!isNaN(val) && val > 0 && val !== cents) onSave(val)
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft((cents / 100).toFixed(2)); setEditing(true) }}
        className="cursor-pointer hover:bg-sidebar/50 rounded px-1 -mx-1 transition-colors group inline-flex items-center gap-1 text-white font-semibold"
        title="Click to edit"
      >
        {formatPrice(cents)}
        <Pencil size={10} className="opacity-0 group-hover:opacity-50 shrink-0" />
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-text-dim">$</span>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="bg-sidebar border border-border rounded px-2 py-0.5 text-white focus:outline-none focus:border-[#d4948a] w-20 text-sm"
        autoFocus
      />
      <button onClick={save} className="text-online hover:text-white cursor-pointer"><Check size={14} /></button>
      <button onClick={() => setEditing(false)} className="text-text-dim hover:text-white cursor-pointer"><X size={14} /></button>
    </span>
  )
}

export default function PhyllisReviewQueue() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedDesc, setExpandedDesc] = useState({})
  const [actionLoading, setActionLoading] = useState({})
  const [mockupLoading, setMockupLoading] = useState({})
  const [mockupUrls, setMockupUrls] = useState({})
  const [packageLoading, setPackageLoading] = useState({})

  const fetchQueue = useCallback(() => {
    setLoading(true)
    fetch('/api/phyllis/review-queue')
      .then(r => r.json())
      .then(data => {
        setProducts((data.products || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  const filtered = filter === 'all'
    ? products
    : products.filter(p => p.category === filter)

  const handleAction = async (productId, action) => {
    setActionLoading(prev => ({ ...prev, [productId]: action }))
    try {
      const resp = await fetch(`/api/phyllis/review-queue/${productId}/${action}`, { method: 'POST' })
      if (resp.ok) {
        if (action === 'delete') {
          setProducts(prev => prev.filter(p => p._id !== productId))
        } else {
          fetchQueue()
        }
      }
    } catch {}
    setActionLoading(prev => ({ ...prev, [productId]: null }))
  }

  const handleFieldUpdate = async (productId, field, value) => {
    try {
      await fetch(`/api/phyllis/review-queue/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      setProducts(prev => prev.map(p => p._id === productId ? { ...p, [field]: value } : p))
    } catch {}
  }

  const handleGenerateMockup = async (productId) => {
    setMockupLoading(prev => ({ ...prev, [productId]: true }))
    try {
      const resp = await fetch(`/api/phyllis/review-queue/${productId}/mockup`, { method: 'POST' })
      const data = await resp.json()
      if (data.success) {
        // Cache-bust by appending timestamp
        setMockupUrls(prev => ({ ...prev, [productId]: `/api/phyllis/review-queue/mockup/${productId}?t=${Date.now()}` }))
        // Update product to reflect mockup_path exists
        setProducts(prev => prev.map(p => p._id === productId ? { ...p, mockup_path: data.mockup_path } : p))
      }
    } catch {}
    setMockupLoading(prev => ({ ...prev, [productId]: false }))
  }

  const handleBuildPackage = async (productId) => {
    setPackageLoading(prev => ({ ...prev, [productId]: true }))
    try {
      const resp = await fetch(`/api/phyllis/review-queue/${productId}/build-package`, { method: 'POST' })
      const data = await resp.json()
      if (data.success) {
        setMockupUrls(prev => ({ ...prev, [productId]: `/api/phyllis/review-queue/mockup/${productId}?t=${Date.now()}` }))
        setProducts(prev => prev.map(p => p._id === productId ? { ...p, mockup_path: data.mockup_path, pdf_path: data.pdf_path } : p))
      }
    } catch {}
    setPackageLoading(prev => ({ ...prev, [productId]: false }))
  }

  const pendingCount = products.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">Review Queue</h2>
          {pendingCount > 0 && (
            <span
              className="min-w-[24px] h-6 flex items-center justify-center rounded-full text-white text-xs font-bold px-2"
              style={{ background: ROSE }}
            >
              {pendingCount}
            </span>
          )}
        </div>
        <button
          onClick={fetchQueue}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-dim hover:text-white hover:bg-card transition-colors cursor-pointer text-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-card rounded-lg p-1 w-fit border border-border">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              filter === tab.value
                ? 'text-white'
                : 'text-text-dim hover:text-white'
            }`}
            style={filter === tab.value ? { background: `${ROSE}30`, color: ROSE } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-dim">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-online/30" />
          <p className="text-text-dim">
            {products.length === 0 ? 'No products in the review queue.' : 'No products match this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(product => {
            const isColoring = product.category === 'coloring_pages' || product.category === 'kawaii'
            const catColor = isColoring ? ROSE : SAGE
            const currentAction = actionLoading[product._id]
            const descExpanded = expandedDesc[product._id]

            return (
              <div key={product._id} className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
                {/* Image — show mockup if available, otherwise B&W */}
                <div className="aspect-[4/3] bg-sidebar relative">
                  {(mockupUrls[product._id] || product.mockup_path) ? (
                    <img
                      src={mockupUrls[product._id] || `/api/phyllis/review-queue/mockup/${product._id}`}
                      alt={`${product.title} mockup`}
                      className="w-full h-full object-contain bg-white/5"
                    />
                  ) : product.image_paths?.[0] ? (
                    <img
                      src={`/api/phyllis/review-queue/preview/${product._id}/0`}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={48} className="text-text-dim/20" />
                    </div>
                  )}
                  {/* Type badge */}
                  <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white">
                    {TYPE_LABELS[product.product_type] || product.product_type}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                  {/* Title */}
                  <div className="mb-2">
                    <InlineEdit
                      value={product.title}
                      onSave={v => handleFieldUpdate(product._id, 'title', v)}
                      className="text-white font-semibold text-sm leading-tight"
                    />
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: `${catColor}22`, color: catColor }}
                    >
                      {isColoring ? 'Coloring' : 'Journal'}
                    </span>
                    {product.status === 'PUBLISHED' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        Published
                      </span>
                    )}
                    <span className="text-xs text-text-dim/50 ml-auto">
                      {formatDate(product.created_at)}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-text-dim">Price</span>
                    <PriceEdit
                      cents={product.price_cents}
                      onSave={v => handleFieldUpdate(product._id, 'price_cents', v)}
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-3">
                    {descExpanded ? (
                      <>
                        <InlineEdit
                          value={product.description}
                          onSave={v => handleFieldUpdate(product._id, 'description', v)}
                          className="text-xs text-text-dim"
                          multiline
                        />
                        <button
                          onClick={() => setExpandedDesc(prev => ({ ...prev, [product._id]: false }))}
                          className="text-[10px] text-text-dim/50 hover:text-text-dim flex items-center gap-0.5 mt-1 cursor-pointer"
                        >
                          <ChevronUp size={10} /> Less
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setExpandedDesc(prev => ({ ...prev, [product._id]: true }))}
                        className="text-xs text-text-dim/50 hover:text-text-dim flex items-center gap-0.5 cursor-pointer"
                      >
                        <ChevronDown size={10} /> Show description
                      </button>
                    )}
                  </div>

                  {/* Tags */}
                  {product.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {product.tags.map((tag, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar text-text-dim/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Download B&W images */}
                  {product.image_paths?.length > 0 && (
                    <div className="mb-2">
                      <button
                        onClick={() => window.open(`/api/phyllis/review-queue/${product._id}/download-zip`)}
                        className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border"
                        style={{ borderColor: `${ROSE}30`, color: `${ROSE}99` }}
                        onMouseEnter={e => e.currentTarget.style.background = `${ROSE}10`}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Download size={12} />
                        Download B&W Images
                      </button>
                    </div>
                  )}

                  {/* Mockup button */}
                  <div className="mb-3">
                    {mockupLoading[product._id] ? (
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all cursor-not-allowed opacity-60"
                        style={{ background: `${ROSE}22`, color: ROSE }}
                      >
                        <Loader2 size={14} className="animate-spin" />
                        Generating...
                      </button>
                    ) : (mockupUrls[product._id] || product.mockup_path) ? (
                      <button
                        onClick={() => handleGenerateMockup(product._id)}
                        className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border"
                        style={{ borderColor: `${ROSE}40`, color: ROSE }}
                        onMouseEnter={e => e.currentTarget.style.background = `${ROSE}15`}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Sparkles size={12} />
                        Regenerate Mockup
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGenerateMockup(product._id)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-white text-sm font-medium transition-all cursor-pointer"
                        style={{ background: ROSE }}
                        onMouseEnter={e => e.currentTarget.style.background = '#c4847a'}
                        onMouseLeave={e => e.currentTarget.style.background = ROSE}
                      >
                        <Sparkles size={14} />
                        Generate Mockup
                      </button>
                    )}
                  </div>

                  {/* Build Mockup & Package */}
                  <div className="mb-3">
                    <button
                      onClick={() => handleBuildPackage(product._id)}
                      disabled={!!packageLoading[product._id]}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ borderColor: `${ROSE}50`, color: ROSE, background: `${ROSE}08` }}
                      onMouseEnter={e => { if (!packageLoading[product._id]) e.currentTarget.style.background = `${ROSE}18` }}
                      onMouseLeave={e => e.currentTarget.style.background = `${ROSE}08`}
                    >
                      {packageLoading[product._id]
                        ? <><Loader2 size={14} className="animate-spin" /> Building Package...</>
                        : <><Package size={14} /> Build Mockup &amp; Package</>
                      }
                    </button>
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Actions */}
                  <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-border">
                    <button
                      onClick={() => handleAction(product._id, 'publish')}
                      disabled={!!currentAction}
                      className="flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    >
                      {currentAction === 'publish'
                        ? <Loader2 size={14} className="animate-spin" />
                        : <CheckCircle size={14} />
                      }
                      Publish
                    </button>
                    <button
                      onClick={() => handleAction(product._id, 'redo')}
                      disabled={!!currentAction}
                      className="flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                    >
                      {currentAction === 'redo'
                        ? <Loader2 size={14} className="animate-spin" />
                        : <RefreshCw size={14} />
                      }
                      Redo
                    </button>
                    <button
                      onClick={() => handleAction(product._id, 'deny')}
                      disabled={!!currentAction}
                      className="flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                    >
                      {currentAction === 'deny'
                        ? <Loader2 size={14} className="animate-spin" />
                        : <XCircle size={14} />
                      }
                      Deny
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this product permanently?')) handleAction(product._id, 'delete') }}
                      disabled={!!currentAction}
                      className="flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                      {currentAction === 'delete'
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />
                      }
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
