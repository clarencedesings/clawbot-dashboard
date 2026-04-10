import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ExternalLink,
  Undo2,
  Search,
  Loader2,
  Image,
  Package,
  CalendarDays,
  DollarSign,
  RefreshCw,
} from 'lucide-react'

const ROSE = '#d4948a'
const SAGE = '#8aad91'

const TYPE_LABELS = {
  single: 'Single',
  five_pack: '5-Pack',
  ten_pack: '10-Pack',
  journal_single: 'Journal 1-Page',
  journal_five: 'Journal 5-Page',
  journal_ten: 'Journal 10-Page',
}

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'coloring_pages', label: 'Coloring Pages' },
  { value: 'journals', label: 'Journals' },
]

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function PhyllisPublished() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [unpublishing, setUnpublishing] = useState({})
  const navigate = useNavigate()

  const fetchPublished = useCallback(() => {
    setLoading(true)
    fetch('/api/phyllis/published')
      .then(r => r.json())
      .then(data => {
        setProducts((data.products || []).sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPublished() }, [fetchPublished])

  const filtered = products.filter(p => {
    if (filter !== 'all' && p.category !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (p.title || '').toLowerCase().includes(q) || (p.theme || '').toLowerCase().includes(q)
    }
    return true
  })

  const handleUnpublish = async (productId) => {
    setUnpublishing(prev => ({ ...prev, [productId]: true }))
    try {
      const resp = await fetch(`/api/phyllis/published/${productId}/unpublish`, { method: 'POST' })
      if (resp.ok) {
        setProducts(prev => prev.filter(p => p._id !== productId))
      }
    } catch {}
    setUnpublishing(prev => ({ ...prev, [productId]: false }))
  }

  // Stats
  const now = new Date()
  const thisMonth = products.filter(p => {
    const d = new Date(p.published_at || p.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const totalCount = products.length
  const monthCount = thisMonth.length
  const monthRevenue = 0 // placeholder

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">Published Products</h2>
          {totalCount > 0 && (
            <span
              className="min-w-[24px] h-6 flex items-center justify-center rounded-full text-white text-xs font-bold px-2"
              style={{ background: SAGE }}
            >
              {totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or theme..."
              className="bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-text-dim/50 focus:outline-none focus:border-[#d4948a] w-64"
            />
          </div>
          <button
            onClick={fetchPublished}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-dim hover:text-white hover:bg-card transition-colors cursor-pointer text-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
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

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <Package size={18} className="text-text-dim" />
            <span className="text-sm text-text-dim">Total Published</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays size={18} className="text-text-dim" />
            <span className="text-sm text-text-dim">Published This Month</span>
          </div>
          <p className="text-3xl font-bold text-white">{monthCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign size={18} className="text-text-dim" />
            <span className="text-sm text-text-dim">Revenue This Month</span>
          </div>
          <p className="text-3xl font-bold text-white">${monthRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-dim">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Package size={48} className="mx-auto mb-4 text-text-dim/20" />
          <p className="text-text-dim mb-4">
            {products.length === 0
              ? 'No products published yet.'
              : 'No products match your search.'}
          </p>
          {products.length === 0 && (
            <button
              onClick={() => navigate('/phyllis/review-queue')}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium cursor-pointer"
              style={{ background: ROSE }}
            >
              Go to Review Queue
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(product => {
            const isColoring = product.category === 'coloring_pages' || product.category === 'kawaii'
            const catColor = isColoring ? ROSE : SAGE

            return (
              <div key={product._id} className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
                {/* Image */}
                <div className="aspect-[4/3] bg-sidebar relative">
                  {product.image_paths?.[0] ? (
                    <img
                      src={`/api/phyllis/published/preview/${product._id}/0`}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={48} className="text-text-dim/20" />
                    </div>
                  )}
                  <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white">
                    {TYPE_LABELS[product.product_type] || product.product_type}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-white font-semibold text-sm leading-tight mb-2">{product.title}</h3>

                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: `${catColor}22`, color: catColor }}
                    >
                      {isColoring ? 'Coloring' : 'Journal'}
                    </span>
                    <span className="text-white font-semibold text-sm ml-auto">
                      {formatPrice(product.price_cents)}
                    </span>
                  </div>

                  <div className="text-xs text-text-dim/50 mb-4">
                    Published {formatDate(product.published_at || product.created_at)}
                  </div>

                  <div className="flex-1" />

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-border">
                    <a
                      href={`https://phyllisdiannestudio.com/product/${product.slug || product._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-white"
                      style={{ background: ROSE }}
                      onMouseEnter={e => e.currentTarget.style.background = '#c4847a'}
                      onMouseLeave={e => e.currentTarget.style.background = ROSE}
                    >
                      <ExternalLink size={12} />
                      View on Site
                    </a>
                    <button
                      onClick={() => handleUnpublish(product._id)}
                      disabled={unpublishing[product._id]}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-sidebar text-text-dim hover:text-white hover:bg-sidebar/80 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-border"
                    >
                      {unpublishing[product._id]
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Undo2 size={12} />
                      }
                      Unpublish
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
