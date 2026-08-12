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
  useApproveLoadRequest,
  useCreateDepotTransfer,
  useDepotDirectory,
  useDepotStock,
  useDepotTransfer,
  useDepotTransfers,
  useUpdateDepotTransfer,
  useWarehouseOptions,
} from '../hooks/use-my-depot'
import { CapacityBar } from './CapacityBar'
import {
  VOLUME_UNIT,
  WEIGHT_UNIT,
  depotUtilisation,
  formatQty,
  formatVolume,
  formatWeight,
  isPendingRequest,
  loadTotals,
  sourceAvailability,
  withLoad,
  type CreateDepotTransferPayload,
  type DepotTransfer,
  type DepotTransferRowPayload,
} from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Null/undefined = a new load. Only a draft may be passed here. */
  transfer?: DepotTransfer | null
  /** An approved load request this load answers — its salesman, its ends and
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
  // `isLoading` rather than a bare list: an empty catalogue and a catalogue still
  // arriving look identical in the picker, and "Choose a product" over an empty
  // dropdown reads as "this company has no products".
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: salesmen = [] } = useSalesmen()
  // The feed is where a depot names itself, so the pickers below are built from
  // it. Read here rather than passed in, so the cost lands only once this
  // drawer is in the tree — the list page has it cached either way.
  const { data: transfers = [] } = useDepotTransfers()
  const warehouses = useWarehouseOptions(transfers)
  // The company's own warehouse, which every load comes out of unless somebody
  // names another. Read off the same list the picker is built from, so the
  // pre-filled value is always one of its options.
  const mainWarehouseId = useMemo(
    () => warehouses.find((w) => (w as { is_main?: boolean }).is_main)?.id ?? null,
    [warehouses],
  )
  const directory = useDepotDirectory(transfers)
  // The list resource is headers only; the lines come from the detail.
  const { data: detail } = useDepotTransfer(open && transfer ? transfer.id : null)
  const { data: requestDetail } = useDepotTransfer(open && fromRequest ? fromRequest.id : null)
  const createTransfer = useCreateDepotTransfer()
  const approveRequest = useApproveLoadRequest()
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
      // A salesman asking for a load rarely says where it should come out of,
      // so this is usually empty — and the effect below then fills it with the
      // main warehouse, the same fallback the backend applies when the field
      // arrives unset.
      setSourceId(fromRequest.source?.id != null ? String(fromRequest.source.id) : '')
      setDestinationId(
        fromRequest.destination?.id != null ? String(fromRequest.destination.id) : '',
      )
      setMemo('')
      setRows([blankRow()])
      setSeeded(false)
    } else {
      setSalesmanId('')
      // Left blank here and filled by the effect below, which is the only place
      // that knows whether the warehouses have arrived yet.
      setSourceId('')
      setDestinationId('')
      setMemo('')
      setRows([blankRow()])
      setSeeded(true)
    }

    setErrors({})
  }, [open, transfer, fromRequest])

  // Goods come out of the main warehouse unless somebody says otherwise, which
  // is true of nearly every load — so the field starts filled rather than
  // asking a question that has the same answer almost every time.
  //
  // It lives in its own effect because the warehouses usually arrive after the
  // drawer has opened, and because the guard on an empty field is what stops it
  // ever taking back a source somebody has just chosen. Editing an existing
  // load is left alone: its source is a fact, not a default.
  useEffect(() => {
    if (!open || isEdit || sourceId !== '' || !mainWarehouseId) return
    setSourceId(String(mainWarehouseId))
  }, [open, isEdit, sourceId, mainWarehouseId])

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

  // What is actually being strapped on. An item declares weight and volume per
  // base unit, so a line contributes its base quantity times that figure —
  // which is the arithmetic the server totals the document with, so this figure
  // and the one that comes back agree.
  const load = loadTotals(
    rows.map((row) => {
      const stock = lineStock(row)
      return { qty: stock?.wanted ?? 0, weight: stock?.item.weight, volume: stock?.item.volume }
    }),
  )

  const lineCount = rows.filter((row) => row.itemId && Number(row.qty) > 0).length

  // Where it is going, and what is already on it. A draft holds goods at the
  // source without moving them, so nothing here is double-counted while it is
  // being edited: it joins the depot's figures only once it is issued.
  const landsInId = landsIn?.id ?? null
  const { data: destinationStock } = useDepotStock(landsInId, open && landsInId != null)
  const destination = depotUtilisation(destinationStock, transfers)
  const afterWeight = withLoad(destination.weight, load.weight)
  const afterVolume = withLoad(destination.volume, load.volume)
  const overCapacity = afterWeight.over || afterVolume.over

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
    if (filled.length === 0) e.rows = 'A load needs at least one product'

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

    const label = isEdit ? 'Saving load' : 'Creating load'
    const detailLine = landsIn?.name ?? undefined

    // Answering a request and building its load are one action now, so the
    // approval happens here rather than as a button of its own. The server
    // refuses `from_request_id` on a request nobody has approved, which is
    // exactly the check being satisfied — not worked around.
    const needsApproval = !isEdit && fromRequest != null && isPendingRequest(fromRequest)

    const saved = await run(
      {
        label,
        detail: detailLine,
        success: isEdit
          ? 'The load has been saved.'
          : 'The load is created — the goods are reserved until it goes out.',
      },
      async () => {
        if (isEdit && transfer) {
          return updateTransfer.mutateAsync({ id: transfer.id, payload })
        }
        // Approve first, and let a failure here stop the whole thing: a load
        // created against an unapproved request is the one state the two
        // documents must never be left in.
        if (needsApproval) await approveRequest.mutateAsync(fromRequest.id)
        return createTransfer.mutateAsync(payload)
      },
    )

    if (saved !== null) onClose()
  }

  const saving =
    createTransfer.isPending || updateTransfer.isPending || approveRequest.isPending

  const productOptions = products.map((item) => ({
    value: String(item.id),
    label: `${item.name} (${item.code})`,
  }))

  // Depots are named after the salesman who drives them, so the owner is only
  // worth appending when the name has not said it already — otherwise the
  // picker reads "Ahmad Khalil depot — Ahmad Khalil's depot".
  const warehouseOptions = warehouses.map((w) => {
    const name = w.name ?? ''
    const owner = w.owner_name ?? ''
    const saysOwner = owner !== '' && name.toLowerCase().includes(owner.toLowerCase())

    return {
      value: String(w.id),
      label: !w.is_depot || saysOwner || owner === ''
        ? name
        : `${name} — ${owner}`,
    }
  })

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit load' : fromRequest ? 'Load against a request' : 'Create load'}
      width="w-[50%]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {/* "Create load", not "Create draft". What the button produces is a
              load with goods reserved against it; "draft" described the row in
              the table and told the person pressing it nothing. */}
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save load' : 'Create load'}
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
              Answering load request{' '}
              <span className="font-mono text-[var(--text-secondary)]">
                {fromRequest.trs_number}
              </span>
              . Its products are the starting point — every change you make here is a deliberate
              difference from what was agreed.
            </p>
          )}

          {/* Two questions, not three. Naming the salesman has already named
              the destination — his depot is the only place a load addressed to
              him can land — so a third picker offering to override it invited a
              mistake nobody had a reason to make, and asked the console to know
              a warehouse id it had just been told. The resolved depot is shown
              below instead of being editable. */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <SearchableSelect
              label="Salesman"
              value={salesmanId}
              onChange={setSalesmanId}
              options={salesmen.map((s) => ({ value: String(s.id), label: s.name }))}
              error={errors.destination}
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
              Products
            </h3>
            <button
              type="button"
              onClick={addRow}
              disabled={productsLoading}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={13} /> Add product
            </button>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            {source
              ? 'The figure beside each product is what the source can still promise — anything already reserved by another load is gone from it.'
              : 'Choose the source warehouse and each product will show what it has left.'}
          </p>

          {errors.rows && <p className="text-xs text-[var(--accent-red)]">{errors.rows}</p>}

          {/* Shown in place of the rows while the catalogue is on its way. The
              pickers are useless until it lands — every one of them would be an
              empty dropdown — and skeleton rows say "arriving" where an empty
              dropdown says "there is nothing here". */}
          {productsLoading ? (
            <ProductRowsSkeleton />
          ) : (
          rows.map((row, i) => {
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
                        this product takes {formatQty(stock.wanted)}
                      </div>
                    </>
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </div>

                <button
                  type="button"
                  title="Remove product"
                  aria-label={`Remove product ${i + 1}`}
                  onClick={() => removeRow(i)}
                  className="mb-1 cursor-pointer rounded-[var(--radius-btn)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--accent-red)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })
          )}

          {/* What he will be carrying, and whether it fits. Both figures move as
              products are keyed, because the moment to find out the vehicle is too
              small is while the load is still on paper. */}
          <div className="mt-2 flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] px-4 py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                This load{landsIn?.name ? ` → ${landsIn.name}` : ''}
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {formatWeight(load.weight)}
                </span>{' '}
                {WEIGHT_UNIT} ·{' '}
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {formatVolume(load.volume)}
                </span>{' '}
                {VOLUME_UNIT} across {lineCount} {lineCount === 1 ? 'product' : 'products'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <CapacityBar
                label="Weight after this load"
                usage={afterWeight}
                format={formatWeight}
                unit={WEIGHT_UNIT}
                incomingNote="on the road and in this load"
              />
              <CapacityBar
                label="Volume after this load"
                usage={afterVolume}
                format={formatVolume}
                unit={VOLUME_UNIT}
                incomingNote="on the road and in this load"
              />
            </div>

            {/* A warning and never a refusal: the cap was typed by somebody who
                is not standing at the vehicle, and a man who genuinely fits one
                more pallet on must not be stopped by it. */}
            {overCapacity && (
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={15}
                  aria-hidden
                  className="mt-0.5 flex-shrink-0 text-[var(--accent-amber)]"
                />
                <p className="text-sm text-[var(--accent-amber)]">
                  This puts {landsIn?.name ?? 'the depot'} past what it is recorded as carrying.
                  Save it anyway if it really fits — nothing here blocks the load — or take a
                  product off first.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </SideDrawer>
  )
}

/**
 * Placeholder rows while the product catalogue is on its way.
 *
 * Shaped like the real row — product, packaging, quantity, the delete button —
 * rather than using the generic list skeleton, so the section does not change
 * layout when the data lands. A skeleton that reflows on arrival reads as the
 * page breaking rather than the page filling in.
 */
function ProductRowsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading products…</span>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-wrap items-end gap-3 animate-pulse">
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            {/* Only the first row carries field labels in the real markup. */}
            {i === 0 && <div className="h-2.5 w-14 rounded bg-[var(--border-subtle)]" />}
            <div className="h-9 rounded-[var(--radius-btn)] bg-[var(--border-default)]" />
          </div>
          <div className="w-40 space-y-1.5">
            {i === 0 && <div className="h-2.5 w-16 rounded bg-[var(--border-subtle)]" />}
            <div className="h-9 rounded-[var(--radius-btn)] bg-[var(--border-default)]" />
          </div>
          <div className="w-28 space-y-1.5">
            {i === 0 && <div className="h-2.5 w-10 rounded bg-[var(--border-subtle)]" />}
            <div className="h-9 rounded-[var(--radius-btn)] bg-[var(--border-default)]" />
          </div>
          <div className="mb-1 h-8 w-8 rounded-[var(--radius-btn)] bg-[var(--border-subtle)]" />
        </div>
      ))}
    </div>
  )
}
