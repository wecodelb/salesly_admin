import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Store, Truck, XCircle } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Modal } from '@/shared/components/Modal/Modal'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { useToast } from '@/shared/hooks/use-toast'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useOrder, useOrderActions } from '../hooks/use-orders'
import { canCancel, canDecide, decidedBy, formatDay, formatLbp, formatMoney, orderPill } from '../orders-logic'

interface Props {
  orderId: number | null
  onClose: () => void
}

/** The server's validation message, whatever key it came under. */
function messageOf(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string; data?: Record<string, string[]> } } })?.response?.data
  const first = data?.data ? Object.values(data.data).flat()[0] : undefined
  return first ?? data?.message ?? 'Something went wrong.'
}

/**
 * One order, opened from the list: who it is for, what is on it, why it waits,
 * and the decision.
 *
 * Approving overrides the company's rules but not the stock — the server
 * refuses goods the warehouse does not have, and says which item is short.
 * Rejecting needs a reason: it is what the salesman reads on his phone.
 */
export function OrderDrawer({ orderId, onClose }: Props) {
  const { data: order, isLoading } = useOrder(orderId)
  const { approve, reject, cancel } = useOrderActions()
  const { can } = usePermissions()
  const toast = useToast()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const mayApprove = can(PERMISSIONS.ORDERS_APPROVE)
  const mayCancel = can(PERMISSIONS.ORDERS_CONFIRM)

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action()
      toast.success(done)
    } catch (error) {
      toast.error('Not done', messageOf(error))
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
      {mayApprove && canDecide(order) && (
        <>
          <Button variant="outline" onClick={() => setRejecting(true)}>
            <XCircle size={15} /> Reject
          </Button>
          <Button
            loading={approve.isPending}
            onClick={() => run(() => approve.mutateAsync({ id: order.id }), `Order ${order.trs_number} approved`)}
          >
            <CheckCircle2 size={15} /> Approve order
          </Button>
        </>
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

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject this order"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)}>Back</Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={reject.isPending}
              onClick={async () => {
                if (!order) return
                await run(() => reject.mutateAsync({ id: order.id, reason: reason.trim() }), `Order ${order.trs_number} rejected`)
                setRejecting(false)
                setReason('')
              }}
            >
              Reject order
            </Button>
          </div>
        }
      >
        <label className="block text-sm text-[var(--text-secondary)]">
          The salesman reads this on his phone.
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. The shop must pay its open invoices first."
            className="mt-2 w-full rounded-[var(--radius-btn)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-sm text-[var(--text-primary)]"
          />
        </label>
      </Modal>
    </>
  )
}
