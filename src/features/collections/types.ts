/**
 * Collections as the console reads them.
 *
 * A collection is money taken against a customer's *balance* and spread over
 * their open invoices oldest first — the salesman reaches a shop owing for
 * three weeks and is handed whatever it can spare. The server writes a numbered
 * receipt (`RC`) saying where every part of it went.
 *
 * Two kinds land here, told apart by `source`: money taken against a customer's
 * whole balance and spread over their open invoices oldest first, and money
 * taken against one invoice. The second used to record no receipt at all — it
 * moved a number on the invoice and threw the tender mix away — so a list of
 * the day's takings could not see it. Both are here now, which is what makes
 * this the record of money received rather than part of it.
 */

/** How the money was aimed: at a whole balance, or at one invoice. */
export type CollectionSource = 'balance' | 'invoice'

/** One way the money was handed over — notes counted, and what they came to. */
export interface CollectionTender {
  /** How it was paid: cash, whish, card… */
  method: string
  /** The currency the customer actually held. */
  currency: string
  /** The figure in that currency — 500,000 lira, not its dollar worth. */
  amount: number
  /** What it came to once converted, in the document's currency. */
  value: number
  /** The rate it was converted at, stamped when the money changed hands. */
  exchange_rate: number | null
}

/** Which invoice a slice of the money settled, and what it still owes. */
export interface CollectionAllocation {
  invoice_id: number
  trs_number?: string | null
  was_due: number
  applied: number
  still_due: number
}

export interface Collection {
  id: number
  trs_number: string
  /** `d/m/Y H:i` — see parseApiDate in the reports formatter. */
  trs_date: string | null
  notes: string | null

  customer: string
  customer_id: number | null
  customer_phone?: string
  customer_address?: string

  /** What was taken, in the company's own currency. */
  amount: number
  /**
   * The largest settled tender's method, defaulting to cash. On a mixed
   * receipt this names one of several, so a screen showing it alone is telling
   * a partial truth — read `payments` for what the customer actually handed
   * over.
   */
  payment_method: string | null

  /** Against the whole balance, or against one invoice. */
  source: CollectionSource

  currency: string | null
  exchange_rate: number | null

  /** How it was handed over. Empty on an ordinary single-tender collection. */
  payments: CollectionTender[]
  /** Which invoices it settled, oldest first. */
  allocations: CollectionAllocation[]

  /** The customer's balance either side of this receipt. */
  balance_before: number | null
  balance_after: number | null

  salesman?: { id: number; name: string } | null
}

export interface CollectionPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface CollectionPage {
  collections: Collection[]
  pagination: CollectionPagination | null
}

export interface CollectionFilters {
  customerId?: number | null
  salesmanId?: number | null
  paymentMethod?: string | null
  source?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  page?: number
  perPage?: number
}

// ─── Reading a receipt ──────────────────────────────────────────────────────

/**
 * The tenders on a receipt, guarded.
 *
 * ReceiptResource always sends an array, so this is belt-and-braces — but a
 * missing key here would throw inside the Export click, and a click that throws
 * prints nothing and explains nothing.
 */
export function tendersOf(collection: Collection): CollectionTender[] {
  return Array.isArray(collection.payments) ? collection.payments : []
}

/** Which invoices a receipt settled, guarded the same way. */
export function allocationsOf(collection: Collection): CollectionAllocation[] {
  return Array.isArray(collection.allocations) ? collection.allocations : []
}

/** Whether this receipt took more than one kind of money. */
export function isMixed(collection: Collection): boolean {
  return tendersOf(collection).length > 1
}

/**
 * How it was paid, in words.
 *
 * A 60/40 cash-and-whish receipt labelled "cash" is a lie the row tells
 * silently, so a mixed one says so instead of naming the largest tender.
 */
export function describeMethod(collection: Collection): string {
  const tenders = tendersOf(collection)

  if (tenders.length > 1) {
    return tenders.map((t) => titleCase(t.method)).join(' + ')
  }

  return titleCase(tenders[0]?.method ?? collection.payment_method)
}

/** What the customer actually held, for the row beneath the method. */
export function describeTender(tender: CollectionTender): string {
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
  const code = (tender.currency ?? '').toUpperCase()
  const held = `${fmt.format(tender.amount ?? 0)} ${code}`

  // Only worth spelling out when the two differ — "$40 ($40)" is noise.
  return code === 'USD' ? held : `${held} · ${formatMoney(tender.value)}`
}

function titleCase(value: string | null | undefined): string {
  if (!value) return '—'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// ─── Money ──────────────────────────────────────────────────────────────────

/** The same formatter the invoice screens use, so the two cannot drift. */
export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—'
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export interface CollectionTotals {
  /** Everything taken across the rows being shown. */
  collected: number
  /** How many receipts made it up. */
  count: number
  /** How many customers it came from — a day of collecting, in shops. */
  customers: number
  /** Receipts that took more than one kind of money. */
  mixed: number
  /** Of those receipts, how many were taken against one invoice. */
  againstInvoice: number
}

/**
 * Totalled over the rows on screen, so the strip and the table always describe
 * the same set.
 *
 * Sums `amount`, the figure in the company's own currency, rather than adding
 * up tender values — those are already folded into it, and adding both would
 * double a mixed receipt.
 */
export function totalsOf(collections: Collection[]): CollectionTotals {
  let collected = 0
  let mixed = 0
  const customers = new Set<number>()

  let againstInvoice = 0

  for (const collection of collections) {
    collected += collection.amount || 0
    if (isMixed(collection)) mixed += 1
    if (collection.source === 'invoice') againstInvoice += 1
    if (collection.customer_id != null) customers.add(collection.customer_id)
  }

  return {
    collected: Math.round(collected * 100) / 100,
    count: collections.length,
    customers: customers.size,
    mixed,
    againstInvoice,
  }
}
