import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import BotsPage from './pages/BotsPage'
import GatewayPage from './pages/GatewayPage'
import TasksPage from './pages/TasksPage'
import LogsPage from './pages/LogsPage'
import AlertsPage from './pages/AlertsPage'
import TokensPage from './pages/TokensPage'
import MemoryPage from './pages/MemoryPage'
import StorePage from './pages/StorePage'
import KofiPage from './pages/KofiPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/bots" element={<BotsPage />} />
          <Route path="/gateway" element={<GatewayPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/tokens" element={<TokensPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/kofi" element={<KofiPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </>
  )
}
