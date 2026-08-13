import { describe, expect, it } from 'vitest'
import {
  describeTender,
  invoicePill,
  isSettled,
  isUnpaid,
  paymentMethodLabel,
  totalsOf,
  type Invoice,
  type InvoicePayment,
} from './types'

/** Only the fields the arithmetic reads; the rest of an invoice is irrelevant here. */
function invoice(
  total: number,
  paid: number,
  extra: Partial<Invoice> = {},
): Invoice {
  return {
    id: 1,
    customer: 'Corner Shop',
    customer_id: 9,
    trs_barcode: null,
    trs_number: 'SI-1',
    trs_date: '12/08/2026',
    notes: null,
    total_qty: 10,
    total_price: total,
    paid_amount: paid,
    // Server-computed in production; mirrored here so the fixtures stay honest.
    due_amount: Math.max(0, Math.round((total - paid) * 100) / 100),
    payment_method: 'cash',
    currency: 'USD',
    is_van_sale: true,
    salesman: { id: 3, name: 'Ahmad' },
    signature_path: 'signatures/1/1.png',
    latitude: null,
    longitude: null,
    ...extra,
  }
}

describe('settlement', () => {
  it('reads a fully paid invoice as settled', () => {
    expect(isSettled(invoice(50, 50))).toBe(true)
  })

  it('reads a part payment as not settled', () => {
    expect(isSettled(invoice(50, 20))).toBe(false)
  })

  it('treats an overpayment as settled rather than owing a negative', () => {
    // due_amount is floored at zero server-side; a screen showing "-$5 owed"
    // would send somebody to collect money the customer does not owe.
    expect(isSettled(invoice(50, 60))).toBe(true)
  })

  it('tells nothing-paid apart from part-paid', () => {
    expect(isUnpaid(invoice(50, 0))).toBe(true)
    expect(isUnpaid(invoice(50, 20))).toBe(false)
  })
})

describe('invoicePill', () => {
  it('calls a part payment part paid, never unpaid', () => {
    // "Unpaid" on an invoice a customer has already put money against is the
    // kind of wrongness that gets argued about at a till.
    expect(invoicePill(invoice(50, 20)).label).toBe('Part paid')
    expect(invoicePill(invoice(50, 20)).status).toBe('warning')
  })

  it('is paid once nothing is owed', () => {
    expect(invoicePill(invoice(50, 50)).label).toBe('Paid')
    expect(invoicePill(invoice(50, 50)).status).toBe('success')
  })

  it('is unpaid only when nothing has been collected', () => {
    expect(invoicePill(invoice(50, 0)).label).toBe('Unpaid')
    expect(invoicePill(invoice(50, 0)).status).toBe('error')
  })
})

describe('totalsOf', () => {
  it('adds up billed, collected and still owed', () => {
    const totals = totalsOf([invoice(50, 50), invoice(30, 10), invoice(20, 0)])

    expect(totals.billed).toBe(100)
    expect(totals.collected).toBe(60)
    expect(totals.outstanding).toBe(40)
    expect(totals.count).toBe(3)
  })

  it('counts only what is unsettled', () => {
    const totals = totalsOf([invoice(50, 50), invoice(30, 10), invoice(20, 0)])

    expect(totals.unpaidCount).toBe(2)
  })

  it('does not let float error leak into a money figure', () => {
    // 0.1 + 0.2 is the classic; a strip reading 30.000000000000004 undermines
    // every other number on the page.
    const totals = totalsOf([invoice(0.1, 0), invoice(0.2, 0)])

    expect(totals.billed).toBe(0.3)
  })

  it('is all zeroes on an empty list rather than NaN', () => {
    const totals = totalsOf([])

    expect(totals).toEqual({
      billed: 0,
      collected: 0,
      outstanding: 0,
      unpaidCount: 0,
      count: 0,
    })
  })

  it('never reports negative outstanding from an overpayment', () => {
    const totals = totalsOf([invoice(50, 80), invoice(20, 0)])

    // The overpaid document contributes nothing owed, so the figure describes
    // what is actually collectable rather than netting one customer's credit
    // against another's debt.
    expect(totals.outstanding).toBe(20)
  })
})

describe('tender breakdown', () => {
  const tender = (over: Partial<InvoicePayment> = {}): InvoicePayment => ({
    method: 'cash',
    amount: 40,
    currency: 'USD',
    value: 40,
    exchange_rate: null,
    reference: null,
    ...over,
  })

  it('names the method on a line that needed no conversion', () => {
    expect(describeTender(tender())).toBe('Cash')
    expect(describeTender(tender({ method: 'whish' }))).toBe('Whish')
    expect(describeTender(tender({ method: 'account' }))).toBe('On account')
  })

  it('keeps the notes the customer counted out on a foreign line', () => {
    // The converted figure alone would mean the console cannot reproduce the
    // receipt the customer is holding.
    expect(
      describeTender(
        tender({ amount: 89_500, currency: 'LBP', value: 10, exchange_rate: 8950 }),
      ),
    ).toBe('Cash · 89,500 LBP')
  })

  it('passes an unrecognised method through rather than blanking it', () => {
    expect(paymentMethodLabel('bitcoin')).toBe('bitcoin')
    expect(paymentMethodLabel(null)).toBe('—')
  })
})
