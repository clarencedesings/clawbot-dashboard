export default function LogsPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Logs</h2>
        <p className="text-text-dim text-sm mt-1">
          OpenClaw gateway logs
        </p>
      </div>
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="font-mono text-sm text-text-dim space-y-1">
          <p className="text-text-dim/50 italic">
            Log streaming will be available when connected to Clawbot server.
          </p>
        </div>
      </div>
    </div>
  )
}
