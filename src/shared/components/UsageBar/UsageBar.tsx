interface Props {
  count: number
  /** The largest count in the list, so bars are comparable across rows. */
  max: number
  /** e.g. "product" → "12 products". */
  noun: string
  /** Shown instead of a bar when nothing uses this row. */
  emptyLabel?: string
}

/**
 * How much a reference row is actually used, as a number plus a proportional
 * bar. The bar is what makes a column of figures scannable — you can see which
 * categories carry the catalog without reading any of them.
 *
 * Zero is called out rather than drawn as an empty bar, because "nothing uses
 * this" is the actionable state: those are the rows safe to delete.
 */
export function UsageBar({ count, max, noun, emptyLabel = 'Unused' }: Props) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-dashed border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
        {emptyLabel}
      </span>
    )
  }

  // Floor at 6% so a count of 1 next to a count of 400 is still visible.
  const pct = max > 0 ? Math.max((count / max) * 100, 6) : 0

  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <span className="font-mono text-sm text-[var(--text-primary)] tabular-nums w-8 text-right">
        {count}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface-raised)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
        {count === 1 ? noun : `${noun}s`}
      </span>
    </div>
  )
}
