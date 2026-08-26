import { describe, expect, it } from 'vitest'

import { customersExportDoc } from '@/features/customers/customers-export'
import { invoicesExportDoc } from '@/features/invoices/invoices-export'
import { productsExportDoc } from '@/features/products/products-export'
import { usersExportDoc } from '@/features/users/users-export'
import { scopeLine } from './report-format'
import type { AdminCustomer } from '@/features/customers/types'
import type { AdminItem } from '@/features/products/types'
import type { Invoice } from '@/features/invoices/types'
import type { CompanyUser } from '@/features/users/types'

/**
 * The documents the list screens print.
 *
 * The one thing all four have to get right is the subtitle. On screen the
 * filters are visible in the bar above the table; on paper they are gone, and
 * a narrowed list with nothing saying so is read as the complete book — which
 * is how somebody totals forty customers and acts on it as though it were four
 * hundred. Everything else here is ordinary column checking.
 */

const customer = (over: Partial<AdminCustomer> = {}) =>
  ({
    id: 1,
    code: 'C1',
    name: 'Corner Shop',
    phone1: '01 234 567',
    phone2: '',
    salesman_name: 'Ahmad',
    customer_group_name: 'Retail',
    balance: 400,
    credit_limit: null,
    is_active: true,
    ...over,
  }) as unknown as AdminCustomer

const product = (over: Partial<AdminItem> = {}) =>
  ({
    id: 1,
    code: 'P1',
    name: 'Cola 330ml',
    category: 'Drinks',
    brand: 'Coca-Cola',
    price_usd: 5,
    price_lbp: 447_500,
    available_qty: 10,
    ...over,
  }) as unknown as AdminItem

const invoice = (over: Partial<Invoice> = {}) =>
  ({
    id: 1,
    trs_number: 'SI-1',
    trs_date: '2026-03-15',
    customer: 'Corner Shop',
    salesman: { id: 1, name: 'Ahmad' },
    total_qty: 12,
    total_price: 100,
    paid_amount: 40,
    due_amount: 60,
    ...over,
  }) as unknown as Invoice

const user = (over: Partial<CompanyUser> = {}) =>
  ({
    id: 1,
    name: 'Ahmad Khalil',
    email: 'ahmad@co.com',
    phone: '03 111 222',
    role: 'salesman',
    permissions: ['a', 'b'],
    status: 'active',
    ...over,
  }) as unknown as CompanyUser

describe('scopeLine', () => {
  it('says the whole when nothing has been filtered away', () => {
    expect(scopeLine(310, 310, 'customers')).toBe('310 customers')
  })

  it('says how much of the whole a filtered page is', () => {
    // The "of 310" is the part that stops a filtered page being acted on as
    // though it were the complete book.
    expect(scopeLine(42, 310, 'customers')).toBe('42 of 310 customers')
  })

  it('lists the filters that narrowed it', () => {
    expect(scopeLine(42, 310, 'customers', ['Salesman: Ahmad', 'Owing'])).toBe(
      '42 of 310 customers · Salesman: Ahmad · Owing',
    )
  })

  it('drops the filters that are not set, rather than printing blanks', () => {
    expect(scopeLine(5, 5, 'users', ['', false, null, undefined, 'Role: admin'])).toBe(
      '5 users · Role: admin',
    )
  })
})

describe('the customers document', () => {
  it('says on the page that it is a filtered view', () => {
    const doc = customersExportDoc([customer()], 310, ['Salesman: Ahmad'])

    expect(doc.subtitle).toBe('1 of 310 customers · Salesman: Ahmad')
  })

  it('totals the balances it is showing', () => {
    const doc = customersExportDoc(
      [customer({ balance: 400 }), customer({ id: 2, balance: 150 })],
      2,
      [],
    )

    expect(doc.summary).toContainEqual({ label: 'Total owed', value: '$550.00' })
    expect(doc.columns.find((c) => c.header === 'Balance')?.total).toBeDefined()
  })

  it('writes no credit limit as a dash, not as zero', () => {
    // A customer with no limit is not credit-checked at all; one with a limit
    // of zero can buy nothing. On paper those must not look the same.
    const col = customersExportDoc([], 0, []).columns.find(
      (c) => c.header === 'Credit limit',
    )!

    expect(col.value(customer({ credit_limit: null }))).toBe('—')
    expect(col.value(customer({ credit_limit: 0 }))).toBe('$0.00')
  })

  it('calls a customer over limit only when a limit is actually set', () => {
    const col = customersExportDoc([], 0, []).columns.find(
      (c) => c.header === 'Standing',
    )!

    expect(col.value(customer({ balance: 400, credit_limit: null }))).toBe('Owing')
    expect(col.value(customer({ balance: 400, credit_limit: 300 }))).toBe('Over limit')
    expect(col.value(customer({ balance: 0 }))).toBe('Clear')
    expect(col.value(customer({ is_active: false }))).toBe('Inactive')
  })

  it('counts over-limit customers on the same rule as the column', () => {
    // These two disagreeing is the kind of thing nobody notices until the
    // summary says three and the reader counts five.
    const doc = customersExportDoc(
      [
        customer({ balance: 400, credit_limit: 300 }),
        customer({ id: 2, balance: 400, credit_limit: null }),
      ],
      2,
      [],
    )

    expect(doc.summary).toContainEqual({ label: 'Over limit', value: '1' })
  })
})

describe('the products document', () => {
  it('carries both prices, because the office quotes one and the van takes the other', () => {
    const doc = productsExportDoc([product()], 1, [])
    const usd = doc.columns.find((c) => c.header === 'Price (USD)')!
    const lbp = doc.columns.find((c) => c.header === 'Price (LBP)')!

    expect(usd.value(product())).toBe('$5.00')
    expect(lbp.value(product())).toBe('447,500')
  })

  it('writes an unpriced lira cell as a dash rather than zero', () => {
    const lbp = productsExportDoc([], 0, []).columns.find(
      (c) => c.header === 'Price (LBP)',
    )!

    expect(lbp.value(product({ price_lbp: null }))).toBe('—')
  })

  it('groups by category when nothing has already narrowed it', () => {
    const doc = productsExportDoc(
      [product(), product({ id: 2, category: 'Snacks' })],
      2,
      [],
      'category',
    )

    expect(doc.groups.map((g) => g.title)).toEqual(['Drinks', 'Snacks'])
    expect(doc.groups[0].caption).toContain('1 products')
  })

  it('prints flat when asked, with no heading saying nothing', () => {
    const doc = productsExportDoc([product()], 1, [], 'none')

    expect(doc.groups).toHaveLength(1)
    expect(doc.groups[0].title).toBe('')
  })

  it('names the grouping on the page so the headings are explained', () => {
    const doc = productsExportDoc([product()], 1, [], 'brand')

    expect(doc.subtitle).toContain('By brand')
  })
})

describe('the invoices document', () => {
  it('totals billed, collected and still owed', () => {
    const doc = invoicesExportDoc(
      [invoice(), invoice({ id: 2, total_price: 250, paid_amount: 0, due_amount: 250 })],
      2,
      [],
    )

    expect(doc.summary).toContainEqual({ label: 'Billed', value: '$350.00' })
    expect(doc.summary).toContainEqual({ label: 'Collected', value: '$40.00' })
    expect(doc.summary).toContainEqual({ label: 'Still owed', value: '$310.00' })
    expect(doc.summary).toContainEqual({ label: 'Unsettled', value: '2' })
  })

  it('prints the truncation warning the screen shows in a banner', () => {
    // On paper there is no amber banner above the table. If the note is not in
    // the subtitle, a partial read prints as a complete one.
    const doc = invoicesExportDoc([invoice()], 1, [
      'Partial read — most recent invoices only',
    ])

    expect(doc.subtitle).toContain('Partial read')
  })

  it('totals every money column, so the footer can be reconciled', () => {
    const doc = invoicesExportDoc([invoice()], 1, [])
    const totalled = doc.columns.filter((c) => c.total).map((c) => c.header)

    expect(totalled).toEqual(['Units', 'Billed', 'Collected', 'Still owed'])
  })
})

describe('the team document', () => {
  it('groups by role, which is the only way anybody asks for it', () => {
    const doc = usersExportDoc(
      [user(), user({ id: 2, name: 'Sara', role: 'manager' })],
      2,
      [],
    )

    expect(doc.groups.map((g) => g.title)).toEqual(['Manager', 'Salesman'])
  })

  it('counts permissions rather than listing forty slugs across the page', () => {
    const col = usersExportDoc([], 0, []).columns.find(
      (c) => c.header === 'Permissions',
    )!

    expect(col.value(user({ permissions: ['a', 'b', 'c'] as never }))).toBe('3')
  })

  it('says one person rather than one people', () => {
    const doc = usersExportDoc([user()], 1, [])

    expect(doc.groups[0].caption).toBe('1 person')
  })
})

describe('every screen document', () => {
  const docs = [
    ['customers', customersExportDoc([], 0, [])],
    ['products', productsExportDoc([], 0, [])],
    ['invoices', invoicesExportDoc([], 0, [])],
    ['team', usersExportDoc([], 0, [])],
  ] as const

  it.each(docs)('%s says so rather than printing an empty table', (_name, doc) => {
    expect(doc.emptyMessage).toBeTruthy()
    expect(doc.groups.every((g) => g.rows.length === 0)).toBe(true)
  })

  it.each(docs)('%s has a title and a self-describing subtitle', (_name, doc) => {
    expect(doc.title).toBeTruthy()
    expect(doc.subtitle).toBeTruthy()
  })

  it.each(docs)('%s gives every column a width hint', (_name, doc) => {
    // Without them the browser distributes columns by content and a printed
    // table's layout shifts between pages.
    expect(doc.columns.every((c) => c.width)).toBe(true)
  })
})
