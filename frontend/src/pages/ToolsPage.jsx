import { useState, useEffect } from 'react'

const QUICK_LINKS = [
  { category: 'Store', links: [
    { label: 'Phyllis DiAnne Studio', url: 'https://phyllisdiannestudio.com', icon: '🛍️' },
    { label: 'Store Admin', url: 'https://phyllisdiannestudio.com/admin', icon: '⚙️' },
    { label: 'Ko-fi', url: 'https://ko-fi.com/phyllisdiannecolors', icon: '☕' },
    { label: 'Stripe Dashboard', url: 'https://dashboard.stripe.com', icon: '💳' },
  ]},
  { category: 'Dev & Infrastructure', links: [
    { label: 'GitHub', url: 'https://github.com/clarencedesings', icon: '🐙' },
    { label: 'Cloudflare', url: 'https://dash.cloudflare.com', icon: '☁️' },
    { label: 'Anthropic Console', url: 'https://console.anthropic.com', icon: '🤖' },
    { label: 'Remote Dashboard', url: 'https://dashboard.phyllisdiannestudio.com', icon: '🖥️' },
  ]},
  { category: 'Social Media', links: [
    { label: 'TikTok', url: 'https://tiktok.com/@phyllisdiannecolors', icon: '🎵' },
    { label: 'Pinterest', url: 'https://pinterest.com', icon: '📌' },
    { label: 'Facebook', url: 'https://facebook.com', icon: '👍' },
    { label: 'Instagram', url: 'https://instagram.com', icon: '📷' },
  ]},
  { category: 'Business', links: [
    { label: 'Earthlie Designs', url: 'https://earthliedesigns.com', icon: '🦕' },
    { label: 'Pizza Ranch Franchise', url: 'https://pizzaranch.com/franchise', icon: '🍕' },
    { label: 'Squarespace', url: 'https://squarespace.com', icon: '🔲' },
  ]},
  { category: 'Tools', links: [
    { label: 'Telegram Web', url: 'https://web.telegram.org', icon: '✈️' },
    { label: 'Google Drive', url: 'https://drive.google.com', icon: '📁' },
    { label: 'Gmail', url: 'https://mail.google.com', icon: '📧' },
    { label: 'Canva', url: 'https://canva.com', icon: '🎨' },
    { label: 'Brevo', url: 'https://app.brevo.com', icon: '📨' },
    { label: 'GoDaddy', url: 'https://godaddy.com', icon: '🌐' },
  ]},
]

const STATUS_COLORS = {
  'Not Contacted': '#a0a0a0',
  'Contacted': '#3b82f6',
  'Follow-up': '#f59e0b',
  'Interested': '#22c55e',
  'Closed': '#7c3aed',
  'Rejected': '#ef4444',
}

const EMPTY_CONTACT = { id: '', business: '', name: '', phone: '', email: '', address: '', status: 'Not Contacted', notes: '' }

export default function ToolsPage() {
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_contacts') || '[]') } catch { return [] }
  })
  const [form, setForm] = useState(EMPTY_CONTACT)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('dashboard_theme') || 'dark')

  const saveContacts = (updated) => {
    setContacts(updated)
    localStorage.setItem('crm_contacts', JSON.stringify(updated))
  }

  const handleTheme = (t) => {
    setTheme(t)
    localStorage.setItem('dashboard_theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  const handleSave = () => {
    if (!form.business.trim()) return
    if (editing !== null) {
      const updated = contacts.map((c, i) => i === editing ? { ...form } : c)
      saveContacts(updated)
      setEditing(null)
    } else {
      saveContacts([...contacts, { ...form, id: Date.now().toString() }])
    }
    setForm(EMPTY_CONTACT)
    setShowForm(false)
  }

  const handleEdit = (i) => {
    setForm(contacts[i])
    setEditing(i)
    setShowForm(true)
  }

  const handleDelete = (i) => {
    saveContacts(contacts.filter((_, idx) => idx !== i))
  }

  const filtered = contacts.filter(c =>
    c.business.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.status.toLowerCase().includes(search.toLowerCase())
  )

  const inputStyle = {
    backgroundColor: 'var(--color-sidebar)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 12,
    width: '100%',
    boxSizing: 'border-box'
  }

  return (
    <div style={{ padding: 24, color: 'var(--color-text)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Tools</h1>

      {/* Theme Switcher */}
      <div style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 16 }}>🎨 Theme</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { key: 'dark', label: '🌑 Dark', bg: '#1a1a1a', border: '#333' },
            { key: 'light', label: '☀️ Light', bg: '#f5f5f5', border: '#ddd' },
            { key: 'neon', label: '⚡ Neon', bg: '#0a0a1a', border: '#7c3aed' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => handleTheme(t.key)}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: theme === t.key ? '2px solid #7c3aed' : '1px solid #444',
                backgroundColor: theme === t.key ? '#7c3aed22' : '#2a2a2a',
                color: 'var(--color-text)',
                fontWeight: theme === t.key ? 700 : 400,
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 16 }}>🔗 Quick Links</h2>
        {QUICK_LINKS.map(cat => (
          <div key={cat.category} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {cat.category}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {cat.links.map(link => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: 'var(--color-sidebar)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  {link.icon} {link.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cold Outreach CRM */}
      <div style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>📞 Cold Outreach — Earthlie Designs</h2>
          <button
            onClick={() => { setForm(EMPTY_CONTACT); setEditing(null); setShowForm(!showForm) }}
            style={{ backgroundColor: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            + Add Contact
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ backgroundColor: 'var(--color-sidebar)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>Business Name *</label>
                <input style={inputStyle} value={form.business} onChange={e => setForm(p => ({ ...p, business: e.target.value }))} placeholder="Pizza Ranch - Wichita" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>Contact Name</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Smith" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>Phone</label>
                <input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(316) 555-0100" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>Email</label>
                <input style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="manager@example.com" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>Address</label>
                <input style={inputStyle} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, Wichita, KS" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>Status</label>
                <select style={inputStyle} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Call notes, follow-up details..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} style={{ backgroundColor: '#22c55e', border: 'none', color: '#fff', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {editing !== null ? 'Update' : 'Save Contact'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_CONTACT); setEditing(null) }} style={{ backgroundColor: '#333', border: '1px solid var(--color-border)', color: 'var(--color-text-dim)', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <input
          style={{ ...inputStyle, marginBottom: 12 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts..."
        />

        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => {
            const count = contacts.filter(c => c.status === status).length
            if (count === 0) return null
            return (
              <span key={status} style={{ backgroundColor: `${color}22`, border: `1px solid ${color}`, color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                {status}: {count}
              </span>
            )
          })}
        </div>

        {/* Contact List */}
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--color-text-dim)', fontSize: 12, textAlign: 'center', padding: 20 }}>No contacts yet. Add your first Pizza Ranch location!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {filtered.map((c, i) => (
              <div key={c.id || i} style={{ backgroundColor: 'var(--color-sidebar)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{c.business}</span>
                      <span style={{ backgroundColor: `${STATUS_COLORS[c.status]}22`, border: `1px solid ${STATUS_COLORS[c.status]}`, color: STATUS_COLORS[c.status], borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>
                        {c.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--color-text-dim)' }}>
                      {c.name && <span>👤 {c.name}</span>}
                      {c.phone && <a href={`tel:${c.phone}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>📞 {c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>✉️ {c.email}</a>}
                      {c.address && <span>📍 {c.address}</span>}
                    </div>
                    {c.notes && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-dim)', fontStyle: 'italic' }}>{c.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                    <button onClick={() => handleEdit(i)} style={{ backgroundColor: '#333', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDelete(i)} style={{ backgroundColor: '#333', border: '1px solid var(--color-border)', color: '#ef4444', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
