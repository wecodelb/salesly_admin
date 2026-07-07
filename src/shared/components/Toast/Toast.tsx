import { useEffect } from 'react'
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'
import { useToastStore, type Toast } from '@/shared/hooks/use-toast'

type IconType = 'success' | 'error' | 'warning' | 'info'

function ToastIcon({ type }: { type: IconType }) {
  if (type === 'success') return <CheckCircle size={16} className="text-[var(--accent-green)]" />
  if (type === 'error') return <XCircle size={16} className="text-[var(--accent-red)]" />
  if (type === 'warning') return <AlertTriangle size={16} className="text-[var(--accent-amber)]" />
  return <Info size={16} className="text-[var(--accent-blue)]" />
}

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToastStore()

  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.duration ?? 4000)
    return () => clearTimeout(t)
  }, [toast.id, toast.duration, dismiss])

  return (
    <div className="flex items-start gap-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] p-4 min-w-[300px] max-w-sm">
      <ToastIcon type={toast.type as IconType} />
      <div className="flex-1 min-w-0">
        {toast.title && <p className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</p>}
        {toast.message && <p className="text-sm text-[var(--text-secondary)]">{toast.message}</p>}
      </div>
      <button onClick={() => dismiss(toast.id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
