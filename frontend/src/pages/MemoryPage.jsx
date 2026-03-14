import { useEffect, useState, useCallback } from 'react'
import {
  BrainCircuit,
  FileText,
  HardDrive,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function nameFromFile(filename) {
  return filename.replace(/\.(md|txt)$/, '').replace(/[-_]/g, ' ')
}

export default function MemoryPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [deleting, setDeleting] = useState(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/memory')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleExpand = (filename) => {
    setExpanded((prev) => ({ ...prev, [filename]: !prev[filename] }))
  }

  const handleDelete = (filename) => {
    if (deleting) return
    setDeleting(filename)
    fetch(`/api/memory/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then(() => {
        setData((prev) =>
          prev
            ? {
                ...prev,
                entries: prev.entries.filter((e) => e.filename !== filename),
                total_files: prev.total_files - 1,
              }
            : prev
        )
      })
      .catch(() => {})
      .finally(() => setDeleting(null))
  }

  const entries = data?.entries || []

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Bot Memory</h2>
        <p className="text-text-dim text-sm mt-1">What Jarvis remembers</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <FileText size={20} className="text-accent" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Memory Files
            </p>
            <p className="text-xl font-bold text-white">
              {data?.total_files ?? '—'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <HardDrive size={20} className="text-blue-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Total Size
            </p>
            <p className="text-xl font-bold text-white">
              {data ? formatSize(data.total_size) : '—'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <Clock size={20} className="text-yellow-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Last Updated
            </p>
            <p className="text-xl font-bold text-white">
              {data?.last_updated ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Memory cards */}
      {loading && !data ? (
        <p className="text-text-dim text-center py-12">Loading memories...</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BrainCircuit size={48} className="text-text-dim mb-4" />
          <h3 className="text-lg font-semibold text-white">No memories yet</h3>
          <p className="text-text-dim text-sm mt-1">
            Jarvis hasn't stored any memories
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {entries.map((entry) => {
            const isExpanded = expanded[entry.filename]
            return (
              <div
                key={entry.filename}
                className="bg-card rounded-xl border border-border p-5 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-accent font-semibold capitalize truncate">
                      {nameFromFile(entry.filename)}
                    </h3>
                    <p className="text-text-dim text-xs mt-0.5">
                      {entry.last_modified}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] bg-border rounded px-1.5 py-0.5 text-text-dim">
                      {formatSize(entry.size)}
                    </span>
                    <button
                      onClick={() => handleDelete(entry.filename)}
                      disabled={deleting === entry.filename}
                      className="text-text-dim hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Content preview */}
                <div
                  className={`text-sm text-text-dim font-mono whitespace-pre-wrap break-words ${
                    isExpanded ? '' : 'line-clamp-4'
                  }`}
                >
                  {entry.content || '(empty)'}
                </div>

                {/* Expand/collapse */}
                {entry.content && entry.content.split('\n').length > 4 && (
                  <button
                    onClick={() => toggleExpand(entry.filename)}
                    className="flex items-center gap-1 text-accent text-xs mt-2 hover:text-accent-hover transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={12} /> Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown size={12} /> Show more
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
