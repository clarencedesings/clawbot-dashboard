import { useEffect, useState } from 'react'
import BotCard from '../components/BotCard'

export default function DashboardPage() {
  const [bots, setBots] = useState([])
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => setBots(data.bots || []))
      .catch(() => setBots([]))

    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  const online = bots.filter((b) => b.status === 'online').length
  const total = bots.length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-text-dim text-sm mt-1">
            Clawbot system overview
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              health?.status === 'ok' ? 'bg-online' : 'bg-offline'
            }`}
          />
          <span className="text-text-dim">
            API: {health?.status || 'checking...'}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Bots Online
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {online}/{total}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Gateway
          </p>
          <p className="text-2xl font-bold text-white mt-1">Port 18789</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Requests Today
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {bots.reduce((sum, b) => sum + b.requests_today, 0)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-text-dim text-xs uppercase tracking-wider">
            Model
          </p>
          <p className="text-2xl font-bold text-white mt-1">llama3.1:8b</p>
        </div>
      </div>

      {/* Bot Cards */}
      <h3 className="text-lg font-semibold text-white mb-4">Bots</h3>
      <div className="grid grid-cols-2 gap-4">
        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>
    </div>
  )
}
