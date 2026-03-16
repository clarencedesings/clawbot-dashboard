import { useState, useEffect } from 'react'

const SUGGESTED_MODELS = [
  { name: 'llama3.1:8b', desc: 'Fast general purpose (4.7GB)' },
  { name: 'llama3.1:70b', desc: 'High quality, needs 40GB+ VRAM' },
  { name: 'mistral:7b', desc: 'Fast and capable (4.1GB)' },
  { name: 'codellama:7b', desc: 'Code generation (3.8GB)' },
  { name: 'codellama:13b', desc: 'Better code generation (7.4GB)' },
  { name: 'llava:7b', desc: 'Vision + language (4.5GB)' },
  { name: 'phi3:mini', desc: 'Tiny but capable (2.2GB)' },
  { name: 'gemma2:9b', desc: 'Google Gemma 2 (5.4GB)' },
]

export default function OllamaPage() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [pullOutput, setPullOutput] = useState(null)
  const [customModel, setCustomModel] = useState('')

  const fetchModels = () => {
    setLoading(true)
    fetch('/api/ollama/models')
      .then(r => r.json())
      .then(d => { setModels(d.models || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchModels() }, [])

  const handlePull = async (modelName) => {
    setPulling(modelName)
    setPullOutput(null)
    try {
      const res = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName })
      })
      const data = await res.json()
      setPullOutput(data.output || data.error || 'Done')
      if (data.success) fetchModels()
    } catch {
      setPullOutput('Request failed')
    }
    setPulling(null)
  }

  const handleDelete = async (modelName) => {
    if (!confirm(`Delete ${modelName}?`)) return
    setDeleting(modelName)
    try {
      const res = await fetch(`/api/ollama/models/${encodeURIComponent(modelName)}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchModels()
    } catch {}
    setDeleting(null)
  }

  const isInstalled = (name) => models.some(m => m.name === name)

  return (
    <div style={{ padding: 24, color: 'var(--color-text)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Ollama Model Manager</h1>

      <div style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Installed Models</h2>
          <button onClick={fetchModels} style={{ backgroundColor: 'var(--color-sidebar)', border: '1px solid var(--color-border)', color: 'var(--color-text-dim)', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        </div>
        {loading ? (
          <p style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Loading...</p>
        ) : models.length === 0 ? (
          <p style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>No models installed.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {models.map(m => (
              <div key={m.name} style={{ backgroundColor: 'var(--color-sidebar)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{m.size} · ID: {m.id?.slice(0, 8)}</div>
                </div>
                <button
                  onClick={() => handleDelete(m.name)}
                  disabled={deleting === m.name}
                  style={{ backgroundColor: 'transparent', border: '1px solid var(--color-offline)', color: 'var(--color-offline)', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', opacity: deleting === m.name ? 0.5 : 1 }}
                >
                  {deleting === m.name ? '...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>Pull a Model</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={customModel}
            onChange={e => setCustomModel(e.target.value)}
            placeholder="e.g. llama3.2:3b"
            style={{ flex: 1, backgroundColor: 'var(--color-sidebar)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }}
          />
          <button
            onClick={() => { if (customModel.trim()) handlePull(customModel.trim()) }}
            disabled={!!pulling}
            style={{ backgroundColor: 'var(--color-accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: pulling ? 0.6 : 1 }}
          >
            {pulling === customModel ? 'Pulling...' : 'Pull'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Suggested Models</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
          {SUGGESTED_MODELS.map(m => (
            <div key={m.name} style={{ backgroundColor: 'var(--color-sidebar)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{m.desc}</div>
              </div>
              {isInstalled(m.name) ? (
                <span style={{ fontSize: 10, color: 'var(--color-online)', fontWeight: 600 }}>✓ Installed</span>
              ) : (
                <button
                  onClick={() => handlePull(m.name)}
                  disabled={!!pulling}
                  style={{ backgroundColor: 'transparent', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', opacity: pulling ? 0.5 : 1 }}
                >
                  {pulling === m.name ? 'Pulling...' : 'Pull'}
                </button>
              )}
            </div>
          ))}
        </div>

        {pullOutput && (
          <pre style={{ marginTop: 12, backgroundColor: '#0a0a0a', border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, fontSize: 11, color: 'var(--color-text-dim)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflowY: 'auto' }}>
            {pullOutput}
          </pre>
        )}
      </div>
    </div>
  )
}
