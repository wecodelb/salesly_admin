import type { AdminCustomer } from '@/features/customers/types'
import type { AdminItem } from '@/features/products/types'
import type { Invoice } from '@/features/invoices/types'
import { day, money, qty, rangeLabel, text, within } from './report-format'
import type {
  ReportDefinition,
  ReportDocument,
  ReportGroup,
} from './report-types'

/**
 * Every report this console can produce, and how each is assembled.
 *
 * All of them are composed from data the screens already read — /customers,
 * /users, /items, /deliveries/invoices — rather than from report endpoints of
 * their own. That is the whole design: a report cannot disagree with the screen
 * it was run from, because it is the same numbers grouped differently. A
 * "total outstanding" that differs by a dollar between the Customers page and
 * the customers report is a morning lost to finding out which one lied.
 */

export const REPORTS: ReportDefinition[] = [
  {
    id: 'customers',
    family: 'customers',
    name: 'Customer book',
    description: 'Every customer with their balance, credit limit and standing.',
    dated: false,
    breakdowns: [
      { value: 'none', label: 'Flat list' },
      { value: 'salesman', label: 'By salesman' },
      { value: 'group', label: 'By customer group' },
      { value: 'area', label: 'By area' },
    ],
  },
  {
    id: 'debtors',
    family: 'customers',
    name: 'Who owes money',
    description: 'Customers carrying a balance, largest first, with those over their limit called out.',
    dated: false,
    breakdowns: [
      { value: 'none', label: 'Ranked by amount owed' },
      { value: 'salesman', label: 'By salesman' },
    ],
  },
  {
    id: 'salesmen',
    family: 'salesmen',
    name: 'Salesman performance',
    description: 'What each salesman invoiced, collected and is still owed over the period.',
    dated: true,
    breakdowns: [{ value: 'none', label: 'Ranked by value sold' }],
  },
  {
    id: 'products',
    family: 'products',
    name: 'Product catalog',
    description: 'The catalog with prices and stock on hand.',
    dated: false,
    breakdowns: [
      { value: 'none', label: 'Flat list' },
      { value: 'category', label: 'By category' },
      { value: 'brand', label: 'By brand' },
    ],
  },
  {
    id: 'bestsellers',
    family: 'products',
    name: 'Best sellers',
    description: 'What actually sold over the period, by quantity and by value.',
    dated: true,
    breakdowns: [
      { value: 'none', label: 'Ranked by value sold' },
      { value: 'category', label: 'By category' },
      { value: 'brand', label: 'By brand' },
    ],
  },
  {
    id: 'invoices',
    family: 'invoices',
    name: 'Invoice book',
    description: 'Invoices raised over the period, with what was billed, collected and is still owed.',
    dated: true,
    breakdowns: [
      { value: 'none', label: 'Newest first' },
      { value: 'customer', label: 'By customer' },
      { value: 'salesman', label: 'By salesman' },
      { value: 'settlement', label: 'By settlement' },
    ],
  },
]

export interface BuildInput {
  reportId: string
  breakdown: string
  from: string
  to: string
  customers: AdminCustomer[]
  products: AdminItem[]
  invoices: Invoice[]
}

/** Group rows by a key, keeping the order the keys first appeared in. */
function groupBy<Row>(
  rows: Row[],
  key: (row: Row) => string,
): ReportGroup<Row>[] {
  const map = new Map<string, Row[]>()
  for (const row of rows) {
    const k = key(row) || '—'
    const bucket = map.get(k)
    if (bucket) bucket.push(row)
    else map.set(k, [row])
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([title, groupRows]) => ({ key: title, title, rows: groupRows }))
}

/** One unnamed group — a flat list, printed without a heading that says nothing. */
function flat<Row>(rows: Row[]): ReportGroup<Row>[] {
  return [{ key: 'all', title: '', rows }]
}

const sum = <T,>(rows: T[], pick: (r: T) => number) =>
  rows.reduce((total, r) => total + (pick(r) || 0), 0)

export function buildReport(input: BuildInput): ReportDocument<Record<string, unknown>> {
  const { reportId } = input

  switch (reportId) {
    case 'customers':
      return customerBook(input)
    case 'debtors':
      return debtors(input)
    case 'salesmen':
      return salesmen(input)
    case 'products':
      return catalog(input)
    case 'bestsellers':
      return bestsellers(input)
    case 'invoices':
      return invoiceBook(input)
    default:
      return {
        title: 'Unknown report',
        columns: [],
        groups: [],
        emptyMessage: 'That report does not exist.',
      }
  }
}

// ── Customers ─────────────────────────────────────────────────────────

function customerRows(customers: AdminCustomer[]) {
  return customers.map((c) => ({
    ...c,
    // Over the limit only counts where a limit was actually set — null means
    // credit checks are off entirely, not a limit of zero.
    over: c.credit_limit != null && c.credit_limit > 0 && c.balance > c.credit_limit,
  }))
}

type CustomerRow = ReturnType<typeof customerRows>[number]

function customerColumns() {
  return [
    { header: 'Code', value: (r: CustomerRow) => text(r.code), width: '10%' },
    { header: 'Customer', value: (r: CustomerRow) => text(r.name), width: '26%' },
    { header: 'Salesman', value: (r: CustomerRow) => text(r.salesman_name), width: '16%' },
    { header: 'Phone', value: (r: CustomerRow) => text(r.phone1 || r.phone2), width: '14%' },
    {
      header: 'Balance',
      kind: 'money' as const,
      value: (r: CustomerRow) => money(r.balance),
      total: (r: CustomerRow) => r.balance,
      width: '12%',
    },
    {
      header: 'Limit',
      kind: 'money' as const,
      value: (r: CustomerRow) => (r.credit_limit == null ? '—' : money(r.credit_limit)),
      width: '12%',
    },
    {
      header: 'Standing',
      value: (r: CustomerRow) =>
        r.over ? 'OVER LIMIT' : r.balance > 0 ? 'Owing' : 'Clear',
      width: '10%',
    },
  ]
}

function customerBook(input: BuildInput): ReportDocument<any> {
  const rows = customerRows(input.customers)
  const owing = rows.filter((r) => r.balance > 0)

  const groups =
    input.breakdown === 'salesman'
      ? groupBy(rows, (r) => text(r.salesman_name))
      : input.breakdown === 'group'
        ? groupBy(rows, (r) => text(r.customer_group_name))
        : input.breakdown === 'area'
          ? groupBy(rows, (r) => text(r.area_name))
          : flat(rows)

  return {
    title: 'Customer book',
    subtitle: breakdownLabel('customers', input.breakdown),
    columns: customerColumns(),
    groups: withCounts(groups, (g) => `${g.rows.length} customers · ${money(sum(g.rows, (r) => r.balance))} owed`),
    summary: [
      { label: 'Customers', value: qty(rows.length) },
      { label: 'Owing', value: qty(owing.length) },
      { label: 'Total owed', value: money(sum(rows, (r) => r.balance)) },
      { label: 'Over limit', value: qty(rows.filter((r) => r.over).length) },
    ],
    emptyMessage: 'No customers on the book.',
  }
}

function debtors(input: BuildInput): ReportDocument<any> {
  const rows = customerRows(input.customers)
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance)

  const groups =
    input.breakdown === 'salesman'
      ? groupBy(rows, (r) => text(r.salesman_name))
      : flat(rows)

  return {
    title: 'Who owes money',
    subtitle: breakdownLabel('debtors', input.breakdown),
    columns: customerColumns(),
    groups: withCounts(groups, (g) => `${g.rows.length} owing · ${money(sum(g.rows, (r) => r.balance))}`),
    summary: [
      { label: 'Customers owing', value: qty(rows.length) },
      { label: 'Total owed', value: money(sum(rows, (r) => r.balance)) },
      { label: 'Over limit', value: qty(rows.filter((r) => r.over).length) },
      {
        label: 'Largest single debt',
        value: money(rows.length ? rows[0].balance : 0),
      },
    ],
    emptyMessage: 'Nobody owes anything.',
  }
}

// ── Salesmen ──────────────────────────────────────────────────────────

function salesmen(input: BuildInput): ReportDocument<any> {
  const dated = input.invoices.filter((i) => within(i.trs_date, input.from, input.to))

  const byName = new Map<string, { name: string; invoices: number; billed: number; collected: number }>()
  for (const invoice of dated) {
    const name = text(invoice.salesman?.name)
    const row = byName.get(name) ?? { name, invoices: 0, billed: 0, collected: 0 }
    row.invoices += 1
    row.billed += invoice.total_price || 0
    row.collected += invoice.paid_amount || 0
    byName.set(name, row)
  }

  const rows = [...byName.values()]
    .map((r) => ({ ...r, outstanding: r.billed - r.collected }))
    .sort((a, b) => b.billed - a.billed)

  return {
    title: 'Salesman performance',
    subtitle: `${rangeLabel(input.from, input.to)}`,
    columns: [
      { header: 'Salesman', value: (r: any) => text(r.name), width: '32%' },
      {
        header: 'Invoices',
        kind: 'number' as const,
        value: (r: any) => qty(r.invoices),
        total: (r: any) => r.invoices,
        width: '13%',
      },
      {
        header: 'Billed',
        kind: 'money' as const,
        value: (r: any) => money(r.billed),
        total: (r: any) => r.billed,
        width: '18%',
      },
      {
        header: 'Collected',
        kind: 'money' as const,
        value: (r: any) => money(r.collected),
        total: (r: any) => r.collected,
        width: '18%',
      },
      {
        header: 'Still owed',
        kind: 'money' as const,
        value: (r: any) => money(r.outstanding),
        total: (r: any) => r.outstanding,
        width: '19%',
      },
    ],
    groups: flat(rows),
    summary: [
      { label: 'Salesmen', value: qty(rows.length) },
      { label: 'Invoices', value: qty(sum(rows, (r) => r.invoices)) },
      { label: 'Billed', value: money(sum(rows, (r) => r.billed)) },
      { label: 'Collected', value: money(sum(rows, (r) => r.collected)) },
      { label: 'Still owed', value: money(sum(rows, (r) => r.outstanding)) },
    ],
    emptyMessage: 'No invoices were raised in this period.',
  }
}

// ── Products ──────────────────────────────────────────────────────────

function catalog(input: BuildInput): ReportDocument<any> {
  const rows = input.products

  const groups =
    input.breakdown === 'category'
      ? groupBy(rows, (r) => text(r.category))
      : input.breakdown === 'brand'
        ? groupBy(rows, (r) => text(r.brand))
        : flat(rows)

  return {
    title: 'Product catalog',
    subtitle: breakdownLabel('products', input.breakdown),
    columns: [
      { header: 'Code', value: (r: AdminItem) => text(r.code), width: '14%' },
      { header: 'Product', value: (r: AdminItem) => text(r.name), width: '30%' },
      { header: 'Category', value: (r: AdminItem) => text(r.category), width: '15%' },
      { header: 'Brand', value: (r: AdminItem) => text(r.brand), width: '13%' },
      {
        header: 'Price',
        kind: 'money' as const,
        value: (r: AdminItem) => money(r.price_usd ?? r.price),
        width: '14%',
      },
      {
        header: 'Stock',
        kind: 'number' as const,
        value: (r: AdminItem) => qty(r.stock),
        total: (r: AdminItem) => r.stock ?? 0,
        width: '14%',
      },
    ],
    groups: withCounts(groups, (g) => `${g.rows.length} products`),
    summary: [
      { label: 'Products', value: qty(rows.length) },
      { label: 'In stock', value: qty(rows.filter((r) => (r.stock ?? 0) > 0).length) },
      { label: 'Out of stock', value: qty(rows.filter((r) => (r.stock ?? 0) <= 0).length) },
      { label: 'Units on hand', value: qty(sum(rows, (r) => r.stock ?? 0)) },
    ],
    emptyMessage: 'The catalog is empty.',
  }
}

function bestsellers(input: BuildInput): ReportDocument<any> {
  const dated = input.invoices.filter((i) => within(i.trs_date, input.from, input.to))

  // Rows only exist on a single-invoice read, so a list fetched without them
  // yields nothing — said plainly below rather than printed as an empty table.
  const byItem = new Map<number, { name: string; code: string; category: string; brand: string; units: number; value: number }>()
  for (const invoice of dated) {
    for (const line of invoice.rows ?? []) {
      const product = input.products.find((p) => p.id === line.item_id)
      const row = byItem.get(line.item_id) ?? {
        name: text(line.item_name || product?.name),
        code: text(line.item_code || product?.code),
        category: text(product?.category),
        brand: text(product?.brand),
        units: 0,
        value: 0,
      }
      row.units += line.qty || 0
      row.value += (line.qty || 0) * (line.price || 0)
      byItem.set(line.item_id, row)
    }
  }

  const rows = [...byItem.values()].sort((a, b) => b.value - a.value)

  const groups =
    input.breakdown === 'category'
      ? groupBy(rows, (r) => r.category)
      : input.breakdown === 'brand'
        ? groupBy(rows, (r) => r.brand)
        : flat(rows)

  return {
    title: 'Best sellers',
    subtitle: `${rangeLabel(input.from, input.to)}${
      input.breakdown === 'none' ? '' : ` · ${breakdownLabel('bestsellers', input.breakdown)}`
    }`,
    columns: [
      { header: 'Code', value: (r: any) => r.code, width: '14%' },
      { header: 'Product', value: (r: any) => r.name, width: '32%' },
      { header: 'Category', value: (r: any) => r.category, width: '16%' },
      { header: 'Brand', value: (r: any) => r.brand, width: '14%' },
      {
        header: 'Units sold',
        kind: 'number' as const,
        value: (r: any) => qty(r.units),
        total: (r: any) => r.units,
        width: '12%',
      },
      {
        header: 'Value',
        kind: 'money' as const,
        value: (r: any) => money(r.value),
        total: (r: any) => r.value,
        width: '12%',
      },
    ],
    groups: withCounts(groups, (g) => `${g.rows.length} products · ${money(sum(g.rows, (r: any) => r.value))}`),
    summary: [
      { label: 'Products sold', value: qty(rows.length) },
      { label: 'Units', value: qty(sum(rows, (r) => r.units)) },
      { label: 'Value', value: money(sum(rows, (r) => r.value)) },
    ],
    emptyMessage:
      'No sold lines in this period. Invoice lines are only loaded for invoices opened individually, so this fills in as invoices are read.',
  }
}

// ── Invoices ──────────────────────────────────────────────────────────

function invoiceBook(input: BuildInput): ReportDocument<any> {
  const rows = input.invoices
    .filter((i) => within(i.trs_date, input.from, input.to))
    .map((i) => ({
      ...i,
      outstanding: Math.max(0, (i.total_price || 0) - (i.paid_amount || 0)),
    }))

  const groups =
    input.breakdown === 'customer'
      ? groupBy(rows, (r) => text(r.customer))
      : input.breakdown === 'salesman'
        ? groupBy(rows, (r) => text(r.salesman?.name))
        : input.breakdown === 'settlement'
          ? groupBy(rows, (r) => (r.outstanding > 0 ? 'Still owed' : 'Settled'))
          : flat(rows)

  return {
    title: 'Invoice book',
    subtitle: `${rangeLabel(input.from, input.to)}${
      input.breakdown === 'none' ? '' : ` · ${breakdownLabel('invoices', input.breakdown)}`
    }`,
    columns: [
      { header: 'Invoice', value: (r: any) => text(r.trs_number), width: '13%' },
      { header: 'Date', kind: 'date' as const, value: (r: any) => day(r.trs_date), width: '13%' },
      { header: 'Customer', value: (r: any) => text(r.customer), width: '24%' },
      { header: 'Salesman', value: (r: any) => text(r.salesman?.name), width: '16%' },
      {
        header: 'Billed',
        kind: 'money' as const,
        value: (r: any) => money(r.total_price),
        total: (r: any) => r.total_price || 0,
        width: '12%',
      },
      {
        header: 'Collected',
        kind: 'money' as const,
        value: (r: any) => money(r.paid_amount),
        total: (r: any) => r.paid_amount || 0,
        width: '11%',
      },
      {
        header: 'Still owed',
        kind: 'money' as const,
        value: (r: any) => money(r.outstanding),
        total: (r: any) => r.outstanding,
        width: '11%',
      },
    ],
    groups: withCounts(groups, (g) => `${g.rows.length} invoices · ${money(sum(g.rows, (r: any) => r.total_price || 0))}`),
    summary: [
      { label: 'Invoices', value: qty(rows.length) },
      { label: 'Billed', value: money(sum(rows, (r) => r.total_price || 0)) },
      { label: 'Collected', value: money(sum(rows, (r) => r.paid_amount || 0)) },
      { label: 'Still owed', value: money(sum(rows, (r) => r.outstanding)) },
    ],
    emptyMessage: 'No invoices in this period.',
  }
}

// ── Shared ────────────────────────────────────────────────────────────

function withCounts<Row>(
  groups: ReportGroup<Row>[],
  caption: (g: ReportGroup<Row>) => string,
): ReportGroup<Row>[] {
  // A flat list gets no caption: there is nothing to compare it against.
  if (groups.length === 1 && groups[0].title === '') return groups

  return groups.map((g) => ({ ...g, caption: caption(g) }))
}

function breakdownLabel(reportId: string, breakdown: string): string {
  const report = REPORTS.find((r) => r.id === reportId)
  const found = report?.breakdowns.find((b) => b.value === breakdown)

  return found?.label ?? ''
}
