export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-text-dim text-sm mt-1">
          Dashboard configuration
        </p>
      </div>
      <div className="space-y-4">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-white font-semibold mb-4">Connection</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-dim">Gateway URL</span>
              <span className="text-white font-mono">
                ws://127.0.0.1:18789
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">MongoDB</span>
              <span className="text-white font-mono">
                localhost:27017
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">API Port</span>
              <span className="text-white">8002</span>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-white font-semibold mb-4">API Keys</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-dim">Anthropic API Key</span>
              <span className="text-yellow-400">Not configured</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">OpenClaw Token</span>
              <span className="text-online">Configured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
