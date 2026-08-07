import type { ReactNode } from 'react'
import { formatPercent, type CapacityUsage } from '../types'

interface Props {
  label: string
  icon?: ReactNode
  usage: CapacityUsage
  /** Bare figures — the unit is written once beside the pair, not against each
   *  half of a comparison. */
  format: (value: number) => string
  unit: string
  /** What the lighter segment is made of, in words: goods already on the road,
   *  or those plus the load being keyed. */
  incomingNote?: string
}

/**
 * How full a depot is against one of its two caps, drawn as a bar in two
 * segments: what is on board now, and what is already travelling toward it.
 *
 * Past the cap the bar turns amber rather than red, and the percentage is
 * spelled out instead of being clamped to a full bar. Nothing here refuses
 * anything — a salesman who straps one more pallet on has not made an error,
 * he has made a decision, and the screen's job is to make sure he made it
 * knowingly.
 *
 * A cap nobody declared is said in words. An empty bar would read as an empty
 * depot, which is the opposite of what a missing limit means.
 */
export function CapacityBar({ label, icon, usage, format, unit, incomingNote }: Props) {
  const tone = usage.over ? 'var(--accent-amber)' : 'var(--accent-primary)'

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--text-muted)]">
          {icon}
          {label}
        </span>

        {usage.uncapped ? (
          <span className="text-sm tabular-nums text-[var(--text-secondary)]">
            <span className="font-mono text-[var(--text-primary)]">{format(usage.total)}</span> {unit}{' '}
            <span className="text-[var(--text-muted)]">· no limit set</span>
          </span>
        ) : (
          <span className="text-sm tabular-nums text-[var(--text-secondary)]">
            <span className="font-mono text-[var(--text-primary)]">{format(usage.total)}</span> /{' '}
            <span className="font-mono">{format(usage.max ?? 0)}</span> {unit}{' '}
            <span
              className="font-medium"
              style={{ color: usage.over ? 'var(--accent-amber)' : 'var(--text-muted)' }}
            >
              ({formatPercent(usage.totalPct)})
            </span>
          </span>
        )}
      </div>

      {!usage.uncapped && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usage.totalPct)}
          className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--bg-surface-raised)]"
        >
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${usage.usedWidth}%`, backgroundColor: tone }}
          />
          {/* Lighter, and against the same track: goods on their way are not
              yet on board, but the room they will take is already gone. */}
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${usage.incomingWidth}%`, backgroundColor: tone, opacity: 0.35 }}
          />
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-xs">
        {usage.over && (
          <span className="font-medium text-[var(--accent-amber)]">
            {format(usage.total - (usage.max ?? 0))} {unit} over — it will still go out.
          </span>
        )}
        {usage.incoming > 0 && incomingNote && (
          <span className="text-[var(--text-muted)]">
            {format(usage.incoming)} {unit} {incomingNote}
          </span>
        )}
      </div>
    </div>
  )
}
