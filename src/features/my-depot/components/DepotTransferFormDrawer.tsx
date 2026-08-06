import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, Trash2, Truck } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { useProducts } from '@/features/products/hooks/use-products'
import { useSalesmen } from '@/features/customers/hooks/use-customers'
import type { AdminItem } from '@/features/products/types'
import {
  useCreateDepotTransfer,
  useDepotDirectory,
  useDepotStock,
  useDepotTransfer,
  useDepotTransfers,
  useUpdateDepotTransfer,
  useWarehouseOptions,
} from '../hooks/use-my-depot'
import {
  formatQty,
  sourceAvailability,
  type CreateDepotTransferPayload,
  type DepotTransfer,
  type DepotTransferRowPayload,
} from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Null/undefined = a new load. Only a draft may be passed here. */
  transfer?: DepotTransfer | null
  /** An approved refill request this load answers — its salesman, its ends and
   *  its lines seed the form, and it is sent as `from_request_id` so the two
   *  documents stay chained. */
  fromRequest?: DepotTransfer | null
}

interface Row {
  itemId: string
  uomId: string
  qty: string
}

const blankRow = (): Row => ({ itemId: '', uomId: '', qty: '' })

/** How this product may be counted: its own base unit, plus every packaging
 *  declared for it. Anything else has no multiplier, so stock cannot move in
 *  it — the backend refuses the line rather than guessing. */
function packagingsOf(item: AdminItem): { uomId: number; label: string; unit: number }[] {
  const seen = new Set<number>()
  const list: { uomId: number; label: string; unit: number }[] = []

  for (const variant of item.uoms ?? []) {
    if (!variant.uom_id || seen.has(variant.uom_id)) continue
    seen.add(variant.uom_id)
    list.push({
      uomId: variant.uom_id,
      label: variant.uom?.name ?? 'Unit',
      unit: variant.unit || 1,
    })
  }

  if (item.uom_id && !seen.has(item.uom_id)) {
    list.unshift({ uomId: item.uom_id, label: item.uom ?? 'Base unit', unit: 1 })
  }

  return list
}

const HEADING = 'text-sm font-semibold tracking-wide text-[var(--heading-accent)]'
const HEADING_GLOW = { textShadow: '0 0 14px var(--heading-glow)' }

/**
 * Drafting a load out. A draft reserves the goods without moving them, so this
 * form is editable right up to the moment somebody presses Issue — and never
 * after, which is why it only ever opens on a draft.
 *
 * The salesman is asked first and his depot follows, because a load is
 * addressed to a person: the console should not have to know a warehouse id to
 * say who the goods are for. The same form keys the evening's return, where the
 * source is the depot and the destination the warehouse — nothing here names a
 * direction.
 */
export function DepotTransferFormDrawer({ open, onClose, transfer, fromRequest }: Props) {
  const isEdit = !!transfer
  const { run } = useActionProgress()
  const { data: products = [] } = useProducts()
  const { data: salesmen = [] } = useSalesmen()
  // The feed is where a depot names itself, so the pickers below are built from
  // it. Read here rather than passed in, so the cost lands only once this
  // drawer is in the tree — the list page has it cached either way.
  const { data: transfers = [] } = useDepotTransfers()
  const warehouses = useWarehouseOptions(transfers)
  const directory = useDepotDirectory(transfers)
  // The list resource is headers only; the lines come from the detail.
  const { data: detail } = useDepotTransfer(open && transfer ? transfer.id : null)
  const { data: requestDetail } = useDepotTransfer(open && fromRequest ? fromRequest.id : null)
  const createTransfer = useCreateDepotTransfer()
  const updateTransfer = useUpdateDepotTransfer()

  const [salesmanId, setSalesmanId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [memo, setMemo] = useState('')
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  /** Guards the detail seed: it must run once, or a refetch would wipe lines
   *  typed since. */
  const [seeded, setSeeded] = useState(false)

  const productsById = useMemo(() => {
    const map = new Map<number, AdminItem>()
    for (const item of products) map.set(item.id, item)
    return map
  }, [products])

  const source = sourceId ? Number(sourceId) : null
  // What the source can actually promise. Read for the source alone: the
  // destination's shelf has no say in what may leave the other warehouse.
  const { data: sourceStock } = useDepotStock(source, open && source != null)

  // The draft's own lines are handed back before the check, exactly as the
  // backend does — otherwise lowering a line on a load that swept the shelf
  // clean would be refused by stock this very load is holding.
  const available = useMemo(
    () => sourceAvailability(sourceStock?.items ?? [], isEdit ? (detail?.rows ?? []) : []),
    [sourceStock, isEdit, detail],
  )

  useEffect(() => {
    if (!open) return

    if (transfer) {
      setSalesmanId(transfer.salesman?.id != null ? String(transfer.salesman.id) : '')
      setSourceId(transfer.source?.id != null ? String(transfer.source.id) : '')
      setDestinationId(transfer.destination?.id != null ? String(transfer.destination.id) : '')
      setMemo(transfer.memo ?? '')
      setRows([blankRow()])
      setSeeded(false)
    } else if (fromRequest) {
      setSalesmanId(fromRequest.salesman?.id != null ? String(fromRequest.salesman.id) : '')
      setSourceId(fromRequest.source?.id != null ? String(fromRequest.source.id) : '')
      setDestinationId(
        fromRequest.destination?.id != null ? String(fromRequest.destination.id) : '',
      )
      setMemo('')
      setRows([blankRow()])
      setSeeded(false)
    } else {
      setSalesmanId('')
      setSourceId('')
      setDestinationId('')
      setMemo('')
      setRows([blankRow()])
      setSeeded(true)
    }

    setErrors({})
  }, [open, transfer, fromRequest])

  // Lines arrive with the detail, whether they are the draft's own or the ones
  // the warehouse agreed to on the request.
  useEffect(() => {
    if (!open || seeded) return
    const lines = (transfer ? detail : requestDetail)?.rows
    if (!lines) return

    setRows(
      lines.length === 0
        ? [blankRow()]
        : lines.map((line) => ({
            itemId: String(line.item_id),
            uomId: String(line.uom_id),
            qty: String(line.trs_qty),
          })),
    )
    setSeeded(true)
  }, [open, seeded, transfer, detail, requestDetail])

  const setRow = (index: number, changes: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...changes } : row)))

  const addRow = () => setRows((current) => [...current, blankRow()])
  const removeRow = (index: number) =>
    setRows((current) => current.filter((_, i) => i !== index))

  /** Picking a product resets the packaging to its base unit: the one it was
   *  showing belongs to the product that just left the row. */
  const pickItem = (index: number, value: string) => {
    const item = productsById.get(Number(value))
    const first = item ? packagingsOf(item)[0] : undefined
    setRow(index, { itemId: value, uomId: first ? String(first.uomId) : '' })
  }

  const resolvedDepot = salesmanId ? directory.get(Number(salesmanId))?.warehouse : undefined

  // Naming a warehouse outright wins; otherwise the load lands in the depot the
  // salesman holds, which the server resolves whether or not this console has
  // ever seen it.
  const landsIn = destinationId
    ? warehouses.find((w) => String(w.id) === destinationId)
    : resolvedDepot

  /** Base units this line comes to, and what the source has left for it. */
  const lineStock = (row: Row) => {
    const item = row.itemId ? productsById.get(Number(row.itemId)) : undefined
    if (!item) return null

    const packaging = packagingsOf(item).find((p) => String(p.uomId) === row.uomId)
    const unit = packaging?.unit ?? 1
    const wanted = Number(row.qty || 0) * unit
    const onHand = available.get(item.id) ?? 0

    return { item, unit, wanted, onHand, short: wanted > onHand }
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}

    if (!sourceId) e.source = 'Choose the warehouse the goods leave from'
    if (!salesmanId && !destinationId)
      e.destination = 'Name a salesman, or the warehouse the goods land in'
    if (sourceId && destinationId && sourceId === destinationId)
      e.destination = 'A transfer cannot start and end in the same warehouse'
    // The destination resolves server-side from the salesman, but only if he
    // has a depot; saying so here beats a 422 after the whole form is keyed.
    if (!destinationId && salesmanId && !resolvedDepot)
      e.destination = 'No depot on record for this salesman — name the warehouse yourself'

    const filled = rows.filter((row) => row.itemId || row.qty)
    if (filled.length === 0) e.rows = 'A load needs at least one line'

    rows.forEach((row, i) => {
      if (!row.itemId && !row.qty) return
      if (!row.itemId) e[`row-${i}-item`] = 'Choose a product'
      if (!row.uomId) e[`row-${i}-uom`] = 'Choose a packaging'
      if (row.qty === '' || Number.isNaN(Number(row.qty)) || Number(row.qty) <= 0)
        e[`row-${i}-qty`] = 'More than zero'

      // The same refusal the backend gives ("Insufficient stock for item X"),
      // made before the request rather than after it.
      const stock = lineStock(row)
      if (stock?.short) e[`row-${i}-qty`] = `Only ${formatQty(stock.onHand)} available`
    })

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const lines: DepotTransferRowPayload[] = rows
      .filter((row) => row.itemId && row.uomId && Number(row.qty) > 0)
      .map((row) => ({
        item_id: Number(row.itemId),
        uom_id: Number(row.uomId),
        qty: Number(row.qty),
      }))

    const payload: CreateDepotTransferPayload = {
      warehouse_id: Number(sourceId),
      salesman_id: salesmanId ? Number(salesmanId) : null,
      // Left off when the salesman settles it, so a load addressed to a person
      // keeps following him rather than pinning itself to a warehouse id this
      // console guessed.
      ...(destinationId ? { des_warehouse_id: Number(destinationId) } : {}),
      ...(fromRequest && !isEdit ? { from_request_id: fromRequest.id } : {}),
      memo: memo.trim(),
      rows: lines,
    }

    const label = isEdit ? 'Saving load' : 'Drafting load'
    const detailLine = landsIn?.name ?? undefined

    const saved = await run(
      {
        label,
        detail: detailLine,
        success: isEdit
          ? 'The load has been saved.'
          : 'The load is drafted — the goods are reserved until it goes out.',
      },
      () =>
        isEdit && transfer
          ? updateTransfer.mutateAsync({ id: transfer.id, payload })
          : createTransfer.mutateAsync(payload),
    )

    if (saved !== null) onClose()
  }

  const saving = createTransfer.isPending || updateTransfer.isPending

  const productOptions = products.map((item) => ({
    value: String(item.id),
    label: `${item.name} (${item.code})`,
  }))

  const warehouseOptions = warehouses.map((w) => ({
    value: String(w.id),
    label: w.is_depot
      ? `${w.name}${w.owner_name ? ` — ${w.owner_name}'s depot` : ' — depot'}`
      : (w.name ?? ''),
  }))

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit load' : fromRequest ? 'Load against a request' : 'New load'}
      width="w-[70%]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save draft' : 'Create draft'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h3 className={HEADING} style={HEADING_GLOW}>
            Where the goods go
          </h3>

          {fromRequest && (
            <p className="text-xs text-[var(--text-muted)]">
              Answering refill request{' '}
              <span className="font-mono text-[var(--text-secondary)]">
                {fromRequest.trs_number}
              </span>
              . Its lines are the starting point — every change you make here is a deliberate
              difference from what was agreed.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <SearchableSelect
              label="Salesman"
              value={salesmanId}
              onChange={setSalesmanId}
              options={salesmen.map((s) => ({ value: String(s.id), label: s.name }))}
              placeholder="Nobody in particular"
              searchPlaceholder="Search salesmen…"
            />
            <SearchableSelect
              label="From — the goods leave here"
              value={sourceId}
              onChange={setSourceId}
              options={warehouseOptions}
              error={errors.source}
              placeholder="Choose a warehouse"
              searchPlaceholder="Search warehouses…"
            />
            <SearchableSelect
              label="To — override the depot"
              value={destinationId}
              onChange={setDestinationId}
              options={warehouseOptions}
              error={errors.destination}
              placeholder={resolvedDepot?.name ?? 'The salesman’s depot'}
              searchPlaceholder="Search warehouses…"
            />
          </div>

          {/* Which warehouse the load actually lands in, spelled out. Nobody
              should have to know a salesman's depot by heart to send him
              anything. */}
          <div className="flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] px-3.5 py-2.5">
            {landsIn ? (
              <>
                <Truck
                  size={15}
                  aria-hidden
                  className="mt-0.5 flex-shrink-0 text-[var(--accent-primary)]"
                />
                <p className="text-sm text-[var(--text-secondary)]">
                  Lands in{' '}
                  <span className="font-medium text-[var(--text-primary)]">{landsIn.name}</span>
                  {landsIn.code ? (
                    <span className="font-mono text-xs text-[var(--text-muted)]"> {landsIn.code}</span>
                  ) : null}
                  {landsIn.is_depot ? ' — a depot.' : ' — a warehouse.'}
                </p>
              </>
            ) : (
              <>
                <AlertTriangle
                  size={15}
                  aria-hidden
                  className="mt-0.5 flex-shrink-0 text-[var(--accent-amber)]"
                />
                <p className="text-sm text-[var(--text-secondary)]">
                  {salesmanId
                    ? 'No depot on record for this salesman here — the server still resolves his own, or name the warehouse yourself.'
                    : 'Pick a salesman and his depot fills in, or name the warehouse outright.'}
                </p>
              </>
            )}
          </div>

          <Input
            label="Memo (optional)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Morning load, route 3"
          />
        </section>

        <section className="flex flex-col gap-3 border-t border-[var(--border-default)] pt-6">
          <div className="flex items-center justify-between">
            <h3 className={HEADING} style={HEADING_GLOW}>
              Lines
            </h3>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
            >
              <Plus size={13} /> Add line
            </button>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            {source
              ? 'The figure beside each line is what the source can still promise — anything already reserved by another load is gone from it.'
              : 'Choose the source warehouse and each line will show what it has left.'}
          </p>

          {errors.rows && <p className="text-xs text-[var(--accent-red)]">{errors.rows}</p>}

          {rows.map((row, i) => {
            const stock = lineStock(row)
            const item = row.itemId ? productsById.get(Number(row.itemId)) : undefined
            const packagings = item ? packagingsOf(item) : []

            return (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[14rem] flex-1">
                  <SearchableSelect
                    label={i === 0 ? 'Product' : undefined}
                    value={row.itemId}
                    onChange={(value) => pickItem(i, value)}
                    options={productOptions}
                    error={errors[`row-${i}-item`]}
                    placeholder="Choose a product"
                    searchPlaceholder="Search products…"
                  />
                </div>
                <div className="w-40">
                  <Select
                    label={i === 0 ? 'Packaging' : undefined}
                    value={row.uomId}
                    onChange={(e) => setRow(i, { uomId: e.target.value })}
                    error={errors[`row-${i}-uom`]}
                    placeholder="Unit"
                    options={packagings.map((p) => ({
                      value: String(p.uomId),
                      label: p.unit === 1 ? p.label : `${p.label} × ${formatQty(p.unit)}`,
                    }))}
                  />
                </div>
                <div className="w-28">
                  <Input
                    label={i === 0 ? 'Quantity' : undefined}
                    type="number"
                    min={0}
                    step="any"
                    value={row.qty}
                    onChange={(e) => setRow(i, { qty: e.target.value })}
                    error={errors[`row-${i}-qty`]}
                    placeholder="0"
                  />
                </div>

                {/* The source's headroom, and what this line takes out of it —
                    both in base units, since that is what stock is counted in
                    however the line was keyed. */}
                <div className="mb-2.5 w-40 text-xs">
                  {stock ? (
                    <>
                      <div
                        className={
                          stock.short
                            ? 'font-medium text-[var(--accent-red)]'
                            : 'text-[var(--text-secondary)]'
                        }
                      >
                        {formatQty(stock.onHand)} available
                      </div>
                      <div className="text-[var(--text-muted)]">
                        this line takes {formatQty(stock.wanted)}
                      </div>
                    </>
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </div>

                <button
                  type="button"
                  title="Remove line"
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => removeRow(i)}
                  className="mb-1 cursor-pointer rounded-[var(--radius-btn)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--accent-red)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </section>
      </div>
    </SideDrawer>
  )
}
