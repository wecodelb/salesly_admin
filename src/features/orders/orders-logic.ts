import type { Order, OrderStatus } from './types'

type PillStatus = 'pending' | 'success' | 'error' | 'inactive' | 'live'

/** The server's own words for a refusal, whatever key they came under. */
export function serverMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string; data?: Record<string, string[]> } } })?.response?.data
  const first = data?.data ? Object.values(data.data).flat()[0] : undefined
  return first ?? data?.message ?? 'Something went wrong.'
}

/** How each status reads on a pill. */
export function orderPill(status: OrderStatus): { status: PillStatus; label: string } {
  switch (status) {
    case 'SUBMITTED':
      return { status: 'pending', label: 'Waiting for approval' }
    case 'APPROVED':
    case 'DRAFT':
      return { status: 'live', label: 'Approved' }
    case 'COMPLETED':
    case 'CONFIRMED':
      return { status: 'success', label: 'Delivered' }
    case 'REJECTED':
      return { status: 'error', label: 'Rejected' }
    case 'CANCELED':
      return { status: 'inactive', label: 'Cancelled' }
    default:
      return { status: 'inactive', label: status }
  }
}

/** The filter chips, in the order the office works them. */
export const STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Waiting for approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'COMPLETED', label: 'Delivered' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELED', label: 'Cancelled' },
]

/**
 * The office issued it, as a load issue answers a load request: approved,
 * delivered since, or cancelled after it was approved. A rejected order, or one
 * still waiting, was never issued.
 */
export function isIssued(order: Pick<Order, 'status' | 'decided_at'>): boolean {
  return order.status === 'APPROVED' || order.status === 'COMPLETED' || (order.status === 'CANCELED' && order.decided_at != null)
}

/** Only an order still waiting can be approved or rejected. */
export function canDecide(order: Pick<Order, 'status'>): boolean {
  return order.status === 'SUBMITTED'
}

/** Waiting or approved — anything not delivered and not already ended. */
export function canCancel(order: Pick<Order, 'status'>): boolean {
  return order.status === 'SUBMITTED' || order.status === 'APPROVED'
}

/** Who approved it, in words: the rules on their own, or a named person. */
export function decidedBy(order: Pick<Order, 'status' | 'decided_by' | 'decided_by_name'>): string | null {
  if (order.status === 'APPROVED' && order.decided_by == null) return 'Approved automatically by the rules'
  if (!order.decided_by_name) return null
  return order.status === 'REJECTED'
    ? `Rejected by ${order.decided_by_name}`
    : `Approved by ${order.decided_by_name}`
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount || 0)
}

export function formatLbp(amount: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount || 0))} LL`
}

/** "2026-10-15" → "Thu 15 Oct"; the delivery column reads as a day. */
export function formatDay(ymd: string | null): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
