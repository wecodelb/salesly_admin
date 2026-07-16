type Status = 'active' | 'inactive' | 'pending' | 'success' | 'warning' | 'error' | 'live' | 'draft' | string

// Status is a fixed, reserved scale (good/warning/critical/neutral) drawn from
// the same --accent-* tokens as the rest of the app, so a status pill always
// reads as brand-consistent rather than a generic Tailwind swatch.
const statusMap: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-[var(--accent-green)]/12', text: 'text-[var(--accent-green)]', dot: 'bg-[var(--accent-green)]' },
  live: { bg: 'bg-[var(--accent-teal)]/15', text: 'text-[var(--accent-teal)]', dot: 'bg-[var(--accent-teal)]' },
  success: { bg: 'bg-[var(--accent-green)]/12', text: 'text-[var(--accent-green)]', dot: 'bg-[var(--accent-green)]' },
  pending: { bg: 'bg-[var(--accent-amber)]/12', text: 'text-[var(--accent-amber)]', dot: 'bg-[var(--accent-amber)]' },
  warning: { bg: 'bg-[var(--accent-amber)]/12', text: 'text-[var(--accent-amber)]', dot: 'bg-[var(--accent-amber)]' },
  error: { bg: 'bg-[var(--accent-red)]/12', text: 'text-[var(--accent-red)]', dot: 'bg-[var(--accent-red)]' },
  inactive: { bg: 'bg-[var(--bg-surface-raised)]', text: 'text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' },
  draft: { bg: 'bg-[var(--bg-surface-raised)]', text: 'text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' },
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
