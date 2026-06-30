import { AlertTriangle } from 'lucide-react'
import { Button } from '../Button'

interface Props {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4 text-[var(--accent-red)]">
        <AlertTriangle size={28} />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)] font-heading mb-1">{title}</h3>
      {message && <p className="text-sm text-[var(--text-muted)] max-w-sm mb-4">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
