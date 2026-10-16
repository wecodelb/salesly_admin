import { AlertTriangle, ClipboardCheck, Store, Truck } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { useToast } from '@/shared/hooks/use-toast'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useOrder, useOrderActions } from '../hooks/use-orders'
import { canCancel, canDecide, decidedBy, formatDay, formatLbp, formatMoney, orderPill, serverMessage } from '../orders-logic'

interface Props {
  orderId: number | null
  onClose: () => void
  /** Opens the approve drawer, where a waiting order is adjusted and decided. */
  onReview?: () => void
}

/**
 * One order, opened from the list: who it is for, what is on it, why it
 * waits, and how it was decided. Reading only — a waiting order is decided in
 * the approve drawer, where its lines can be adjusted the way a load request's
 * are; Review & approve opens it.
 */
export function OrderDrawer({ orderId, onClose, onReview }: Props) {
  const { data: order, isLoading } = useOrder(orderId)
  const { cancel } = useOrderActions()
  const { can } = usePermissions()
  const toast = useToast()

  const mayApprove = can(PERMISSIONS.ORDERS_APPROVE)
  const mayCancel = can(PERMISSIONS.ORDERS_CONFIRM)

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action()
      toast.success(done)
    } catch (error) {
      toast.error('Not done', serverMessage(error))
    }
  }

  const pill = order ? orderPill(order.status) : null
  const decision = order ? decidedBy(order) : null

  const footer = order && (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {mayCancel && canCancel(order) && (
        <Button
          variant="ghost"
          loading={cancel.isPending}
          onClick={() => run(() => cancel.mutateAsync(order.id), `Order ${order.trs_number} cancelled`)}
        >
          Cancel order
        </Button>
      )}
      {mayApprove && canDecide(order) && onReview && (
        <Button onClick={onReview}>
          <ClipboardCheck size={15} /> Review &amp; approve
        </Button>
      )}
    </div>
  )

  return (
    <>
      <SideDrawer
        open={orderId != null}
        onClose={onClose}
        title={order ? `Order #${order.trs_number}` : 'Order'}
        width="w-[520px]"
        footer={footer}
      >
        {isLoading || !order ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--text-muted)]">
                Taken {order.trs_date ?? '—'} by {order.salesman.name ?? '—'}
              </div>
              {pill && <StatusPill status={pill.status} label={pill.label} />}
            </div>

            {/* The customer, with what they already owe beside the limit. */}
            <section className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-default)] p-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-raised)] text-[var(--text-muted)]">
                <Store size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[var(--text-primary)]">{order.customer.name ?? '—'}</div>
                <div className="text-xs text-[var(--text-muted)]">{order.customer.code ?? ''}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-[var(--text-muted)]">Balance</div>
                <div className="font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatMoney(order.customer.balance)}
                </div>
                {order.customer.credit_limit > 0 && (
                  <div className="text-[11px] text-[var(--text-muted)]">limit {formatMoney(order.customer.credit_limit)}</div>
                )}
              </div>
            </section>

            {/* Why it waits — or what a manager approved in spite of. */}
            {order.hold_reasons.length > 0 && (
              <section className="rounded-[var(--radius-card)] border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/8 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-amber)]">
                  <AlertTriangle size={14} />
                  {order.status === 'SUBMITTED' ? 'Waiting because' : 'Held because'}
                </div>
                <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                  {order.hold_reasons.map((r) => (
                    <li key={r.code}>{r.message}</li>
                  ))}
                </ul>
              </section>
            )}

            {order.status === 'REJECTED' && order.rejected_reason && (
              <section className="rounded-[var(--radius-card)] border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/8 p-3 text-sm text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--accent-red)]">Rejected: </span>
                {order.rejected_reason}
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Line items</h3>
              <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-default)]">
                {(order.rows ?? []).map((line) => (
                  <div key={line.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-[var(--text-primary)]">{line.item_name ?? `Item ${line.item_id}`}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {line.trs_qty} {line.uom_name ?? ''} · {formatMoney(line.price * (line.unit || 1))} each
                      </div>
                    </div>
                    <div className="font-mono text-sm tabular-nums text-[var(--text-primary)]">{formatMoney(line.total)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Total</span>
                <div className="text-right">
                  <div className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">{formatMoney(order.total_price)}</div>
                  <div className="font-mono text-xs tabular-nums text-[var(--text-muted)]">{formatLbp(order.total_price_lbp)}</div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Truck size={13} /> Delivery
                </div>
                <div className="font-medium text-[var(--text-primary)]">{formatDay(order.delivery_date)}</div>
                <div className="text-xs text-[var(--text-muted)]">by {order.deliverer.name ?? '—'}</div>
              </div>
              <div className="rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] p-3">
                <div className="mb-1 text-xs text-[var(--text-muted)]">From</div>
                <div className="font-medium text-[var(--text-primary)]">{order.warehouse.name ?? '—'}</div>
                {decision && <div className="text-xs text-[var(--text-muted)]">{decision}</div>}
              </div>
            </section>

            {order.invoice && (
              <p className="text-xs text-[var(--text-muted)]">
                Delivered as invoice #{order.invoice.trs_number} on {order.invoice.trs_date}.
              </p>
            )}
          </div>
        )}
      </SideDrawer>

    </>
  )
}
