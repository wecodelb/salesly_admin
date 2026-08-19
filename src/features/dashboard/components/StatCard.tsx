import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { changeTone, percent } from '../types'

type Accent = 'primary' | 'green' | 'amber' | 'teal'

interface Props {
  title: string
  /** Already formatted — the card does no arithmetic of its own. */
  value: string
  change?: number | null
  changePeriod?: string
  /** A second line under the value: "of 48 planned", "3 over limit". */
  footnote?: ReactNode
  icon: ReactNode
  accent?: Accent
  loading?: boolean
}

/**
 * Accents name a token pair rather than a colour, so a card tinted "amber"
 * stays amber in both themes and nobody hand-picks a hex here.
 */
const ACCENT: Record<Accent, { text: string; bg: string; glow: string }> = {
  primary: {
    text: 'text-[var(--accent-primary)]',
    bg: 'bg-[var(--accent-primary)]/10',
    glow: 'from-[var(--accent-primary)]/12',
  },
  green: {
    text: 'text-[var(--accent-green)]',
    bg: 'bg-[var(--accent-green)]/10',
    glow: 'from-[var(--accent-green)]/12',
  },
  amber: {
    text: 'text-[var(--accent-amber)]',
    bg: 'bg-[var(--accent-amber)]/10',
    glow: 'from-[var(--accent-amber)]/12',
  },
  teal: {
    text: 'text-[var(--accent-teal)]',
    bg: 'bg-[var(--accent-teal)]/10',
    glow: 'from-[var(--accent-teal)]/12',
  },
}

const TONE = {
  up: { icon: TrendingUp, text: 'text-[var(--accent-green)]' },
  down: { icon: TrendingDown, text: 'text-[var(--accent-red)]' },
  neutral: { icon: Minus, text: 'text-[var(--text-muted)]' },
} as const

/**
 * One headline figure on the dashboard.
 *
 * Deliberately not the shared KpiCard: that one is used on six reference-data
 * screens where a card is a small summary above a table, and widening it for
 * this screen's needs — a tinted wash, a footnote line, a null-safe change —
 * would have changed all six to serve one.
 *
 * A null `change` renders as an em dash, never "0%". There is a real
 * difference between "the same as yesterday" and "yesterday was nothing to
 * compare against", and the second one is not a flat day.
 */
export function StatCard({
  title,
  value,
  change,
  changePeriod = 'vs yesterday',
  footnote,
  icon,
  accent = 'primary',
  loading = false,
}: Props) {
  const a = ACCENT[accent]
  const tone = TONE[changeTone(change ?? null)]
  const ToneIcon = tone.icon

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)]">
      {/* A wash off the top-right corner, tinted to the card's own accent. It
          is the only decoration here: it separates the four cards at a glance
          without another border or a coloured number. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${a.glow} to-transparent blur-xl`}
      />

      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {title}
          </p>
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${a.bg} ${a.text}`}
          >
            {icon}
          </span>
        </div>

        {loading ? (
          <div className="h-9 w-28 animate-pulse rounded bg-[var(--border-default)]" />
        ) : (
          <p className="font-mono text-3xl font-bold leading-none text-[var(--text-primary)]">
            {value}
          </p>
        )}

        <div className="flex min-h-5 items-center gap-1.5 text-xs">
          {change !== undefined && !loading && (
            <>
              <ToneIcon size={14} className={tone.text} />
              <span className={`font-medium ${tone.text}`}>
                {change === null ? '—' : percent(change)}
              </span>
              <span className="text-[var(--text-muted)]">{changePeriod}</span>
            </>
          )}
          {footnote && !loading && (
            <span className="text-[var(--text-muted)]">{footnote}</span>
          )}
        </div>
      </div>
    </div>
  )
}
