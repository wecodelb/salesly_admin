import { useMemo, type ReactNode } from 'react'
import { PackageSearch } from 'lucide-react'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useItemDistribution } from '../hooks/use-products'
import { carrierLine, distributionPill, distributionTotals, formatQty } from '../types'

interface Props {
  itemId: number
}

const HEAD_CELL =
  'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]'
const NUM_CELL = 'whitespace-nowrap px-4 py-3 text-right tabular-nums'

// Widths that step down across the numeric columns, so the wait reads as a
// table of names and figures rather than a grey block.
const SKELETON_WIDTHS = ['w-14', 'w-12', 'w-10']

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3
        className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3"
        style={{ textShadow: '0 0 14px var(--heading-glow)' }}
      >
        Where it is
      </h3>
      {children}
    </section>
  )
}

/**
 * Where this product physically is: every warehouse and every salesman's depot
 * holding it, with what each one can still promise.
 *
 * Built by hand rather than on DataTable because of the totals row — the panel
 * is only worth reading if a manager can see the position across all locations
 * without adding the columns up himself — and because the backend's ordering
 * (depots first, so "who is carrying this" comes before "what is on the shelf")
 * is meaningful here, where a sortable header would invite throwing it away.
 */
export function ProductDistributionPanel({ itemId }: Props) {
  const { data: rows = [], isLoading, isError, refetch } = useItemDistribution(itemId)
  const totals = useMemo(() => distributionTotals(rows), [rows])

  if (isLoading) {
    return (
      <Panel>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-3.5 last:border-0"
            >
              <div className="h-4 flex-1 animate-pulse rounded bg-[var(--border-default)]" />
              {SKELETON_WIDTHS.map((w) => (
                <div key={w} className={`h-4 animate-pulse rounded bg-[var(--border-subtle)] ${w}`} />
              ))}
            </div>
          ))}
        </div>
      </Panel>
    )
  }

  if (isError) {
    return (
      <Panel>
        <ErrorState
          title="Couldn't load stock locations"
          message="The warehouses and depots holding this product couldn't be read."
          onRetry={() => refetch()}
        />
      </Panel>
    )
  }

  if (rows.length === 0) {
    return (
      <Panel>
        {/* A zero here would be a lie of a different kind: the product isn't out
            of stock, it has never been received into anywhere at all. */}
        <EmptyState
          icon={<PackageSearch size={28} />}
          title="Never stocked anywhere"
          description="No warehouse or depot has ever held this product. It appears here once a purchase or a stock entry brings some in."
        />
      </Panel>
    )
  }

  return (
    <Panel>
      {totals.reserved_qty > 0 && (
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
          Reserved stock is still on the shelf but already promised to a draft order or a load being
          prepared — it cannot be sold twice.
        </p>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface-raised)]">
              <th scope="col" className={`text-left ${HEAD_CELL}`}>
                Location
              </th>
              <th scope="col" className={`text-right ${HEAD_CELL}`}>
                On hand
              </th>
              <th scope="col" className={`text-right ${HEAD_CELL}`}>
                Available
              </th>
              <th scope="col" className={`text-right ${HEAD_CELL}`}>
                Reserved
              </th>
              <th scope="col" className={`text-left ${HEAD_CELL}`}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pill = distributionPill(row)
              const carrier = carrierLine(row)
              const committed = row.qty > 0 && row.available_qty <= 0

              return (
                <tr
                  key={row.warehouse?.id ?? i}
                  className="border-b border-[var(--border-subtle)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-primary)]">
                        {row.warehouse?.name ?? 'Unknown location'}
                      </span>
                      {row.warehouse?.is_depot && <StatusPill status="live" label="Depot" />}
                    </div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">
                      {row.warehouse?.code ?? '—'}
                    </div>
                    {carrier && (
                      <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{carrier}</div>
                    )}
                  </td>
                  <td className={`${NUM_CELL} text-[var(--text-primary)]`}>{formatQty(row.qty)}</td>
                  {/* The figure that decides whether anything may be promised,
                      so it carries the only colour in the row: amber where the
                      stock is there but spoken for, grey only where there is
                      genuinely nothing. */}
                  <td
                    className={[
                      NUM_CELL,
                      'font-medium',
                      committed
                        ? 'text-[var(--accent-amber)]'
                        : row.available_qty > 0
                          ? 'text-[var(--accent-green)]'
                          : 'text-[var(--text-muted)]',
                    ].join(' ')}
                  >
                    {formatQty(row.available_qty)}
                  </td>
                  <td
                    className={[
                      NUM_CELL,
                      row.reserved_qty > 0
                        ? 'text-[var(--text-secondary)]'
                        : 'text-[var(--text-muted)]',
                    ].join(' ')}
                  >
                    {row.reserved_qty > 0 ? formatQty(row.reserved_qty) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={pill.status} label={pill.label} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--border-default)] bg-[var(--bg-surface-raised)] font-medium">
              <td className="px-4 py-3">
                <div className="text-[var(--text-primary)]">All locations</div>
                <div className="text-xs font-normal text-[var(--text-muted)]">
                  {totals.locations} {totals.locations === 1 ? 'location' : 'locations'}
                  {totals.depots > 0 &&
                    `, ${totals.depots} ${totals.depots === 1 ? 'depot' : 'depots'} carrying ${formatQty(totals.depot_qty)}`}
                </div>
              </td>
              <td className={`${NUM_CELL} text-[var(--text-primary)]`}>{formatQty(totals.qty)}</td>
              <td className={`${NUM_CELL} text-[var(--text-primary)]`}>
                {formatQty(totals.available_qty)}
              </td>
              <td className={`${NUM_CELL} text-[var(--text-primary)]`}>
                {formatQty(totals.reserved_qty)}
              </td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}
