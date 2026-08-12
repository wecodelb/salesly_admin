/**
 * Invoices as the console reads them.
 *
 * The document is written two ways and the difference matters to whoever is
 * reading a list of them: off an order that was taken and later delivered, or
 * straight off a van with no order behind it at all. `is_van_sale` is the
 * server's own answer to that — an invoice with no source document — rather than
 * something inferred here from a missing field.
 */
export interface InvoiceRow {
  id: number
  lno: number | null
  item_id: number
  item_code: string
  item_name: string
  uom_id: number | null
  uom_name: string
  unit: number | null
  /** The quantity in the packaging it was sold in — four cases, not forty-eight. */
  trs_qty: number
  /** The same quantity in base units, which is what left the warehouse. */
  qty: number
  /** Per base unit, as charged. Never recomputed: the customer signed for this. */
  price: number
  cost: number | null
  line_memo: string | null
}

export interface Invoice {
  id: number
  customer: string
  customer_id: number | null
  trs_barcode: string | null
  trs_number: string
  trs_date: string | null
  notes: string | null

  total_qty: number
  total_price: number
  paid_amount: number
  /**
   * What is still owed on this document. Computed server-side on purpose, so the
   * console and the phone cannot disagree about a customer's debt.
   */
  due_amount: number

  payment_method: string | null
  currency: string | null

  /** Sold off a van, with no order behind it. */
  is_van_sale: boolean

  salesman?: { id: number; name: string } | null

  /** Where the signature image sits in storage, relative to the public disk. */
  signature_path: string | null
  latitude: number | null
  longitude: number | null

  /** Present on the single-document read only; the list is headers. */
  rows?: InvoiceRow[]
}

export interface InvoicePagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface InvoicePage {
  invoices: Invoice[]
  pagination: InvoicePagination | null
}

export interface InvoiceFilters {
  customerId?: number | null
  salesmanId?: number | null
  page?: number
  perPage?: number
}

// ─── Money ──────────────────────────────────────────────────────────────────

/**
 * USD is the base currency of this system — prices are stored and invoiced in it
 * and lira is derived from the live rate — so this is the one formatter the
 * invoice screens use. Kept beside the types rather than in a component so the
 * list, the detail page and the totals strip cannot drift apart on decimals.
 */
export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatQty(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// ─── Reading a document ─────────────────────────────────────────────────────

export function isSettled(invoice: Pick<Invoice, 'due_amount'>): boolean {
  return invoice.due_amount <= 0
}

/** Nothing has been paid at all — told apart from part-paid because it is the
 *  pile somebody chases first. */
export function isUnpaid(invoice: Pick<Invoice, 'paid_amount'>): boolean {
  return invoice.paid_amount <= 0
}

export function invoicePill(
  invoice: Pick<Invoice, 'paid_amount' | 'due_amount'>,
): { status: string; label: string } {
  if (isSettled(invoice)) return { status: 'success', label: 'Paid' }
  // Part-paid is its own answer. "Unpaid" on an invoice a customer has already
  // put money against is the kind of wrongness that gets argued about at a till.
  if (invoice.paid_amount > 0) return { status: 'warning', label: 'Part paid' }
  return { status: 'error', label: 'Unpaid' }
}

/**
 * What a list of invoices comes to.
 *
 * Folded over the rows the table is showing rather than asked of the server,
 * because the figures have to describe what the reader is looking at: a total
 * that ignored the customer filter would be a number nobody could reconcile
 * against the rows beneath it.
 */
export interface InvoiceTotals {
  billed: number
  collected: number
  outstanding: number
  unpaidCount: number
  count: number
}

export function totalsOf(invoices: Invoice[]): InvoiceTotals {
  let billed = 0
  let collected = 0
  let outstanding = 0
  let unpaidCount = 0

  for (const invoice of invoices) {
    billed += invoice.total_price
    collected += invoice.paid_amount
    outstanding += invoice.due_amount
    if (!isSettled(invoice)) unpaidCount += 1
  }

  return {
    billed: round2(billed),
    collected: round2(collected),
    outstanding: round2(outstanding),
    unpaidCount,
    count: invoices.length,
  }
}

/** Summed money carries binary float error; two decimals is what is displayed. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}
