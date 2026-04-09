import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FolderPlus,
  FolderOpen,
  Folder,
  Trash2,
  Upload,
  Image,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
} from 'lucide-react'

const ROSE = '#d4948a'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PhyllisCanvaDrop() {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedFolder, setExpandedFolder] = useState(null)
  const [folderFiles, setFolderFiles] = useState({})
  const [filesLoading, setFilesLoading] = useState({})
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [deleting, setDeleting] = useState({})
  const fileInputRef = useRef(null)
  const newFolderRef = useRef(null)

  const fetchFolders = useCallback(() => {
    fetch('/api/phyllis/canva-drop/folders')
      .then(r => r.json())
      .then(data => {
        setFolders(data.folders || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  useEffect(() => {
    if (showNewFolder && newFolderRef.current) {
      newFolderRef.current.focus()
    }
  }, [showNewFolder])

  const fetchFiles = (folderName) => {
    setFilesLoading(prev => ({ ...prev, [folderName]: true }))
    fetch(`/api/phyllis/canva-drop/folders/${encodeURIComponent(folderName)}`)
      .then(r => r.json())
      .then(data => {
        setFolderFiles(prev => ({ ...prev, [folderName]: data.files || [] }))
        setFilesLoading(prev => ({ ...prev, [folderName]: false }))
      })
      .catch(() => {
        setFilesLoading(prev => ({ ...prev, [folderName]: false }))
      })
  }

  const toggleFolder = (folderName) => {
    if (expandedFolder === folderName) {
      setExpandedFolder(null)
    } else {
      setExpandedFolder(folderName)
      if (!folderFiles[folderName]) {
        fetchFiles(folderName)
      }
    }
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!name) return
    setCreating(true)
    try {
      const resp = await fetch('/api/phyllis/canva-drop/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (resp.ok) {
        setNewFolderName('')
        setShowNewFolder(false)
        fetchFolders()
        setExpandedFolder(name)
        setFolderFiles(prev => ({ ...prev, [name]: [] }))
      }
    } catch {}
    setCreating(false)
  }

  const handleUpload = async (files) => {
    if (!expandedFolder || !files.length) return
    const pngs = Array.from(files).filter(f => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png'))
    if (!pngs.length) return

    setUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    pngs.forEach(f => formData.append('files', f))

    try {
      const xhr = new XMLHttpRequest()
      await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error('Upload failed'))
        })
        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.open('POST', `/api/phyllis/canva-drop/folders/${encodeURIComponent(expandedFolder)}/upload`)
        xhr.send(formData)
      })
      fetchFiles(expandedFolder)
      fetchFolders()
    } catch {}
    setUploading(false)
    setUploadProgress(0)
  }

  const handleDeleteFile = async (folderName, fileName) => {
    const key = `${folderName}/${fileName}`
    setDeleting(prev => ({ ...prev, [key]: true }))
    try {
      await fetch(`/api/phyllis/canva-drop/folders/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      })
      setFolderFiles(prev => ({
        ...prev,
        [folderName]: (prev[folderName] || []).filter(f => f.name !== fileName),
      }))
      fetchFolders()
    } catch {}
    setDeleting(prev => ({ ...prev, [key]: false }))
  }

  const handleDeleteFolder = async (folderName) => {
    if (!confirm(`Delete folder "${folderName}" and all files inside?`)) return
    try {
      await fetch(`/api/phyllis/canva-drop/folders/${encodeURIComponent(folderName)}`, {
        method: 'DELETE',
      })
      if (expandedFolder === folderName) setExpandedFolder(null)
      setFolderFiles(prev => {
        const next = { ...prev }
        delete next[folderName]
        return next
      })
      fetchFolders()
    } catch {}
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }, [expandedFolder])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Canva Drop Manager</h2>
          <p className="text-text-dim text-sm mt-1">Drop your Canva PNGs here — the bot picks them up automatically</p>
        </div>
        <button
          onClick={() => setShowNewFolder(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all cursor-pointer shrink-0"
          style={{ background: ROSE }}
          onMouseEnter={e => e.target.style.background = '#c4847a'}
          onMouseLeave={e => e.target.style.background = ROSE}
        >
          <FolderPlus size={16} />
          New Theme Folder
        </button>
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div className="bg-card rounded-xl border border-border p-4 mb-4 flex items-center gap-3">
          <FolderPlus size={18} style={{ color: ROSE }} className="shrink-0" />
          <input
            ref={newFolderRef}
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false) }}
            placeholder="Theme name (e.g. ocean friends)"
            className="flex-1 bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-dim/50 focus:outline-none focus:border-[#d4948a]"
            disabled={creating}
          />
          <button
            onClick={handleCreateFolder}
            disabled={creating || !newFolderName.trim()}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: ROSE }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
            className="text-text-dim hover:text-white transition-colors cursor-pointer p-1"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Folder Browser */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-dim">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : folders.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Folder size={48} className="mx-auto mb-4 text-text-dim/30" />
          <p className="text-text-dim">No theme folders yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map(folder => {
            const isExpanded = expandedFolder === folder.name
            const files = folderFiles[folder.name] || []
            const isLoadingFiles = filesLoading[folder.name]

            return (
              <div key={folder.name} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Folder row */}
                <button
                  onClick={() => toggleFolder(folder.name)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-sidebar/50 transition-colors cursor-pointer text-left"
                >
                  {isExpanded
                    ? <ChevronDown size={16} className="text-text-dim shrink-0" />
                    : <ChevronRight size={16} className="text-text-dim shrink-0" />
                  }
                  {isExpanded
                    ? <FolderOpen size={18} style={{ color: ROSE }} className="shrink-0" />
                    : <Folder size={18} className="text-text-dim shrink-0" />
                  }
                  <span className={`font-medium text-sm flex-1 ${isExpanded ? 'text-white' : 'text-text-dim'}`}>
                    {folder.name}
                  </span>
                  <span className="text-xs text-text-dim/70 mr-2">
                    {folder.file_count} file{folder.file_count !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.name) }}
                    className="text-text-dim/40 hover:text-red-400 transition-colors cursor-pointer p-1"
                    title="Delete folder"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Upload zone */}
                    <div
                      className={`m-3 border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                        dragOver
                          ? 'border-[#d4948a] bg-[#d4948a]/10'
                          : 'border-border hover:border-[#d4948a]/50'
                      }`}
                      onDrop={onDrop}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,image/png"
                        multiple
                        className="hidden"
                        onChange={e => { handleUpload(e.target.files); e.target.value = '' }}
                      />
                      {uploading ? (
                        <div>
                          <Loader2 size={24} className="animate-spin mx-auto mb-2" style={{ color: ROSE }} />
                          <p className="text-sm text-white">Uploading... {uploadProgress}%</p>
                          <div className="mt-2 h-1.5 bg-sidebar rounded-full overflow-hidden max-w-xs mx-auto">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${uploadProgress}%`, background: ROSE }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload size={24} className="mx-auto mb-2 text-text-dim" />
                          <p className="text-sm text-text-dim">
                            Drag & drop PNG files or <span style={{ color: ROSE }}>click to browse</span>
                          </p>
                        </>
                      )}
                    </div>

                    {/* File list */}
                    {isLoadingFiles ? (
                      <div className="flex items-center justify-center py-6 text-text-dim">
                        <Loader2 size={18} className="animate-spin" />
                      </div>
                    ) : files.length === 0 ? (
                      <p className="text-xs text-text-dim/50 text-center pb-4">No files yet</p>
                    ) : (
                      <div className="px-3 pb-3 space-y-1">
                        {files.map(file => {
                          const deleteKey = `${folder.name}/${file.name}`
                          return (
                            <div
                              key={file.name}
                              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar/50 transition-colors group"
                            >
                              {file.thumbnail ? (
                                <img
                                  src={`/api/phyllis/canva-drop/preview/${encodeURIComponent(folder.name)}/${encodeURIComponent(file.name)}`}
                                  alt={file.name}
                                  className="w-10 h-10 object-cover rounded border border-border shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded border border-border bg-sidebar flex items-center justify-center shrink-0">
                                  <Image size={16} className="text-text-dim/30" />
                                </div>
                              )}
                              <span className="text-sm text-white flex-1 truncate">{file.name}</span>
                              <span className="text-xs text-text-dim/50 shrink-0">{formatSize(file.size)}</span>
                              <button
                                onClick={() => handleDeleteFile(folder.name, file.name)}
                                disabled={deleting[deleteKey]}
                                className="opacity-0 group-hover:opacity-100 text-text-dim/40 hover:text-red-400 transition-all cursor-pointer p-1 disabled:opacity-40"
                                title="Delete file"
                              >
                                {deleting[deleteKey]
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <X size={14} />
                                }
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
