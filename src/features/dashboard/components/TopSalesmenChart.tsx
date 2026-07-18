import { money, type SalesmanTotal } from '../data'

interface Props {
  data: SalesmanTotal[]
}

/** Ranked horizontal bars, one measure → one hue; value labels in text
 *  tokens at the bar end, order count revealed on hover. */
export function TopSalesmenChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.total))

  return (
    <div className="flex flex-col gap-3.5">
      {data.map((s) => (
        <div key={s.name} className="group">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-[var(--text-secondary)] truncate">{s.name}</span>
            <span className="text-xs font-mono font-medium text-[var(--text-primary)] flex-shrink-0">
              {money(s.total)}
              <span className="text-[var(--text-muted)] font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                {' '}
                · {s.orders} orders
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-surface-raised)] overflow-hidden">
            <div
              className="h-full rounded-r-[4px] bg-[var(--accent-blue)] group-hover:bg-[var(--accent-primary)] transition-colors"
              style={{ width: `${(s.total / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
