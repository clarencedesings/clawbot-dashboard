const STATUS_COLORS = {
  online: 'bg-online',
  idle: 'bg-idle',
  offline: 'bg-offline',
}

export default function BotCard({ bot }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:border-accent/50 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[bot.status]}`}
          />
          <h3 className="text-white font-semibold">{bot.name}</h3>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-accent/15 text-accent-hover capitalize">
          {bot.role}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-dim">Status</span>
          <span className="text-white capitalize">{bot.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-dim">Model</span>
          <span className="text-white">{bot.model}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-dim">Last Active</span>
          <span className="text-white">{bot.last_active || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-dim">Sessions</span>
          <span className="text-white">{bot.sessions ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-dim">Context Used</span>
          <span className="text-white">
            {bot.context_used != null ? `${bot.context_used}%` : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
