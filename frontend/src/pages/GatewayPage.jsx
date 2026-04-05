import { useEffect, useState } from 'react'

export default function GatewayPage() {
  const [gateway, setGateway] = useState(null)

  useEffect(() => {
    fetch('/api/gateway/status')
      .then((r) => r.json())
      .then(setGateway)
      .catch(() => setGateway(null))
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Gateway</h2>
        <p className="text-text-dim text-sm mt-1">
          OpenClaw gateway status
        </p>
      </div>
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-text-dim">Endpoint</span>
            <span className="text-white font-mono text-sm">
              {gateway?.gateway || '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-dim">Port</span>
            <span className="text-white">{gateway?.port || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-dim">Status</span>
            <span className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  gateway?.online ? 'bg-online pulse-online' : 'bg-offline pulse-offline'
                }`}
              />
              <span className="text-white">
                {gateway?.online ? 'Online' : 'Offline'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
