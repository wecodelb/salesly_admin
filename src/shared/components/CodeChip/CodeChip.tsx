interface Props {
  code?: string | null
  /** Codes are optional on categories and brands, required elsewhere. */
  fallback?: string
}

/**
 * A short machine-facing code. Set in a chip rather than bare text so it reads
 * as an identifier at a glance and doesn't compete with the name beside it.
 */
export function CodeChip({ code, fallback = '—' }: Props) {
  if (!code) {
    return <span className="text-sm text-[var(--text-muted)]">{fallback}</span>
  }

  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
      {code}
    </span>
  )
}
