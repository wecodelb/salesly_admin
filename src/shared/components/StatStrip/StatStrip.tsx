import type { ReactNode } from 'react'

export interface Stat {
  label: string
  value: string | number
  /** Tints the value — use sparingly, for the figure that needs attention. */
  tone?: 'default' | 'muted' | 'warn'
  icon?: ReactNode
}

interface Props {
  stats: Stat[]
  loading?: boolean
}

const TONE = {
  default: 'text-[var(--text-primary)]',
  muted: 'text-[var(--text-muted)]',
  warn: 'text-[var(--accent-amber)]',
} as const

/**
 * A single-row summary for reference-data screens.
 *
 * Deliberately lighter than KpiCard: these lists are short and their numbers
 * are context, not headline metrics. Four full cards above a six-row table
 * would outweigh the thing they describe.
 */
export function StatStrip({ stats, loading = false }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-3.5">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-2.5">
          {stat.icon && <span className="text-[var(--text-muted)]">{stat.icon}</span>}
          <div className="flex items-baseline gap-2">
            {loading ? (
              <div className="h-5 w-8 animate-pulse rounded bg-[var(--border-default)]" />
            ) : (
              <span
                className={`text-lg font-semibold tabular-nums ${TONE[stat.tone ?? 'default']}`}
              >
                {stat.value}
              </span>
            )}
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {stat.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
