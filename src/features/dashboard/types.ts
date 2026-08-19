// Contract from App\Repositories\General\DashboardRepository::summary(),
// behind GET /dashboard/summary.
//
// Every figure on this screen is an aggregate the server computed. None of it
// can be assembled honestly on the client: the list endpoints are paginated,
// so "today's sales" derived from page one of /orders would be a number that
// looks right and isn't.

/**
 * One headline figure, beside the same figure yesterday.
 *
 * `change` is null — not zero — when yesterday was nothing. Everything is up
 * infinitely from zero, so a card claiming "+0%" on a day that went from no
 * sales to four thousand would be worse than saying nothing at all.
 */
export interface Metric {
  value: number
  previous: number
  change: number | null
}

/** How much of the day's calling has actually been done. */
export interface VisitProgress {
  done: number
  started: number
}

export interface TodayBlock {
  sales: Metric
  orders: Metric
  collected: Metric
  visits: VisitProgress
}

export interface TrendPoint {
  /** ISO date, the stable key. */
  date: string
  /** Short human label, e.g. "6 Aug". */
  label: string
  value: number
}

export interface SalesmanTotal {
  id: number | null
  name: string
  orders: number
  total: number
}

export interface RecentOrder {
  id: number
  /** Document number, e.g. "SO-2". */
  number: string
  customer: string
  /** Null on an order whose customer was removed; the row then doesn't link. */
  customer_id: number | null
  salesman: string
  total: number
  status: string | null
  date: string | null
}

export interface OwingCustomer {
  id: number
  name: string
  balance: number
  /** Null means no ceiling was ever set, which is not the same as a ceiling
   *  of zero — the screen says so rather than drawing a full bar. */
  credit_limit: number | null
}

/**
 * What customers owe.
 *
 * Outstanding balance, *not* overdue debt. Nothing in the schema carries a due
 * date or payment terms, so no row here can honestly be called late — the old
 * demo screen showed "12 days overdue", which was the one number on it a
 * manager would actually have acted on, and it was invented.
 */
export interface Outstanding {
  total: number
  customers: number
  /** Counted across every owing account, not just the handful in `top` — a
   *  card reading "3 over limit" off the top six would understate the company
   *  the moment the seventh is over too. */
  over_limit: number
  top: OwingCustomer[]
}

export interface DashboardSummary {
  generated_at: string
  currency: string
  today: TodayBlock
  sales_trend: TrendPoint[]
  top_salesmen: SalesmanTotal[]
  recent_orders: RecentOrder[]
  outstanding: Outstanding
}

// ─── Formatting ─────────────────────────────────────────────────────────────

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Headline money: no cents, because a KPI is read at a glance. */
export function money(value: number): string {
  return `$${whole.format(Math.round(value))}`
}

/** Money in a list, where the exact figure is the point. */
export function moneyExact(value: number): string {
  return `$${cents.format(value)}`
}

export function percent(value: number): string {
  return `${value > 0 ? '+' : ''}${whole.format(Math.round(value))}%`
}

/**
 * How a change should read. Neutral covers both "no movement" and "nothing to
 * compare against", which the caller renders as an em dash rather than a
 * misleading arrow.
 */
export function changeTone(change: number | null): 'up' | 'down' | 'neutral' {
  if (change === null || change === 0) return 'neutral'
  return change > 0 ? 'up' : 'down'
}

const ORDER_STATUS: Record<string, { pill: string; label: string }> = {
  DRAFT: { pill: 'draft', label: 'Draft' },
  CONFIRMED: { pill: 'active', label: 'Confirmed' },
  COMPLETED: { pill: 'success', label: 'Delivered' },
  CANCELED: { pill: 'error', label: 'Cancelled' },
}

/** The server sends the enum; unknown values render as themselves rather than
 *  vanishing, so a new status is visible the day it ships. */
export function orderStatus(status: string | null): { pill: string; label: string } {
  if (!status) return { pill: 'inactive', label: 'Unknown' }
  return ORDER_STATUS[status] ?? { pill: 'inactive', label: status }
}

/**
 * How far past its credit limit an account is, as a fraction of the limit.
 *
 * Null where no limit is set — there is nothing to be over, and drawing a bar
 * against a ceiling nobody chose would invent the judgement it displays.
 */
export function creditUse(customer: OwingCustomer): number | null {
  if (customer.credit_limit === null || customer.credit_limit <= 0) return null
  return customer.balance / customer.credit_limit
}
