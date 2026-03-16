import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SystemPage from './pages/SystemPage'
import BotsPage from './pages/BotsPage'
import GatewayPage from './pages/GatewayPage'
import TasksPage from './pages/TasksPage'
import LogsPage from './pages/LogsPage'
import AlertsPage from './pages/AlertsPage'
import TokensPage from './pages/TokensPage'
import MemoryPage from './pages/MemoryPage'
import StorePage from './pages/StorePage'
import KofiPage from './pages/KofiPage'
import PaigePage from './pages/PaigePage'
import ApprovalPage from './pages/ApprovalPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('clawbot_auth')
    if (!token) { setAuthChecked(true); return }
    fetch('/api/auth/verify', {
      headers: { 'x-auth-token': token }
    })
      .then(r => r.json())
      .then(d => {
        if (d.valid) setAuthed(true)
        setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
  }, [])

  const handleLogin = () => setAuthed(true)

  const handleLogout = () => {
    const token = localStorage.getItem('clawbot_auth')
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    localStorage.removeItem('clawbot_auth')
    setAuthed(false)
  }

  if (!authChecked) return null
  if (!authed) return <LoginPage onLogin={handleLogin} />

  return (
    <>
      <Sidebar onLogout={handleLogout} />
      <main className="flex-1 p-4 pt-14 md:pt-8 md:p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/bots" element={<BotsPage />} />
          <Route path="/gateway" element={<GatewayPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/tokens" element={<TokensPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/kofi" element={<KofiPage />} />
          <Route path="/paige" element={<PaigePage />} />
          <Route path="/approvals" element={<ApprovalPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </>
  )
}
