import { useEffect, useState } from 'react'
import BotCard from '../components/BotCard'

export default function BotsPage() {
  const [bots, setBots] = useState([])

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => setBots(data.bots || []))
      .catch(() => setBots([]))
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Bots</h2>
        <p className="text-text-dim text-sm mt-1">
          Manage and monitor your bots
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>
    </div>
  )
}
