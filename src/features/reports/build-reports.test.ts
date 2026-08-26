import { describe, expect, it } from 'vitest'

import type { AdminCustomer } from '@/features/customers/types'
import type { AdminItem } from '@/features/products/types'
import type { Invoice } from '@/features/invoices/types'
import { buildReport, REPORTS, type BuildInput } from './build-reports'

/**
 * What actually lands on the paper.
 *
 * These are the tests that matter for a printed report: a misgrouped row or a
 * subtotal that does not add up survives review, gets filed, and is argued
 * about at a month end when nobody can reconstruct what was run.
 */

const customer = (over: Partial<AdminCustomer> = {}): AdminCustomer =>
  ({
    id: 1,
    code: 'C1',
    name: 'Corner Shop',
    phone1: '01 234 567',
    phone2: '',
    email: '',
    address: '',
    salesman_id: 1,
    salesman_name: 'Ahmad',
    customer_group_name: 'Retail',
    area_name: 'Beirut',
    credit_limit: null,
    balance: 0,
    is_active: true,
    is_verified: true,
    ...over,
  }) as AdminCustomer

const product = (over: Partial<AdminItem> = {}) =>
  ({
    id: 1,
    code: 'P1',
    name: 'Cola 330ml',
    category: 'Drinks',
    brand: 'Coca-Cola',
    price_usd: 5,
    price: 5,
    stock: 10,
    ...over,
  }) as unknown as AdminItem

const invoice = (over: Partial<Invoice> = {}) =>
  ({
    id: 1,
    trs_number: 'SI-1',
    trs_date: '2026-03-15',
    customer: 'Corner Shop',
    customer_id: 1,
    salesman: { id: 1, name: 'Ahmad' },
    total_price: 100,
    paid_amount: 40,
    rows: [],
    ...over,
  }) as unknown as Invoice

const build = (over: Partial<BuildInput> = {}) =>
  buildReport({
    reportId: 'customers',
    breakdown: 'none',
    from: '',
    to: '',
    customers: [],
    products: [],
    invoices: [],
    ...over,
  })

/** Every row across every group — what the reader actually sees. */
const allRows = (doc: ReturnType<typeof build>) => doc.groups.flatMap((g) => g.rows)

/** A summary figure by its label. */
const stat = (doc: ReturnType<typeof build>, label: string) =>
  doc.summary?.find((s) => s.label === label)?.value

describe('the report catalog', () => {
  it('covers all four families the console offers', () => {
    expect(new Set(REPORTS.map((r) => r.family))).toEqual(
      new Set(['customers', 'salesmen', 'products', 'invoices']),
    )
  })

  it('gives every report a first breakdown to open on', () => {
    for (const report of REPORTS) {
      expect(report.breakdowns.length).toBeGreaterThan(0)
      expect(report.breakdowns[0].value).toBeTruthy()
    }
  })

  it('only dates the reports where a period means something', () => {
    // A catalog is what it is today. Offering a range would imply a history
    // the table does not keep.
    expect(REPORTS.find((r) => r.id === 'products')?.dated).toBe(false)
    expect(REPORTS.find((r) => r.id === 'customers')?.dated).toBe(false)
    expect(REPORTS.find((r) => r.id === 'invoices')?.dated).toBe(true)
    expect(REPORTS.find((r) => r.id === 'salesmen')?.dated).toBe(true)
  })
})

describe('customer book', () => {
  const customers = [
    customer({ id: 1, name: 'Alpha', balance: 100, salesman_name: 'Ahmad' }),
    customer({ id: 2, name: 'Beta', balance: 0, salesman_name: 'Sara' }),
    customer({ id: 3, name: 'Gamma', balance: 500, credit_limit: 200, salesman_name: 'Ahmad' }),
  ]

  it('totals what is owed across the whole book', () => {
    const doc = build({ reportId: 'customers', customers })

    expect(allRows(doc)).toHaveLength(3)
    expect(stat(doc, 'Total owed')).toBe('$600.00')
    expect(stat(doc, 'Owing')).toBe('2')
  })

  it('counts over-limit only where a limit was actually set', () => {
    // A null limit means credit checks are off entirely, not a limit of zero —
    // counting those as over would put every debtor on the exception list.
    const doc = build({ reportId: 'customers', customers })

    expect(stat(doc, 'Over limit')).toBe('1')
  })

  it('groups by salesman with a subtotal per group', () => {
    const doc = build({ reportId: 'customers', customers, breakdown: 'salesman' })

    expect(doc.groups.map((g) => g.title)).toEqual(['Ahmad', 'Sara'])
    expect(doc.groups[0].rows).toHaveLength(2)
    expect(doc.groups[0].caption).toContain('$600.00')
    expect(doc.groups[1].caption).toContain('$0.00')
  })

  it('prints a flat list without a heading that says nothing', () => {
    const doc = build({ reportId: 'customers', customers })

    expect(doc.groups).toHaveLength(1)
    expect(doc.groups[0].title).toBe('')
    expect(doc.groups[0].caption).toBeUndefined()
  })

  it('says so plainly when there is nothing to print', () => {
    const doc = build({ reportId: 'customers', customers: [] })

    expect(allRows(doc)).toHaveLength(0)
    expect(doc.emptyMessage).toBeTruthy()
  })
})

describe('who owes money', () => {
  it('drops the settled and ranks the rest largest first', () => {
    const doc = build({
      reportId: 'debtors',
      customers: [
        customer({ id: 1, name: 'Small', balance: 50 }),
        customer({ id: 2, name: 'Clear', balance: 0 }),
        customer({ id: 3, name: 'Big', balance: 900 }),
      ],
    })

    const rows = allRows(doc) as any[]
    expect(rows.map((r) => r.name)).toEqual(['Big', 'Small'])
    expect(stat(doc, 'Largest single debt')).toBe('$900.00')
  })
})

describe('salesman performance', () => {
  const invoices = [
    invoice({ id: 1, salesman: { id: 1, name: 'Ahmad' }, total_price: 100, paid_amount: 100 }),
    invoice({ id: 2, salesman: { id: 1, name: 'Ahmad' }, total_price: 200, paid_amount: 50 }),
    invoice({ id: 3, salesman: { id: 2, name: 'Sara' }, total_price: 900, paid_amount: 0 }),
  ]

  it('ranks on money, not on paperwork', () => {
    // Twenty small invoices is not out-selling three large ones, and the count
    // rides beside the total rather than deciding the order.
    const doc = build({ reportId: 'salesmen', invoices })
    const rows = allRows(doc) as any[]

    expect(rows.map((r) => r.name)).toEqual(['Sara', 'Ahmad'])
    expect(rows[1].invoices).toBe(2)
  })

  it('separates what was billed from what actually came in', () => {
    const doc = build({ reportId: 'salesmen', invoices })
    const ahmad = (allRows(doc) as any[]).find((r) => r.name === 'Ahmad')

    expect(ahmad.billed).toBe(300)
    expect(ahmad.collected).toBe(150)
    expect(ahmad.outstanding).toBe(150)
  })

  it('counts only invoices inside the window', () => {
    const doc = build({
      reportId: 'salesmen',
      invoices: [
        invoice({ id: 1, trs_date: '2026-03-15', total_price: 100 }),
        invoice({ id: 2, trs_date: '2026-01-01', total_price: 900 }),
      ],
      from: '2026-03-01',
      to: '2026-03-31',
    })

    expect(stat(doc, 'Billed')).toBe('$100.00')
  })
})

describe('product catalog', () => {
  const products = [
    product({ id: 1, name: 'Cola', category: 'Drinks', brand: 'Coke', stock: 10 }),
    product({ id: 2, name: 'Water', category: 'Drinks', brand: 'Aqua', stock: 0 }),
    product({ id: 3, name: 'Crisps', category: 'Snacks', brand: 'Lays', stock: 5 }),
  ]

  it('groups by category', () => {
    const doc = build({ reportId: 'products', products, breakdown: 'category' })

    expect(doc.groups.map((g) => g.title)).toEqual(['Drinks', 'Snacks'])
    expect(doc.groups[0].rows).toHaveLength(2)
  })

  it('groups by brand', () => {
    const doc = build({ reportId: 'products', products, breakdown: 'brand' })

    expect(doc.groups.map((g) => g.title)).toEqual(['Aqua', 'Coke', 'Lays'])
  })

  it('counts what is on the shelf and what is not', () => {
    const doc = build({ reportId: 'products', products })

    expect(stat(doc, 'In stock')).toBe('2')
    expect(stat(doc, 'Out of stock')).toBe('1')
    expect(stat(doc, 'Units on hand')).toBe('15')
  })
})

describe('best sellers', () => {
  const products = [
    product({ id: 1, name: 'Cola', category: 'Drinks', brand: 'Coke' }),
    product({ id: 2, name: 'Crisps', category: 'Snacks', brand: 'Lays' }),
  ]

  const sold = [
    invoice({
      id: 1,
      trs_date: '2026-03-10',
      rows: [
        { item_id: 1, item_code: 'P1', item_name: 'Cola', qty: 10, price: 5 },
        { item_id: 2, item_code: 'P2', item_name: 'Crisps', qty: 2, price: 50 },
      ] as unknown as Invoice['rows'],
    }),
    invoice({
      id: 2,
      trs_date: '2026-03-12',
      rows: [{ item_id: 1, item_code: 'P1', item_name: 'Cola', qty: 4, price: 5 }] as unknown as Invoice['rows'],
    }),
  ]

  it('adds a product up across every invoice it appears on', () => {
    const doc = build({ reportId: 'bestsellers', products, invoices: sold })
    const cola = (allRows(doc) as any[]).find((r) => r.name === 'Cola')

    expect(cola.units).toBe(14)
    expect(cola.value).toBe(70)
  })

  it('ranks by value, not by units shifted', () => {
    // Two boxes at fifty beats fourteen cans at five, and a best-seller list
    // ordered on units would put the cans first.
    const doc = build({ reportId: 'bestsellers', products, invoices: sold })

    expect((allRows(doc) as any[]).map((r) => r.name)).toEqual(['Crisps', 'Cola'])
  })

  it('takes category and brand from the catalog, not the invoice line', () => {
    const doc = build({
      reportId: 'bestsellers',
      products,
      invoices: sold,
      breakdown: 'category',
    })

    expect(doc.groups.map((g) => g.title)).toEqual(['Drinks', 'Snacks'])
  })

  it('respects the window', () => {
    const doc = build({
      reportId: 'bestsellers',
      products,
      invoices: sold,
      from: '2026-03-11',
      to: '2026-03-31',
    })

    expect(stat(doc, 'Units')).toBe('4')
  })

  it('explains itself when no invoice carried its lines', () => {
    // The list endpoint returns headers only, so this is the ordinary state
    // until invoices have been opened — a blank table would read as "nothing
    // sold", which is a different and wrong statement.
    const doc = build({ reportId: 'bestsellers', products, invoices: [invoice({ rows: [] })] })

    expect(allRows(doc)).toHaveLength(0)
    expect(doc.emptyMessage).toContain('opened individually')
  })
})

describe('invoice book', () => {
  const invoices = [
    invoice({ id: 1, trs_number: 'SI-1', total_price: 100, paid_amount: 100 }),
    invoice({ id: 2, trs_number: 'SI-2', total_price: 200, paid_amount: 50 }),
  ]

  it('totals billed, collected and what is still owed', () => {
    const doc = build({ reportId: 'invoices', invoices })

    expect(stat(doc, 'Billed')).toBe('$300.00')
    expect(stat(doc, 'Collected')).toBe('$150.00')
    expect(stat(doc, 'Still owed')).toBe('$150.00')
  })

  it('never reports a negative outstanding on an overpaid invoice', () => {
    const doc = build({
      reportId: 'invoices',
      invoices: [invoice({ total_price: 100, paid_amount: 130 })],
    })

    expect(stat(doc, 'Still owed')).toBe('$0.00')
  })

  it('splits settled from still owed', () => {
    const doc = build({ reportId: 'invoices', invoices, breakdown: 'settlement' })

    expect(doc.groups.map((g) => g.title).sort()).toEqual(['Settled', 'Still owed'])
  })

  it('groups by customer and by salesman', () => {
    const mixed = [
      invoice({ id: 1, customer: 'Alpha', salesman: { id: 1, name: 'Ahmad' } }),
      invoice({ id: 2, customer: 'Beta', salesman: { id: 1, name: 'Ahmad' } }),
    ]

    expect(
      build({ reportId: 'invoices', invoices: mixed, breakdown: 'customer' }).groups.map(
        (g) => g.title,
      ),
    ).toEqual(['Alpha', 'Beta'])

    expect(
      build({ reportId: 'invoices', invoices: mixed, breakdown: 'salesman' }).groups.map(
        (g) => g.title,
      ),
    ).toEqual(['Ahmad'])
  })
})

describe('column totals', () => {
  it('adds a footer total that matches the rows above it', () => {
    // The subtotal is computed from the same rows the table printed, so a
    // filtered report cannot show a footer belonging to a different set.
    const doc = build({
      reportId: 'customers',
      customers: [customer({ id: 1, balance: 100 }), customer({ id: 2, balance: 250 })],
    })

    const balance = doc.columns.find((c) => c.header === 'Balance')!
    const total = doc.groups[0].rows.reduce((sum, r) => sum + balance.total!(r), 0)

    expect(total).toBe(350)
  })

  it('leaves columns that make no sense to add without a total', () => {
    const doc = build({ reportId: 'customers', customers: [customer()] })

    expect(doc.columns.find((c) => c.header === 'Customer')?.total).toBeUndefined()
    // A limit is a ceiling per customer; summing it says nothing.
    expect(doc.columns.find((c) => c.header === 'Limit')?.total).toBeUndefined()
  })
})

describe('an unknown report', () => {
  it('returns an empty document rather than throwing', () => {
    const doc = build({ reportId: 'nope' })

    expect(doc.groups).toHaveLength(0)
    expect(doc.emptyMessage).toBeTruthy()
  })
})
