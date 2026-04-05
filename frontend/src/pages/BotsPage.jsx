import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BotCard from '../components/BotCard'

export default function BotsPage() {
  const [bots, setBots] = useState([])
  const [paigeStatus, setPaigeStatus] = useState('offline')
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => setBots(data.bots || []))
      .catch(() => setBots([]))

    fetch('/api/paige/status')
      .then((r) => r.json())
      .then((data) => setPaigeStatus(data.status || 'offline'))
      .catch(() => setPaigeStatus('offline'))
  }, [])

  const paigeOnline = paigeStatus === 'online'

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Bots</h2>
        <p className="text-text-dim text-sm mt-1">
          Manage and monitor your bots
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Paige card */}
        <div className="bg-card rounded-xl border border-border p-5 hover:border-accent/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${paigeOnline ? 'bg-online pulse-online' : 'bg-offline pulse-offline'}`} />
              <h3 className="text-white font-semibold">Paige</h3>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-accent/15 text-accent-hover capitalize">
              Blog Writer
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-dim">Status</span>
              <span className={`capitalize ${paigeOnline ? 'text-white' : 'text-offline'}`}>{paigeStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Model</span>
              <span className="text-white">ollama/llama3.1:8b</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Description</span>
              <span className="text-white">AI Blog Writer for Phyllis Dianne Studio</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/paige')}
            className="mt-4 w-full py-2 rounded-lg bg-accent/15 text-accent-hover text-sm font-medium hover:bg-accent/25 transition-colors"
          >
            Go to Paige
          </button>
        </div>

        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>
    </div>
  )
}
