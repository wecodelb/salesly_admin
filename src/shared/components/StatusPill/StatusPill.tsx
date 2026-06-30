type Status = 'active' | 'inactive' | 'pending' | 'success' | 'warning' | 'error' | 'live' | 'draft' | string

const statusMap: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  live: { bg: 'bg-[var(--accent-teal)]/15', text: 'text-[var(--accent-teal)]', dot: 'bg-[var(--accent-teal)]' },
  success: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  warning: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  inactive: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
}

interface Props {
  status: Status
  label?: string
  pulse?: boolean
}

export function StatusPill({ status, label, pulse = false }: Props) {
  const cfg = statusMap[status] ?? statusMap.inactive
  const displayLabel = label ?? status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium',
        cfg.bg,
        cfg.text,
      ].join(' ')}
    >
      <span className={['w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot, pulse ? 'animate-pulse' : ''].join(' ')} />
      {displayLabel}
    </span>
  )
}
