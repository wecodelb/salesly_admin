import { useEffect, useMemo, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useItemLevels, useSaveItemLevel } from '../hooks/use-products'
import {
  formatQty,
  levelBreach,
  levelLabel,
  levelPill,
  type AdminItem,
  type ItemLevel,
  type SaveItemLevelPayload,
} from '../types'

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

/** A blank box is no level at all, which the API takes as an explicit null and
 *  is a different instruction from a level of zero. */
function levelOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The floor and ceiling for one product, warehouse by warehouse.
 *
 * One row is edited at a time and the whole grid stays on screen beneath it,
 * because the decision is never about a single warehouse: setting a depot's
 * floor to ten is a judgement about what the rest of the company is holding,
 * and a form that hid the other rows would be asking for that judgement blind.
 *
 * Both levels are in base units — the unit stock is counted in, not the carton
 * the screen happens to sell by — and either may be left blank, which is what
 * the salesman's "no limit" means: nothing to breach.
 */
export function ItemLevelsDrawer({ open, onClose, item }: Props) {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)
  const { run } = useActionProgress()

  const itemId = open && item ? item.id : null
  const { data: rows = [], isLoading, isError, refetch } = useItemLevels(itemId)
  const saveLevel = useSaveItemLevel(item?.id ?? 0)

  const [warehouseId, setWarehouseId] = useState('')
  const [minQty, setMinQty] = useState('')
  const [maxQty, setMaxQty] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setWarehouseId('')
    setMinQty('')
    setMaxQty('')
    setErrors({})
  }, [open, item])

  const byWarehouse = useMemo(() => {
    const map = new Map<number, ItemLevel>()
    for (const row of rows) {
      if (row.warehouse?.id != null) map.set(row.warehouse.id, row)
    }
    return map
  }, [rows])

  /** Picking a warehouse fills the boxes with what is already stored for it, so
   *  saving without touching them is a no-op rather than a silent clear. */
  const pickWarehouse = (value: string) => {
    setWarehouseId(value)
    const row = byWarehouse.get(Number(value))
    setMinQty(row?.min_qty != null ? String(row.min_qty) : '')
    setMaxQty(row?.max_qty != null ? String(row.max_qty) : '')
    setErrors({})
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!warehouseId) e.warehouse = 'Choose the warehouse these levels are for'

    const min = levelOrNull(minQty)
    const max = levelOrNull(maxQty)
    if (minQty.trim() !== '' && min === null) e.minQty = 'Enter a number, or leave it blank'
    if (maxQty.trim() !== '' && max === null) e.maxQty = 'Enter a number, or leave it blank'
    if (min !== null && min < 0) e.minQty = 'A level cannot be negative'
    if (max !== null && max < 0) e.maxQty = 'A level cannot be negative'
    // The same refusal the backend gives, made before the request rather than
    // after it.
    if (min !== null && max !== null && min > max)
      e.minQty = 'The minimum level cannot be above the maximum.'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!canManage || !item) return
    if (!validate()) {
      reportInvalidForm()
      return
    }

    // Both keys always go up: the boxes were seeded from what is stored, so an
    // emptied one is somebody clearing a level and has to arrive as a null
    // rather than as an omission the server would read as "leave it alone".
    const payload: SaveItemLevelPayload = {
      warehouse_id: Number(warehouseId),
      min_qty: levelOrNull(minQty),
      max_qty: levelOrNull(maxQty),
    }

    const warehouseName = byWarehouse.get(Number(warehouseId))?.warehouse?.name ?? 'the warehouse'

    await run(
      {
        label: 'Saving item level',
        detail: `${item.name} · ${warehouseName}`,
        success: `Levels saved for ${warehouseName}.`,
      },
      () => saveLevel.mutateAsync(payload),
    )
  }

  const warehouseOptions = rows
    .filter((row) => row.warehouse?.id != null)
    .map((row) => ({
      value: String(row.warehouse!.id),
      label: row.warehouse!.is_depot
        ? `${row.warehouse!.name} — depot${row.warehouse!.salesman?.name ? `, ${row.warehouse!.salesman.name}` : ''}`
        : row.warehouse!.name,
    }))

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={item ? `Item levels — ${item.name}` : 'Item levels'}
      width="w-[640px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saveLevel.isPending}>
            Close
          </Button>
          {canManage && (
            <Button onClick={handleSubmit} loading={saveLevel.isPending}>
              Save level
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {canManage ? (
          <section className="flex flex-col gap-4">
            <h3 className={HEADING} style={HEADING_GLOW}>
              Set a level
            </h3>

            <SearchableSelect
              label="Warehouse"
              value={warehouseId}
              onChange={pickWarehouse}
              options={warehouseOptions}
              error={errors.warehouse}
              placeholder="Choose a warehouse or depot"
              searchPlaceholder="Search warehouses…"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Low level"
                type="number"
                min={0}
                step="any"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                error={errors.minQty}
                placeholder="No limit"
              />
              <Input
                label="Max level"
                type="number"
                min={0}
                step="any"
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)}
                error={errors.maxQty}
                placeholder="No limit"
              />
            </div>

            <p className="-mt-2 text-xs text-[var(--text-muted)]">
              Both are in base units and both may be left blank, which means no limit — nothing to
              be under or over. Zero is a level in its own right: it says this warehouse should not
              be carrying the line at all.
            </p>
          </section>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Levels are set by someone with permission to manage preferences. What each warehouse is
            supposed to hold is below.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h3 className={HEADING} style={HEADING_GLOW}>
            Every warehouse
          </h3>

          {isError ? (
            <ErrorState
              title="Couldn't load levels"
              message="The warehouses and their levels for this product couldn't be read."
              onRetry={() => refetch()}
            />
          ) : isLoading ? (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-3 py-3.5 last:border-0"
                >
                  <div className="h-4 flex-1 animate-pulse rounded bg-[var(--border-default)]" />
                  <div className="h-4 w-12 animate-pulse rounded bg-[var(--border-subtle)]" />
                  <div className="h-4 w-10 animate-pulse rounded bg-[var(--border-subtle)]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface-raised)]">
                    <th scope="col" className={`text-left ${HEAD_CELL}`}>
                      Warehouse
                    </th>
                    <th scope="col" className={`text-right ${HEAD_CELL}`}>
                      On hand
                    </th>
                    <th scope="col" className={`text-right ${HEAD_CELL}`}>
                      Low
                    </th>
                    <th scope="col" className={`text-right ${HEAD_CELL}`}>
                      Max
                    </th>
                    <th scope="col" className={`text-left ${HEAD_CELL}`} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const { belowMin, aboveMax } = levelBreach(row)
                    const pill = levelPill(row)
                    const selected = String(row.warehouse?.id ?? '') === warehouseId

                    return (
                      <tr
                        key={row.warehouse?.id ?? i}
                        className={[
                          'border-b border-[var(--border-subtle)] last:border-0',
                          selected ? 'bg-[var(--accent-primary)]/5' : '',
                        ].join(' ')}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--text-primary)]">
                              {row.warehouse?.name ?? 'Unknown location'}
                            </span>
                            {row.warehouse?.is_depot && <StatusPill status="live" label="Depot" />}
                          </div>
                          {row.warehouse?.is_depot && row.warehouse.salesman?.name && (
                            <div className="text-xs text-[var(--text-secondary)]">
                              {row.warehouse.salesman.name}
                            </div>
                          )}
                        </td>
                        {/* The figure the two levels are judged against, so it
                            carries the colour rather than the levels do. */}
                        <td
                          className={[
                            NUM_CELL,
                            'font-medium',
                            belowMin
                              ? 'text-[var(--accent-red)]'
                              : aboveMax
                                ? 'text-[var(--accent-amber)]'
                                : 'text-[var(--text-primary)]',
                          ].join(' ')}
                        >
                          {formatQty(row.qty)}
                        </td>
                        <td
                          className={[
                            NUM_CELL,
                            row.min_qty == null
                              ? 'text-[var(--text-muted)]'
                              : 'text-[var(--text-secondary)]',
                          ].join(' ')}
                        >
                          {levelLabel(row.min_qty)}
                        </td>
                        <td
                          className={[
                            NUM_CELL,
                            row.max_qty == null
                              ? 'text-[var(--text-muted)]'
                              : 'text-[var(--text-secondary)]',
                          ].join(' ')}
                        >
                          {levelLabel(row.max_qty)}
                        </td>
                        <td className="px-3 py-3">
                          {pill && <StatusPill status={pill.status} label={pill.label} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </SideDrawer>
  )
}
