import { money, type SalesmanTotal } from '../types'

interface Props {
  data: SalesmanTotal[]
}

/**
 * Ranked bars, one measure to one hue.
 *
 * Ranked on money rather than document count: twenty small orders is not
 * out-selling three large ones. The count sits beside the total so the reader
 * can see which of the two it was — and it is always visible, not revealed on
 * hover, because the whole point is that the two figures disagree sometimes.
 *
 * An empty week is a real state here, not an error: nothing has been invoiced
 * since Monday yet. The old version spread an empty array into Math.max and
 * drew every bar at NaN% width.
 */
export function TopSalesmenChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-muted)]">
        Nothing invoiced yet this week.
      </p>
    )
  }

  const max = Math.max(...data.map((d) => d.total))

  return (
    <div className="flex flex-col gap-3.5">
      {data.map((s, i) => (
        <div key={s.id ?? `unassigned-${i}`} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-[10px] text-[var(--text-muted)]">{i + 1}</span>
              <span className="truncate text-sm text-[var(--text-secondary)]">{s.name}</span>
            </span>
            <span className="flex-shrink-0 font-mono text-xs font-medium text-[var(--text-primary)]">
              {money(s.total)}
              <span className="font-normal text-[var(--text-muted)]"> · {s.orders}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-raised)]">
            <div
              className="h-full rounded-r-[4px] bg-[var(--accent-blue)] transition-colors group-hover:bg-[var(--accent-primary)]"
              // max is > 0 here: an all-zero week cannot reach this branch,
              // since a salesman with nothing invoiced is not in the result.
              style={{ width: `${max > 0 ? (s.total / max) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
