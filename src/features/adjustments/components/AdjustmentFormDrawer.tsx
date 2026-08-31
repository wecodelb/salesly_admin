import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { useProducts } from '@/features/products/hooks/use-products'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import {
  useAdjustmentTypes,
  useCreateAdjustment,
  useUpdateAdjustment,
} from '../hooks/use-adjustments'
import {
  directionOptions,
  rowsOf,
  type Adjustment,
  type AdjustmentRowPayload,
  type AdjustmentType,
} from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** null/undefined = writing a new sheet. */
  adjustment?: Adjustment | null
}

interface RowState {
  /** Local only, so React can key rows that have no id yet. */
  key: string
  typeId: string
  itemId: string
  qty: string
  direction: string
  memo: string
}

const today = () => new Date().toISOString().slice(0, 10)

/** A blank row. Keyed by index so two identical blank rows stay distinct. */
const blankRow = (seq: number): RowState => ({
  key: `row-${seq}`,
  typeId: '',
  itemId: '',
  qty: '',
  direction: '',
  memo: '',
})

/**
 * Writing an adjustment sheet.
 *
 * The warehouse is picked once, for the sheet: every row moves stock in the
 * same place, and a sheet spanning two warehouses is two sheets.
 *
 * Each row picks its own type, which is what lets one sheet carry two damaged
 * crates and an expired pallet — the way a warehouse actually works through a
 * morning. The direction control appears only for a type that allows both;
 * where the type has already decided, showing a choice would be offering a
 * mistake, because the server refuses a row that contradicts its type.
 */
export function AdjustmentFormDrawer({ open, onClose, adjustment }: Props) {
  const editing = adjustment != null
  const { run } = useActionProgress()

  const { data: warehouses = [] } = useWarehouses()
  const { data: products = [] } = useProducts()
  // Only the live ones: a drawer offering a switched-off type is offering a
  // refusal.
  const { data: types = [] } = useAdjustmentTypes(true)

  const createAdjustment = useCreateAdjustment()
  const updateAdjustment = useUpdateAdjustment()

  const [warehouseId, setWarehouseId] = useState('')
  const [adjustedAt, setAdjustedAt] = useState(today())
  const [memo, setMemo] = useState('')
  const [rows, setRows] = useState<RowState[]>([blankRow(0)])
  const [seq, setSeq] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const typeById = useMemo(
    () => new Map(types.map((t) => [String(t.id), t] as const)),
    [types],
  )

  useEffect(() => {
    if (!open) return

    if (adjustment) {
      setWarehouseId(String(adjustment.warehouse_id ?? ''))
      setMemo(adjustment.memo ?? '')
      const existing = rowsOf(adjustment).map((row, i) => ({
        key: `row-${i}`,
        typeId: String(row.adjustment_type_id),
        itemId: String(row.item_id),
        // Shown in the packaging it was counted in, which is what somebody
        // wrote down — not the base units it became.
        qty: String(row.trs_qty),
        direction: row.direction,
        memo: row.memo ?? '',
      }))
      setRows(existing.length > 0 ? existing : [blankRow(0)])
      setSeq(existing.length || 1)
    } else {
      setWarehouseId(warehouses.find((w) => w.is_main)?.id?.toString() ?? '')
      setAdjustedAt(today())
      setMemo('')
      setRows([blankRow(0)])
      setSeq(1)
    }
    setErrors({})
  }, [open, adjustment, warehouses])

  const setRow = (key: string, patch: Partial<RowState>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const addRow = () => {
    setRows((prev) => [...prev, blankRow(seq)])
    setSeq((n) => n + 1)
  }

  const removeRow = (key: string) =>
    // Never down to nothing: a sheet with no rows says nothing, and an empty
    // drawer looks broken rather than empty.
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)))

  /** The direction a row will actually take, given its type. */
  const resolvedDirection = (row: RowState): string => {
    const type = typeById.get(row.typeId)
    if (!type) return ''
    if (type.direction !== 'both') return type.direction

    return row.direction
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}

    if (!warehouseId) next.warehouseId = 'Pick the warehouse this is about'

    rows.forEach((row, i) => {
      if (!row.typeId) next[`${row.key}.type`] = 'Pick a type'
      if (!row.itemId) next[`${row.key}.item`] = 'Pick a product'

      const qty = Number(row.qty)
      if (!row.qty || !Number.isFinite(qty) || qty <= 0) {
        next[`${row.key}.qty`] = 'More than nothing'
      }

      // Only a type that allows both leaves this to the row.
      if (row.typeId && !resolvedDirection(row)) {
        next[`${row.key}.direction`] = 'In or out?'
      }

      void i
    })

    setErrors(next)

    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!validate()) return

    const payload = {
      warehouse_id: Number(warehouseId),
      adjusted_at: adjustedAt || undefined,
      memo: memo.trim(),
      rows: rows.map((row): AdjustmentRowPayload => {
        const type = typeById.get(row.typeId)

        return {
          adjustment_type_id: Number(row.typeId),
          item_id: Number(row.itemId),
          qty: Number(row.qty),
          // Sent only where the type leaves the choice open. Sending it for a
          // one-way type is a contradiction the server refuses.
          direction: type?.direction === 'both' ? (row.direction as 'in' | 'out') : undefined,
          memo: row.memo.trim() || undefined,
        }
      }),
    }

    await run(
      {
        label: editing ? 'Saving adjustment' : 'Writing adjustment',
        // Deliberately not "stock updated": whether it moves depends on whether
        // the writer may approve, and promising the shelf changed when it has
        // not is the one thing this screen must not do.
        success: editing ? 'The sheet was saved.' : 'The sheet was written.',
      },
      () =>
        editing
          ? updateAdjustment.mutateAsync({ id: adjustment!.id, payload })
          : createAdjustment.mutateAsync(payload),
    )

    onClose()
  }

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={editing ? `Adjustment #${adjustment?.number}` : 'New adjustment'}
      width="w-[680px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? 'Save' : 'Write it down'}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <SearchableSelect
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            error={errors.warehouseId}
            options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
            placeholder="Which shelf is this about?"
            searchPlaceholder="Search warehouses…"
          />
          <Input
            label="Date"
            type="date"
            value={adjustedAt}
            onChange={(e) => setAdjustedAt(e.target.value)}
          />
        </div>

        <Input
          label="Note"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Why, in a few words — this is what somebody reads in six months"
        />

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            What moved
          </h3>
          <Button variant="ghost" icon={<Plus size={14} />} onClick={addRow}>
            Add row
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const type = typeById.get(row.typeId)
            const choices = directionOptions(type)
            const fixed = type && type.direction !== 'both'

            return (
              <div
                key={row.key}
                className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-3"
              >
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Select
                      label="Type"
                      value={row.typeId}
                      onChange={(e) =>
                        setRow(row.key, { typeId: e.target.value, direction: '' })
                      }
                      error={errors[`${row.key}.type`]}
                      placeholder="Pick a type…"
                      options={types.map((t: AdjustmentType) => ({
                        value: String(t.id),
                        label: t.name,
                      }))}
                    />
                  </div>

                  <div className="col-span-4">
                    {/* A type that only goes one way has already decided, so the
                        control is a statement rather than a choice. */}
                    {fixed ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-[var(--text-muted)]">
                          Direction
                        </span>
                        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                          {type!.direction === 'out' ? 'Out — always' : 'In — always'}
                        </div>
                      </div>
                    ) : (
                      <Select
                        label="Direction"
                        value={row.direction}
                        onChange={(e) => setRow(row.key, { direction: e.target.value })}
                        error={errors[`${row.key}.direction`]}
                        disabled={!row.typeId}
                        placeholder="In or out…"
                        options={choices.map((c) => ({ value: c.value, label: c.label }))}
                      />
                    )}
                  </div>

                  <div className="col-span-3">
                    <Input
                      label="Quantity"
                      type="number"
                      min="0"
                      step="any"
                      value={row.qty}
                      onChange={(e) => setRow(row.key, { qty: e.target.value })}
                      error={errors[`${row.key}.qty`]}
                    />
                  </div>

                  <div className="col-span-12">
                    <SearchableSelect
                      label="Product"
                      value={row.itemId}
                      onChange={(v) => setRow(row.key, { itemId: v })}
                      error={errors[`${row.key}.item`]}
                      options={products.map((p) => ({
                        value: String(p.id),
                        label: `${p.code} — ${p.name}`,
                      }))}
                      placeholder="Which product?"
                      searchPlaceholder="Search products…"
                    />
                  </div>

                  <div className="col-span-10">
                    <Input
                      label="Row note"
                      value={row.memo}
                      onChange={(e) => setRow(row.key, { memo: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-span-2 flex items-end justify-end pb-1">
                    <button
                      type="button"
                      title="Remove this row"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length === 1}
                      className="rounded-[var(--radius-btn)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--accent-red)] disabled:opacity-30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </SideDrawer>
  )
}
