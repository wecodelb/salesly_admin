import { STATUS_COLORS, avatarColor, describeWhere, formatMoney, initials } from '../live-map-logic'
import type { FieldMember, TeamFilter } from '../types'

interface Props {
  members: FieldMember[]
  serverTime: string
  filter: TeamFilter
  onFilter: (filter: TeamFilter) => void
  selectedId: number | null
  onSelect: (id: number) => void
  /** "12s ago": how fresh the list is. */
  updatedAgo: string
}

const FILTERS: { key: TeamFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'idle', label: 'Idle' },
]

/**
 * The field team down the left of the map: who is working, who is not, and
 * how each one's day is going. Picking one frames the map on his day.
 */
export function TeamPanel({ members, serverTime, filter, onFilter, selectedId, onSelect, updatedAgo }: Props) {
  return (
    <aside className="flex w-[320px] flex-shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-default)] px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-heading text-[15px] font-bold text-[var(--text-primary)]">Field Team</span>
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-teal)]" />
            {updatedAgo}
          </span>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Show salesmen">
          {FILTERS.map((f) => {
            const on = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => onFilter(f.key)}
                className={[
                  'h-7 rounded-full border px-3 text-xs font-semibold transition-colors',
                  on
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]',
                ].join(' ')}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {members.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
            {filter === 'all' ? 'No salesmen in this company yet.' : `Nobody is ${filter} right now.`}
          </p>
        )}

        {members.map((m) => {
          const active = m.id === selectedId
          const status = STATUS_COLORS[m.status]
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              aria-pressed={active}
              className={[
                'w-full rounded-xl border p-3 text-left transition-colors',
                active
                  ? 'border-[rgba(26,95,168,.4)] bg-[rgba(26,95,168,.07)] dark:bg-[rgba(26,95,168,.18)]'
                  : 'border-transparent hover:bg-[var(--bg-surface-raised)]',
              ].join(' ')}
            >
              <div className="flex items-center gap-2.5">
                <div className="relative flex-shrink-0">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full font-heading text-xs font-bold text-white"
                    style={{ background: avatarColor(m.id) }}
                  >
                    {initials(m.name)}
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-surface)]"
                    style={{ background: status.ring }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-[var(--text-primary)]">{m.name}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{describeWhere(m, serverTime)}</div>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
                  style={{ color: status.fg, background: status.bg }}
                >
                  {m.status}
                </span>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <Metric label="Sales" value={formatMoney(m.today.sales)} />
                <Metric label="Visits" value={String(m.today.visits)} />
                <Metric label="Collect" value={formatMoney(m.today.collected)} />
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-[var(--bg-surface-raised)] px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="font-mono text-[12.5px] font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  )
}
