import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Store, XCircle } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { useProducts } from '@/features/products/hooks/use-products'
import { useSalesmen } from '@/features/customers/hooks/use-customers'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import type { AdminItem } from '@/features/products/types'
import { useOrder, useOrderActions, useOrderStock } from '../hooks/use-orders'
import { formatMoney, serverMessage } from '../orders-logic'
import { blankLine, lineFigures, type LineRow, type StockFigures } from '../order-lines'
import { OrderLinesEditor } from './OrderLinesEditor'
import { RejectOrderModal } from './RejectOrderModal'

interface Props {
  orderId: number | null
  onClose: () => void
}

const HEADING = 'text-sm font-semibold tracking-wide text-[var(--heading-accent)]'

/**
 * Deciding an order that waits, the way a load request is answered.
 *
 * It opens on what the salesman took and every line is editable: quantities
 * cut or raised, a packaging changed, products added or taken off, another
 * warehouse, day or deliverer. Approve saves those changes and approves in one
 * act — the server does both in one transaction, so an approval never stands
 * on lines that did not save. The rules' reasons stay in view the whole time.
 */
export function OrderApproveDrawer({ orderId, onClose }: Props) {
  const open = orderId != null
  const { data: order } = useOrder(orderId)
  // The whole catalogue, page by page: until it is in, the lines cannot be
  // read or priced, so the editor waits and Approve with it.
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: salesmen = [] } = useSalesmen()
  const { data: warehouses = [] } = useWarehouses()
  const { approve } = useOrderActions()
  const toast = useToast()

  const [warehouseId, setWarehouseId] = useState('')
  const [delivererId, setDelivererId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [memo, setMemo] = useState('')
  const [rows, setRows] = useState<LineRow[]>([blankLine()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [seededFor, setSeededFor] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState(false)

  // Seeded once per order: a refetch must not wipe what the manager has typed.
  useEffect(() => {
    if (!order || seededFor === order.id) return
    setWarehouseId(order.warehouse.id != null ? String(order.warehouse.id) : '')
    setDelivererId(order.deliverer.id != null ? String(order.deliverer.id) : '')
    setDeliveryDate(order.delivery_date ?? '')
    setMemo(order.memo ?? '')
    setRows(
      (order.rows ?? []).length === 0
        ? [blankLine()]
        : (order.rows ?? []).map((line) => ({
            itemId: String(line.item_id),
            uomId: line.uom_id != null ? String(line.uom_id) : '',
            qty: String(line.trs_qty),
          })),
    )
    setErrors({})
    setSeededFor(order.id)
  }, [order, seededFor])

  const productsById = useMemo(() => {
    const map = new Map<number, AdminItem>()
    for (const item of products) map.set(item.id, item)
    return map
  }, [products])

  const { data: stockLines = [] } = useOrderStock(order?.customer.id ?? null, warehouseId ? Number(warehouseId) : null)
  const stock: StockFigures = useMemo(
    () => new Map(stockLines.map((line) => [line.item_id, { available: line.available_qty, price: line.price }])),
    [stockLines],
  )

  const total = rows.reduce((sum, row) => sum + (lineFigures(row, productsById, stock)?.value ?? 0), 0)
  const sources = warehouses.filter((w) => !w.is_depot)

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    const filled = rows.filter((row) => row.itemId || row.qty)
    if (filled.length === 0) e.rows = 'An order needs at least one product'
    rows.forEach((row, i) => {
      if (!row.itemId && !row.qty) return
      if (!row.itemId) e[`row-${i}-item`] = 'Choose a product'
      if (!(Number(row.qty) > 0)) e[`row-${i}-qty`] = 'More than zero'
      const figures = lineFigures(row, productsById, stock)
      if (figures?.short) e[`row-${i}-qty`] = `Only ${figures.onHand} available`
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!order || !validate()) return
    try {
      await approve.mutateAsync({
        id: order.id,
        changes: {
          rows: rows
            .filter((row) => row.itemId && row.uomId && Number(row.qty) > 0)
            .map((row) => ({ item_id: Number(row.itemId), uom_id: Number(row.uomId), qty: Number(row.qty) })),
          warehouse_id: warehouseId ? Number(warehouseId) : null,
          deliverer_id: delivererId ? Number(delivererId) : null,
          delivery_date: deliveryDate || null,
          memo: memo.trim(),
        },
      })
      toast.success(`Order ${order.trs_number} approved`, 'Its goods are held in the warehouse for the delivery.')
      onClose()
    } catch (error) {
      toast.error('Not approved', serverMessage(error))
    }
  }

  return (
    <>
      <SideDrawer
        open={open}
        onClose={onClose}
        title={order ? `Approve order #${order.trs_number}` : 'Approve order'}
        width="w-[50%]"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={approve.isPending}>Cancel</Button>
            <Button variant="outline" onClick={() => setRejecting(true)} disabled={!order || approve.isPending}>
              <XCircle size={15} /> Reject
            </Button>
            <Button onClick={submit} loading={approve.isPending} disabled={!order || productsLoading}>
              <CheckCircle2 size={15} /> Approve order
            </Button>
          </>
        }
      >
        {!order ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">Loading…</p>
        ) : (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4">
              <h3 className={HEADING}>The order</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Taken {order.trs_date ?? '—'} by {order.salesman.name ?? '—'}. Its products are the starting point —
                every change you make here is what the shop gets.
              </p>

              <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-default)] p-3">
                <Store size={18} className="text-[var(--text-muted)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[var(--text-primary)]">{order.customer.name ?? '—'}</div>
                  <div className="text-xs text-[var(--text-muted)]">{order.customer.code ?? ''}</div>
                </div>
                <div className="text-right text-xs text-[var(--text-muted)]">
                  Balance <span className="font-mono text-[var(--text-primary)]">{formatMoney(order.customer.balance)}</span>
                  {order.customer.credit_limit > 0 && <div>limit {formatMoney(order.customer.credit_limit)}</div>}
                </div>
              </div>

              {order.hold_reasons.length > 0 && (
                <div className="rounded-[var(--radius-card)] border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/8 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-amber)]">
                    <AlertTriangle size={14} /> Waiting because
                  </div>
                  <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                    {order.hold_reasons.map((r) => <li key={r.code}>{r.message}</li>)}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <SearchableSelect
                  label="From — the goods leave here"
                  value={warehouseId}
                  onChange={setWarehouseId}
                  options={sources.map((w) => ({ value: String(w.id), label: w.name }))}
                  placeholder="The main warehouse"
                  searchPlaceholder="Search warehouses…"
                />
                <Input label="Delivery day" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                <SearchableSelect
                  label="Delivered by"
                  value={delivererId}
                  onChange={setDelivererId}
                  options={salesmen.map((s) => ({ value: String(s.id), label: s.name }))}
                  placeholder="The salesman"
                  searchPlaceholder="Search salesmen…"
                />
              </div>
              <Input label="Memo (optional)" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </section>

            <section className="border-t border-[var(--border-default)] pt-6">
              {productsLoading ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">Loading products…</p>
              ) : (
                <OrderLinesEditor
                  rows={rows}
                  onChange={setRows}
                  products={products}
                  productsById={productsById}
                  stock={stock}
                  errors={errors}
                />
              )}
              <div className="mt-4 flex items-baseline justify-between rounded-[var(--radius-card)] border border-[var(--border-subtle)] px-4 py-3">
                <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">This order, priced for the shop</span>
                <span className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">{formatMoney(total)}</span>
              </div>
            </section>
          </div>
        )}
      </SideDrawer>

      <RejectOrderModal order={order ?? null} open={rejecting} onClose={() => setRejecting(false)} onRejected={onClose} />
    </>
  )
}
