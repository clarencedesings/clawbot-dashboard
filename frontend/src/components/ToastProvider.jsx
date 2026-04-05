import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let idCounter = 0

const TYPE_CONFIG = {
  success: { icon: CheckCircle, bg: 'bg-green-500/90', border: 'border-green-400/30' },
  error: { icon: XCircle, bg: 'bg-red-500/90', border: 'border-red-400/30' },
  warning: { icon: AlertTriangle, bg: 'bg-yellow-500/90', border: 'border-yellow-400/30' },
  info: { icon: Info, bg: 'bg-blue-500/90', border: 'border-blue-400/30' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const dismiss = useCallback((id) => {
    // Start exit animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    // Remove after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }, 300)
  }, [])

  const showToast = useCallback((message, type = 'success') => {
    const id = ++idCounter
    setToasts((prev) => [...prev.slice(-4), { id, message, type, exiting: false }])
    timersRef.current[id] = setTimeout(() => dismiss(id), 4000)
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info
          const Icon = config.icon
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm text-white font-medium ${config.bg} ${config.border} ${
                toast.exiting ? 'toast-exit' : 'toast-enter'
              }`}
              style={{ minWidth: 260, maxWidth: 400 }}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 text-white/70 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
