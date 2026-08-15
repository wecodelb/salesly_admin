import { useEffect, useMemo, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import { useAdjustItemStock, useItemDistribution } from '../hooks/use-products'
import { formatQty, type AdminItem } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Null while the drawer is sliding shut. */
  item?: AdminItem | null
}

const HEAD_CELL =
  'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]'
const NUM_CELL = 'whitespace-nowrap px-3 py-3 text-right tabular-nums'
const HEADING = 'text-sm font-semibold tracking-wide text-[var(--heading-accent)]'
const HEADING_GLOW = { textShadow: '0 0 14px var(--heading-glow)' }

/**
 * What is physically on the shelf, warehouse by warehouse.
 *
 * A **counted** figure, not a movement: the box says how many are there, and the
 * difference from what the system believed is the system's problem to work out.
 * Asking somebody holding a clipboard to compute a delta is how a miscount
 * becomes a correction in the wrong direction.
 *
 * Until there is a purchasing module this is the only way stock enters a
 * warehouse — a product created in the console is otherwise permanently "Out of
 * stock", and everything downstream of it is unreachable.
 *
 * The whole grid stays on screen while one row is edited, for the same reason
 * the reorder levels do: how many to put in a depot is a judgement about what
 * the rest of the company is holding, and hiding the other rows asks for that
 * judgement blind.
 */
export function StockCountDrawer({ open, onClose, item }: Props) {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)
  const { run } = useActionProgress()

  const { data: warehouses = [] } = useWarehouses()
  const { data: distribution = [], isLoading } = useItemDistribution(
    open && item ? item.id : null,
  )
  const adjust = useAdjustItemStock(item?.id ?? 0)

  const [warehouseId, setWarehouseId] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')

  // Reset on every open: a figure left over from the last product counted is
  // the one mistake this form must not make easy.
  useEffect(() => {
    if (!open) return
    setWarehouseId('')
    setQty('')
    setError('')
  }, [open, item?.id])

  /** What the ledger currently says for the warehouse in the picker. */
  const current = useMemo(
    () => distribution.find((d) => String(d.warehouse?.id) === warehouseId),
    [distribution, warehouseId],
  )

  // Typing a warehouse fills the box with what is on record, so the common case
  // — confirming the count is right — is one tap, and a correction is an edit
  // rather than a figure typed from nothing.
  useEffect(() => {
    if (!warehouseId) return
    setQty(current ? String(current.qty ?? 0) : '0')
  }, [warehouseId, current])

  const reserved = Number(current?.reserved_qty ?? 0)
  const counted = Number(qty.trim())
  const belowReserved =
    qty.trim() !== '' && Number.isFinite(counted) && counted < reserved

  const submit = async () => {
    if (!item) return

    if (!warehouseId) {
      setError('Choose a warehouse first.')
      reportInvalidForm()
      return
    }
    if (qty.trim() === '' || !Number.isFinite(counted) || counted < 0) {
      setError('Enter the counted quantity — zero or more.')
      reportInvalidForm()
      return
    }
    if (belowReserved) {
      // Caught here as well as on the server, so the salesman is told before he
      // presses rather than by a 422 afterwards.
      setError(`${formatQty(reserved)} are already promised on paperwork.`)
      reportInvalidForm()
      return
    }

    setError('')
    const name = warehouses.find((w) => String(w.id) === warehouseId)?.name ?? 'the warehouse'

    await run(
      {
        label: 'Setting stock',
        detail: `${item.name} — ${name}`,
        success: `${item.name} is now ${formatQty(counted)} in ${name}.`,
      },
      () => adjust.mutateAsync({ warehouse_id: Number(warehouseId), qty: counted }),
    )

    onClose()
  }

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={item ? `Set stock — ${item.name}` : 'Set stock'}
      width="w-[560px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={adjust.isPending} disabled={!canManage}>
            Save count
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!canManage && (
          <p className="text-sm text-[var(--accent-amber)]">
            You can see the counts here but not change them.
          </p>
        )}

        <section className="flex flex-col gap-4">
          <h3 className={HEADING} style={HEADING_GLOW}>
            Count
          </h3>

          <SearchableSelect
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses.map((w) => ({
              value: String(w.id),
              label: w.is_depot ? `${w.name} (depot)` : w.name,
            }))}
            placeholder="Which warehouse was counted?"
            searchPlaceholder="Search warehouses…"
          />

          <Input
            label="Quantity on the shelf"
            type="number"
            min={0}
            step="any"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value)
              setError('')
            }}
            disabled={!warehouseId || !canManage}
            error={error || undefined}
            placeholder="0"
          />

          {/* Named out loud, because it is the one figure that can refuse the
              save and it is not visible anywhere else on this screen. */}
          {warehouseId && reserved > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              {formatQty(reserved)} of these are reserved on existing paperwork, so the
              count cannot go below that.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className={HEADING} style={HEADING_GLOW}>
            On record
          </h3>

          {isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          ) : distribution.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              This product has no stock anywhere yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)]">
              <table className="w-full min-w-[26rem] text-sm">
                <thead className="bg-[var(--bg-surface-raised)]">
                  <tr>
                    <th className={`${HEAD_CELL} text-left`}>Warehouse</th>
                    <th className={`${HEAD_CELL} text-right`}>On hand</th>
                    <th className={`${HEAD_CELL} text-right`}>Available</th>
                    <th className={`${HEAD_CELL} text-right`}>Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.map((row, index) => (
                    <tr
                      key={row.warehouse?.id ?? index}
                      className="border-t border-[var(--border-default)]"
                    >
                      <td className="px-3 py-3 text-[var(--text-primary)]">
                        {row.warehouse?.name ?? '—'}
                      </td>
                      <td className={`${NUM_CELL} text-[var(--text-primary)]`}>
                        {formatQty(row.qty ?? 0)}
                      </td>
                      <td className={`${NUM_CELL} text-[var(--text-secondary)]`}>
                        {formatQty(row.available_qty ?? 0)}
                      </td>
                      <td className={`${NUM_CELL} text-[var(--text-muted)]`}>
                        {formatQty(row.reserved_qty ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* The three figures are one ledger, and a screen showing two of them
              out of step is how somebody promises goods that are not there. */}
          <p className="text-xs text-[var(--text-muted)]">
            On hand is what is in the building. Reserved is what documents have already
            committed. Available is the difference — what can still be sold.
          </p>
        </section>
      </div>
    </SideDrawer>
  )
}
