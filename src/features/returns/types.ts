/**
 * Goods a customer handed back, as the console reads them.
 *
 * A return is taken at the counter with the shop standing there, so unlike a
 * load request or an unload there is nothing here for the office to approve —
 * this screen is a record, not a queue. What it is for is answering the two
 * questions the office actually asks: what came back off which round, and
 * whether anybody is owed money for it.
 */

export interface SalesReturnRow {
  id: number
  lno: number

  item_id: number
  item_code: string
  item_name: string
  uom_name: string

  /** What was handed back, in the packaging it was sold in. */
  trs_qty: number
  unit: number
  /** And in base units, which is what moved onto the van. */
  qty: number

  unit_price: number
  line_value: number

  /**
   * The invoice line it came off. Null only on a row written before this was
   * recorded — worth rendering as a dash rather than as invoice zero.
   */
  invoice_id: number | null
  invoice_number: number | null
  invoice_row_id: number | null

  note: string
}

export interface SalesReturn {
  id: number
  trs_number: number
  /** `d/m/Y H:i` — see parseApiDate in the reports formatter. */
  trs_date: string | null
  status: string

  customer_id: number | null
  customer?: { id: number; code: string; name: string } | null
  salesman?: { id: number; name: string } | null

  /** Where the goods went — the salesman's van. */
  warehouse?: { id: number | null; code: string; name: string } | null

  created_by_name?: string

  currency: string
  exchange_rate: number

  total_qty: number
  total_price: number

  /** What the goods were worth. */
  credit_value: number
  /** What actually came off the customer's balance. */
  credit_applied: number
  /** And what nobody could apply, which is a refund owing. */
  credit_excess: number

  memo: string

  rows_count?: number
  /** Present on the single read; the list carries headers only. */
  rows?: SalesReturnRow[]
}

export interface SalesReturnPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface SalesReturnFilters {
  customerId?: number | null
  salesmanId?: number | null
  dateFrom?: string | null
  dateTo?: string | null
  search?: string | null
  page?: number
  perPage?: number
}

// ─── Reading one ────────────────────────────────────────────────────────────

/** The rows on a return, guarded — a missing key must not take a screen down. */
export function rowsOf(document: SalesReturn): SalesReturnRow[] {
  return Array.isArray(document.rows) ? document.rows : []
}

/**
 * Somebody is owed money back.
 *
 * The goods were already paid for, so there was nothing left on the invoice to
 * credit. The stock still came back — refusing the paperwork would not have
 * sent it home with the customer — and this is the figure that says a refund
 * is outstanding. It is the only thing on this screen that needs acting on,
 * which is why it gets its own column rather than being folded into the credit.
 */
export function owesRefund(document: Pick<SalesReturn, 'credit_excess'>): boolean {
  return (document.credit_excess ?? 0) > 0
}

/**
 * How a return reads.
 *
 * Two states, not four. A return has no lifecycle — it is written once, at the
 * counter, and never approved or cancelled. What varies is whether the credit
 * landed in full, so that is what the pill says.
 */
export function returnPill(
  document: Pick<SalesReturn, 'credit_excess'>,
): { status: string; label: string } {
  return owesRefund(document)
    ? { status: 'warning', label: 'Refund owing' }
    : { status: 'success', label: 'Credited' }
}

// ─── Totals ─────────────────────────────────────────────────────────────────

export function formatQty(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export interface ReturnTotals {
  /** Returns on screen. */
  count: number
  /** Units that came back. */
  units: number
  /** What the goods were worth. */
  value: number
  /** What actually came off customers' balances. */
  credited: number
  /** And what is still owed back to shops. */
  owed: number
}

/**
 * Totalled over the rows on screen.
 *
 * Value and credited are kept apart rather than netted. Most days they are the
 * same number; the day they are not is the day somebody is owed a refund, and
 * a single figure would be exactly where that went missing.
 */
export function totalsOf(documents: SalesReturn[]): ReturnTotals {
  let units = 0
  let value = 0
  let credited = 0
  let owed = 0

  for (const document of documents) {
    units += Number.isFinite(document.total_qty) ? document.total_qty : 0
    value += Number.isFinite(document.credit_value) ? document.credit_value : 0
    credited += Number.isFinite(document.credit_applied) ? document.credit_applied : 0
    owed += Number.isFinite(document.credit_excess) ? document.credit_excess : 0
  }

  const round = (n: number) => Math.round(n * 100) / 100

  return {
    count: documents.length,
    units: round(units),
    value: round(value),
    credited: round(credited),
    owed: round(owed),
  }
}
