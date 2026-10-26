import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Ban, ClipboardCheck, Printer, ShoppingCart, X } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton/LoadingSkeleton'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { usePermissions } from '@/core/auth/use-permissions'
import { useAuthStore } from '@/core/auth/auth-store'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useOrder, useOrderActions } from '../hooks/use-orders'
import { canCancel, canDecide, decidedBy, formatDay, formatLbp, formatMoney, orderPill, serverMessage } from '../orders-logic'
import { goodsStage } from '../order-stage'
import { OrderApproveDrawer } from '../components/OrderApproveDrawer'
import { RejectOrderModal } from '../components/RejectOrderModal'
import { OrderStageTrack } from '../components/OrderStageTrack'
import { OrderPrintSheet } from '../components/OrderPrintSheet'
import type { OrderLine } from '../types'

const HEADING = 'text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3'

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 truncate text-sm text-[var(--text-primary)]">{children}</div>
    </div>
  )
}

type Row = OrderLine & Record<string, unknown>

/**
 * One order on a page of its own, the way a load request has one: who it is
 * for, what is on it, how it was decided — and where its goods are.
 *
 * That last part is the one people ask about. Approving holds the goods in the
 * warehouse for the order; nothing moves to the salesman until he signs for
 * them on his load, so the page says which side of that line the order is on.
 */
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const orderId = Number(id)
  const { data: order, isLoading, isError, refetch } = useOrder(Number.isFinite(orderId) ? orderId : null)
  const { cancel } = useOrderActions()
  const { can } = usePermissions()
  const toast = useToast()
  const company = useAuthStore((state) => state.user?.company)
  const [reviewing, setReviewing] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const back = (
    <Button
      variant="ghost"
      icon={<ArrowLeft size={15} />}
      onClick={() => navigate(order?.status === 'SUBMITTED' ? '/order-requests' : '/orders')}
    >
      Back
    </Button>
  )

  if (isLoading) return <LoadingSkeleton />
  if (isError || !order) {
    return (
      <>
        <PageHeader title="Order" actions={back} />
        <ErrorState message="This order could not be loaded." onRetry={() => refetch()} />
      </>
    )
  }

  const pill = orderPill(order.status)
  const stage = goodsStage(order)
  const mayDecide = can(PERMISSIONS.ORDERS_APPROVE) && canDecide(order)
  const mayCancel = can(PERMISSIONS.ORDERS_CONFIRM) && canCancel(order)

  const cancelOrder = async () => {
    try {
      await cancel.mutateAsync(order.id)
      toast.success(`Order ${order.trs_number} cancelled`, stage.key === 'held' ? 'Its goods are free in the warehouse again.' : undefined)
    } catch (error) {
      toast.error('Not cancelled', serverMessage(error))
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'item_name',
      header: 'Product',
      render: (l) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">{l.item_name ?? `Item ${l.item_id}`}</div>
          <div className="font-mono text-xs text-[var(--text-muted)]">{l.item_code ?? ''}</div>
        </div>
      ),
    },
    { key: 'trs_qty', header: 'Ordered', render: (l) => `${l.trs_qty} ${l.uom_name ?? ''}` },
    { key: 'qty', header: 'Units', align: 'right', render: (l) => <span className="font-mono tabular-nums">{l.qty}</span> },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (l) => <span className="font-mono tabular-nums">{formatMoney(l.price * (l.unit || 1))}</span>,
    },
    {
      key: 'total',
      header: 'Value',
      align: 'right',
      render: (l) => <span className="font-mono tabular-nums text-[var(--text-primary)]">{formatMoney(l.total)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title={`Order #${order.trs_number}`}
        subtitle={`${order.customer.name ?? '—'} · taken ${order.trs_date ?? '—'}`}
        actions={
          <div className="flex items-center gap-2">
            {back}
            <Button variant="outline" icon={<Printer size={15} />} onClick={() => window.print()}>
              Print order
            </Button>
            {mayCancel && (
              <Button variant="outline" icon={<Ban size={15} />} loading={cancel.isPending} onClick={cancelOrder}>
                Cancel order
              </Button>
            )}
            {mayDecide && (
              <>
                <Button variant="outline" icon={<X size={15} />} onClick={() => setRejecting(true)}>
                  Reject
                </Button>
                <Button icon={<ClipboardCheck size={15} />} onClick={() => setReviewing(true)}>
                  Review &amp; approve
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusPill status={pill.status} label={pill.label} />
        <span className="text-sm text-[var(--text-secondary)]">{stage.sentence}</span>
      </div>

      <OrderStageTrack order={order} />

      {order.status === 'SUBMITTED' && order.hold_reasons.length > 0 && (
        <section className="mb-6 rounded-[var(--radius-card)] border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/8 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-amber)]">
            <AlertTriangle size={14} /> Waiting because
          </div>
          <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
            {order.hold_reasons.map((r) => <li key={r.code}>{r.message}</li>)}
          </ul>
        </section>
      )}
      {order.status === 'REJECTED' && order.rejected_reason && (
        <section className="mb-6 rounded-[var(--radius-card)] border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/8 p-4 text-sm text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--accent-red)]">Rejected: </span>
          {order.rejected_reason}
        </section>
      )}

      <section className="mb-6 rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Customer">
            {order.customer.name ?? '—'} <span className="font-mono text-xs text-[var(--text-muted)]">{order.customer.code ?? ''}</span>
          </Fact>
          <Fact label="Balance / limit">
            {formatMoney(order.customer.balance)}
            {order.customer.credit_limit > 0 ? ` of ${formatMoney(order.customer.credit_limit)}` : ' · no limit'}
          </Fact>
          <Fact label="Taken by">{order.salesman.name ?? '—'}</Fact>
          <Fact label="Decided">{decidedBy(order) ?? 'Not yet'}</Fact>
          <Fact label="From warehouse">{order.warehouse.name ?? '—'}</Fact>
          <Fact label="Delivery">{formatDay(order.delivery_date)}</Fact>
          <Fact label="Delivered by">{order.deliverer.name ?? '—'}</Fact>
          <Fact label="Memo">{order.memo || '—'}</Fact>
        </div>
      </section>

      <section>
        <h3 className={HEADING}>Products</h3>
        <DataTable
          columns={columns}
          data={(order.rows ?? []) as Row[]}
          keyField="id"
          emptyIcon={<ShoppingCart size={30} />}
          emptyMessage="This order has no products."
        />
        <div className="mt-3 flex items-baseline justify-end gap-4">
          <span className="text-sm text-[var(--text-muted)]">Total</span>
          <span className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">{formatMoney(order.total_price)}</span>
          <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">{formatLbp(order.total_price_lbp)}</span>
        </div>
      </section>

      {/* What the salesman asked for, beside what the office approved — the
          way a load issue sits beside its request. */}
      {order.requested_rows && (
        <section className="mt-8">
          <h3 className={HEADING}>Asked for by the salesman</h3>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            The office adjusted this order when approving it. These are the lines as they were requested.
          </p>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
            {order.requested_rows.map((line, i) => (
              <div
                key={`${line.item_id}-${i}`}
                className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-2.5 text-sm last:border-b-0"
              >
                <span className="min-w-0 truncate text-[var(--text-primary)]">
                  {line.item_name ?? '—'} <span className="font-mono text-xs text-[var(--text-muted)]">{line.item_code}</span>
                </span>
                <span className="font-mono tabular-nums text-[var(--text-muted)]">
                  {line.trs_qty} {line.uom_name ?? ''}
                </span>
              </div>
            ))}
          </div>
          {order.requested_total != null && (
            <div className="mt-3 flex items-baseline justify-end gap-4">
              <span className="text-sm text-[var(--text-muted)]">Asked total</span>
              <span className="font-mono text-sm tabular-nums text-[var(--text-muted)]">{formatMoney(order.requested_total)}</span>
            </div>
          )}
        </section>
      )}

      <OrderPrintSheet order={order} companyName={company || 'Salesly'} />
      <OrderApproveDrawer orderId={reviewing ? order.id : null} onClose={() => setReviewing(false)} />
      <RejectOrderModal order={order} open={rejecting} onClose={() => setRejecting(false)} />
    </>
  )
}
