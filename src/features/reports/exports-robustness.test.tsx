import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { areasExportDoc } from '@/features/areas/areas-export'
import { brandsExportDoc } from '@/features/brands/brands-export'
import { categoriesExportDoc } from '@/features/categories/categories-export'
import { currenciesExportDoc } from '@/features/currencies/currencies-export'
import { customerGroupsExportDoc } from '@/features/customer-groups/customer-groups-export'
import { collectionsExportDoc } from '@/features/collections/collections-export'
import { customersExportDoc } from '@/features/customers/customers-export'
import { depotExportDoc } from '@/features/my-depot/depot-export'
import { invoicesExportDoc } from '@/features/invoices/invoices-export'
import { priceListsExportDoc } from '@/features/price-lists/price-lists-export'
import { productsExportDoc } from '@/features/products/products-export'
import { promotionsExportDoc } from '@/features/promotions/promotions-export'
import { uomsExportDoc } from '@/features/uoms/uoms-export'
import { usersExportDoc } from '@/features/users/users-export'
import { warehousesExportDoc } from '@/features/reports/../warehouses/warehouses-export'
import { ReportDocument as ReportDocumentView } from './components/ReportDocument'
import type { ReportDocument } from './report-types'

const AT = new Date('2026-03-15T09:00:00Z')

/**
 * Every export, against data that is missing everything.
 *
 * The unit tests elsewhere feed each builder a well-formed row, which is not
 * what breaks an export. What breaks it is a real payload with a hole in it: a
 * customer whose salesman was deleted, an invoice whose salesman object never
 * arrived, a depot transfer with no destination. A builder that dereferences
 * one of those throws inside a click handler, the print never happens, and the
 * user sees a button that does nothing at all — which is exactly the failure
 * nobody can diagnose from the screen.
 *
 * So: run every column of every document over rows that are empty objects, and
 * over rows whose every nested object is explicitly null. Nothing may throw,
 * and every cell has to come back a string.
 */

/** Rows designed to break things: nothing present, then everything null. */
const HOSTILE: unknown[] = [
  {},
  {
    id: null,
    code: null,
    name: null,
    phone1: null,
    phone2: null,
    salesman: null,
    salesman_name: null,
    customer: null,
    customer_group_name: null,
    category: null,
    brand: null,
    area_name: null,
    location: null,
    symbol: null,
    item: null,
    customers: null,
    permissions: null,
    source: null,
    destination: null,
    balance: null,
    credit_limit: null,
    price_usd: null,
    price_lbp: null,
    available_qty: null,
    total_qty: null,
    total_price: null,
    paid_amount: null,
    due_amount: null,
    customers_count: null,
    items_count: null,
    packagings_count: null,
    sort_order: null,
    decimal_places: null,
    symbol_position: null,
    value: null,
    starts_at: null,
    ends_at: null,
    trs_number: null,
    trs_date: null,
    trs_type: null,
    status: null,
    role: null,
    email: null,
    phone: null,
    is_active: null,
    is_base: null,
    is_depot: null,
    is_main: null,
    is_default: null,
    type: null,
  },
  // A row that is not an object at all is not a case any endpoint produces, so
  // it is deliberately not here — a builder is allowed to assume it has a row.
]

/**
 * Each builder, called the way its screen calls it. The rows are cast because
 * the whole point is to hand them something their types say cannot happen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rows = HOSTILE as any[]

const DOCS: [string, ReportDocument<unknown>][] = [
  ['collections', collectionsExportDoc(rows, 99, [])],
  ['customers', customersExportDoc(rows, 99, [])],
  ['products (flat)', productsExportDoc(rows, 99, [], 'none')],
  ['products (by category)', productsExportDoc(rows, 99, [], 'category')],
  ['products (by brand)', productsExportDoc(rows, 99, [], 'brand')],
  ['invoices', invoicesExportDoc(rows, 99, [])],
  ['team', usersExportDoc(rows, 99, [])],
  ['areas', areasExportDoc(rows, 99, '')],
  ['brands', brandsExportDoc(rows, 99, '')],
  ['categories', categoriesExportDoc(rows, 99, '')],
  ['customer groups', customerGroupsExportDoc(rows, 99, '')],
  ['units', uomsExportDoc(rows, 99, '')],
  ['currencies', currenciesExportDoc(rows, rows)],
  ['promotions', promotionsExportDoc(rows, 99)],
  ['price lists', priceListsExportDoc(rows, 99)],
  ['warehouses', warehousesExportDoc(rows, 99, '', '')],
  ['load requests', depotExportDoc(rows, 99, '', false, 'requests')],
  ['load issues', depotExportDoc(rows, 99, '', false, 'issues')],
] as [string, ReportDocument<unknown>][]

describe('building a document over broken rows', () => {
  it.each(DOCS)('%s builds at all', (_name, doc) => {
    // Reaching this line is most of the test: the builders run eagerly, so a
    // dereference in a summary or a grouping throws before the click returns.
    expect(doc.title).toBeTruthy()
    expect(doc.columns.length).toBeGreaterThan(0)
  })

  it.each(DOCS)('%s renders every cell without throwing', (_name, doc) => {
    for (const group of doc.groups) {
      for (const row of group.rows) {
        for (const col of doc.columns) {
          const cell = col.value(row)
          expect(typeof cell).toBe('string')
        }
      }
    }
  })

  it.each(DOCS)('%s foots every total as a real figure', (_name, doc) => {
    // A column’s total() is allowed to come back undefined on a row with a
    // hole in it — what must never happen is that reaching the footer. Added
    // naively these produce NaN, which prints as the word "NaN" and reads as a
    // broken system to whoever is holding the page. Asserted on the rendered
    // document rather than on total() itself, because the footer is what the
    // reader sees and ReportDocument is where the skipping happens.
    const { container } = render(
      <ReportDocumentView doc={doc} companyName="Co" generatedAt={AT} />,
    )

    const foot = container.querySelector('.report-table tfoot')
    if (!foot) return

    expect(foot.textContent).not.toContain('NaN')
    expect(foot.textContent).not.toContain('undefined')
  })

  it.each(DOCS)('%s produces summary figures that are strings', (_name, doc) => {
    for (const item of doc.summary ?? []) {
      expect(typeof item.value).toBe('string')
      expect(item.value).not.toContain('NaN')
      expect(item.value).not.toContain('undefined')
    }
  })

  it.each(DOCS)('%s never writes undefined or NaN into a cell', (_name, doc) => {
    // `text(null)` gives a dash and `money(null)` gives a dash; the literal
    // strings below mean one of them was bypassed.
    for (const group of doc.groups) {
      for (const row of group.rows) {
        for (const col of doc.columns) {
          const cell = col.value(row)
          expect(cell).not.toContain('undefined')
          expect(cell).not.toContain('NaN')
          expect(cell).not.toContain('Invalid Date')
        }
      }
    }
  })

  it.each(DOCS)('%s gives every group a key, so React can list them', (_name, doc) => {
    const keys = doc.groups.map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((k) => typeof k === 'string' && k.length > 0)).toBe(true)
  })
})

describe('building a document over nothing at all', () => {
  const empties: [string, ReportDocument<unknown>][] = [
    ['collections', collectionsExportDoc([], 0, [])],
    ['customers', customersExportDoc([], 0, [])],
    ['products', productsExportDoc([], 0, [], 'category')],
    ['invoices', invoicesExportDoc([], 0, [])],
    ['team', usersExportDoc([], 0, [])],
    ['areas', areasExportDoc([], 0, '')],
    ['currencies', currenciesExportDoc([], [])],
    ['warehouses', warehousesExportDoc([], 0, '', '')],
    ['load issues', depotExportDoc([], 0, '', false, 'issues')],
  ] as [string, ReportDocument<unknown>][]

  it.each(empties)('%s says so instead of printing a headed empty table', (_name, doc) => {
    expect(doc.emptyMessage).toBeTruthy()
    expect(doc.groups.every((g) => g.rows.length === 0)).toBe(true)
  })

  it.each(empties)('%s still totals to zero rather than NaN', (_name, doc) => {
    for (const item of doc.summary ?? []) {
      expect(item.value).not.toContain('NaN')
    }
  })
})
