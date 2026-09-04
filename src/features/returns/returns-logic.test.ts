import { describe, expect, it } from 'vitest'

import { owesRefund, returnPill, rowsOf, totalsOf, type SalesReturn } from './types'
import { returnsExportDoc } from './returns-export'

/**
 * Goods customers have handed back.
 *
 * Everything here is about one distinction: what the goods were worth versus
 * what actually came off the customer's balance. On most returns they are the
 * same number. On the day they are not, a shop handed back goods it had
 * already paid for and is owed a refund — and netting the two figures is
 * exactly how that stops being anybody's problem.
 */

const doc = (over: Partial<SalesReturn> = {}): SalesReturn =>
  ({
    id: 1,
    trs_number: 14,
    trs_date: '12/03/2026 18:40',
    status: 'CONFIRMED',
    customer_id: 3,
    customer: { id: 3, code: 'C1', name: 'Corner Shop' },
    salesman: { id: 7, name: 'Ahmad Khalil' },
    warehouse: { id: 2, code: 'DP1', name: 'Van 3' },
    currency: 'USD',
    exchange_rate: 0,
    total_qty: 4,
    total_price: 20,
    credit_value: 20,
    credit_applied: 20,
    credit_excess: 0,
    memo: '',
    ...over,
  }) as SalesReturn

describe('telling a settled return from one that owes money', () => {
  it('an ordinary return owes nothing', () => {
    expect(owesRefund(doc())).toBe(false)
    expect(returnPill(doc())).toEqual({ status: 'success', label: 'Credited' })
  })

  it('goods already paid for leave a refund owing, and it is flagged', () => {
    const paid = doc({ credit_value: 20, credit_applied: 0, credit_excess: 20 })

    expect(owesRefund(paid)).toBe(true)
    expect(returnPill(paid)).toEqual({ status: 'warning', label: 'Refund owing' })
  })

  it('a part-credited return counts as owing', () => {
    // Eight of the twenty landed on an invoice; twelve did not. That twelve is
    // owed, and a screen calling this "credited" would bury it.
    expect(owesRefund(doc({ credit_applied: 8, credit_excess: 12 }))).toBe(true)
  })

  it('survives a document with the field missing entirely', () => {
    expect(owesRefund({} as SalesReturn)).toBe(false)
  })
})

describe('the totals above the table', () => {
  const rows = [
    doc({ id: 1, total_qty: 4, credit_value: 20, credit_applied: 20, credit_excess: 0 }),
    doc({ id: 2, total_qty: 6, credit_value: 30, credit_applied: 18, credit_excess: 12 }),
    doc({ id: 3, total_qty: 2, credit_value: 10, credit_applied: 0, credit_excess: 10 }),
  ]

  it('keeps what the goods were worth apart from what was credited', () => {
    const totals = totalsOf(rows)

    expect(totals.count).toBe(3)
    expect(totals.units).toBe(12)
    expect(totals.value).toBe(60)
    expect(totals.credited).toBe(38)
    expect(totals.owed).toBe(22)
  })

  it('credited and owed come to the value of the goods', () => {
    // The invariant behind the whole feature: nothing is created or lost
    // between the crates and the ledger.
    const totals = totalsOf(rows)

    expect(totals.credited + totals.owed).toBe(totals.value)
  })

  it('a non-finite figure does not poison the totals', () => {
    // One bad row used to turn every figure in the strip into NaN.
    const totals = totalsOf([
      ...rows,
      doc({ id: 4, total_qty: NaN, credit_value: NaN, credit_applied: NaN, credit_excess: NaN }),
    ])

    expect(Number.isFinite(totals.units)).toBe(true)
    expect(totals.credited).toBe(38)
  })

  it('totals nothing over an empty list rather than throwing', () => {
    expect(totalsOf([])).toEqual({ count: 0, units: 0, value: 0, credited: 0, owed: 0 })
  })
})

describe('reading the lines', () => {
  it('a list row has no lines rather than an empty document', () => {
    expect(rowsOf(doc())).toEqual([])
  })

  it('a missing rows key does not take the screen down', () => {
    expect(rowsOf({ rows: undefined } as unknown as SalesReturn)).toEqual([])
    expect(rowsOf({ rows: null } as unknown as SalesReturn)).toEqual([])
  })
})

describe('the printed page', () => {
  const rows = [
    doc({ id: 1, trs_number: 14, total_qty: 4, credit_applied: 20, credit_excess: 0 }),
    doc({ id: 2, trs_number: 15, total_qty: 6, credit_applied: 18, credit_excess: 12 }),
  ]

  it('totals only the refunds actually owing', () => {
    const printed = returnsExportDoc(rows, rows.length, '', false)

    expect(printed.summary?.find((s) => s.label === 'Refunds owing')?.value).toBe('12')
    expect(printed.summary?.find((s) => s.label === 'Credited')?.value).toBe('38')
  })

  it('prints a dash rather than nought where nothing is owed', () => {
    // A column of zeroes reads as "everything is fine" at a glance; a column
    // of dashes with one number in it reads as "look here".
    const printed = returnsExportDoc(rows, rows.length, '', false)
    const column = printed.columns.find((c) => c.header === 'Refund owing')

    expect(column?.value(rows[0])).toBe('—')
    expect(column?.value(rows[1])).toBe('12')
  })

  it('says what it was narrowed by, so a partial page cannot read as the whole', () => {
    const printed = returnsExportDoc([rows[0]], rows.length, 'corner', 'Status: owing')

    expect(printed.subtitle).toMatch(/corner/i)
    expect(printed.subtitle).toMatch(/owing/i)
    expect(printed.subtitle).toMatch(/1 of 2/)
  })

  it('names the customer and the salesman, which is how a round is checked', () => {
    const printed = returnsExportDoc(rows, rows.length, '', false)

    expect(printed.columns.find((c) => c.header === 'Customer')?.value(rows[0]))
      .toBe('Corner Shop')
    expect(printed.columns.find((c) => c.header === 'Salesman')?.value(rows[0]))
      .toBe('Ahmad Khalil')
  })
})
