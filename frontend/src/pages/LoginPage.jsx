import { useState } from 'react'

export default function LoginPage({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!pin.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pin })
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('clawbot_auth', data.token)
        onLogin()
      } else {
        setError('Incorrect password. Try again.')
      }
    } catch {
      setError('Connection error. Try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 12,
        padding: 40,
        width: 340,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
        <h1 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>CLAWBOT Dashboard</h1>
        <p style={{ color: '#a0a0a0', fontSize: 12, marginBottom: 28 }}>Enter your password to continue</p>
        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            color: '#e0e0e0',
            borderRadius: 6,
            padding: '10px 14px',
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 12,
            textAlign: 'center',
            letterSpacing: 4
          }}
        />
        {error && (
          <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: '#7c3aed',
            border: 'none',
            color: '#ffffff',
            borderRadius: 6,
            padding: '10px 14px',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Checking...' : 'Login'}
        </button>
      </div>
    </div>
  )
}
