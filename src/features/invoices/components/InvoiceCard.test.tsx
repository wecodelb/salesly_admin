import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InvoiceCard } from './InvoiceCard'
import type { Invoice, InvoiceRow } from '../types'

/**
 * The customer's copy of an invoice.
 *
 * The console's other view of a sale answers operational questions. This one
 * answers the customer's: what did I buy, and what do I still owe. It gets
 * posted, filed and argued over months later, so the two things that matter are
 * that every figure on it is the figure the customer was given — not one
 * recomputed at today's rate — and that nothing quietly disappears when a field
 * is absent.
 */

const line = (over: Partial<InvoiceRow> = {}): InvoiceRow =>
  ({
    id: 1,
    lno: 1,
    item_id: 1,
    item_code: 'P1',
    item_name: 'Cola 330ml',
    uom_id: 1,
    uom_name: 'Case',
    unit: 24,
    trs_qty: 4,
    qty: 96,
    price: 0.5,
    cost: null,
    line_memo: null,
    ...over,
  }) as InvoiceRow

const invoice = (over: Partial<Invoice> = {}): Invoice =>
  ({
    id: 1,
    trs_number: 'SI-42',
    trs_date: '15/03/2026 10:00',
    trs_barcode: null,
    notes: null,
    customer: 'Corner Shop',
    customer_id: 1,
    customer_phone: '01 234 567',
    customer_address: 'Hamra, Beirut',
    total_qty: 96,
    total_price: 48,
    paid_amount: 20,
    due_amount: 28,
    payment_method: 'cash',
    currency: 'USD',
    exchange_rate: 89500,
    payments: [],
    is_van_sale: false,
    salesman: { id: 1, name: 'Ahmad' },
    signature_path: null,
    latitude: null,
    longitude: null,
    rows: [line()],
    ...over,
  }) as unknown as Invoice

const draw = (inv: Invoice = invoice()) =>
  render(<InvoiceCard invoice={inv} companyName="Nestle Lebanon" />)

describe('the masthead', () => {
  it('names the distributor, the invoice and the day', () => {
    // A page found loose in a folder has to say what it is and whose it is.
    draw()

    const masthead = within(document.querySelector('.report-masthead') as HTMLElement)
    expect(masthead.getByText('Nestle Lebanon')).toBeInTheDocument()
    expect(masthead.getByText('Invoice SI-42')).toBeInTheDocument()
    expect(masthead.getByText('15/03/2026 10:00')).toBeInTheDocument()
  })

  it('quotes the rate the document was written at, not today’s', () => {
    // A copy printed next month has to give the customer the figure he was
    // given, or the two of them are reading different invoices.
    draw()

    expect(screen.getByText(/1 USD = 89,500 LBP/)).toBeInTheDocument()
  })

  it('says nothing about a rate when none was stamped', () => {
    const { container } = draw(invoice({ exchange_rate: null }))

    expect(container.textContent).not.toContain('LBP')
  })

  it('falls back to the id when the document has no number yet', () => {
    draw(invoice({ trs_number: '' }))

    expect(screen.getAllByText(/Invoice #1/).length).toBeGreaterThan(0)
  })
})

describe('who it is for', () => {
  it('carries the address and phone, so it can actually be posted', () => {
    draw()

    const parties = within(document.querySelector('.invoice-parties') as HTMLElement)
    expect(parties.getByText('Corner Shop')).toBeInTheDocument()
    expect(parties.getByText('Hamra, Beirut')).toBeInTheDocument()
    expect(parties.getByText('01 234 567')).toBeInTheDocument()
    expect(parties.getByText('Ahmad')).toBeInTheDocument()
  })

  it('leaves out an address it does not have rather than printing a blank line', () => {
    const { container } = draw(invoice({ customer_address: '', customer_phone: '' }))
    const parties = container.querySelector('.invoice-parties') as HTMLElement

    expect(parties.querySelectorAll('p')).toHaveLength(2)
  })

  it('says when the sale came off the van, because that is a different document', () => {
    draw(invoice({ is_van_sale: true }))

    expect(screen.getByText('Sold from the van')).toBeInTheDocument()
  })
})

describe('the lines', () => {
  it('bills the packaging the customer agreed to, not the base units', () => {
    // Four cases is what was agreed; ninety-six bottles is what left the depot.
    // An invoice saying 96 is one the customer will dispute.
    draw()

    const body = document.querySelector('.report-table tbody') as HTMLElement
    expect(within(body).getByText('4')).toBeInTheDocument()
    expect(within(body).getByText('Case')).toBeInTheDocument()
  })

  it('extends each line from the base quantity, which is what was priced', () => {
    // 96 base units at $0.50 is $48 — the price is per base unit, so extending
    // by the case count would bill the customer $2.
    draw()

    const body = document.querySelector('.report-table tbody') as HTMLElement
    expect(within(body).getByText('$48.00')).toBeInTheDocument()
  })

  it('prints a line memo beside the item it qualifies', () => {
    draw(invoice({ rows: [line({ line_memo: 'short-dated' })] }))

    expect(screen.getByText(/Cola 330ml — short-dated/)).toBeInTheDocument()
  })

  it('says so when the lines have not been loaded rather than showing an empty table', () => {
    draw(invoice({ rows: undefined }))

    expect(screen.getByText(/no lines/i)).toBeInTheDocument()
    expect(document.querySelector('.report-table')).toBeNull()
  })

  it('uses a real thead, which is what repeats the headings across pages', () => {
    draw()

    expect(document.querySelector('.report-table thead')).not.toBeNull()
  })
})

describe('the totals', () => {
  it('shows what is still owed, and calls it that', () => {
    draw()

    const totals = document.querySelector('.invoice-totals') as HTMLElement
    expect(within(totals).getByText('Total')).toBeInTheDocument()
    expect(within(totals).getByText('$48.00')).toBeInTheDocument()
    expect(within(totals).getByText('Balance due')).toBeInTheDocument()
    expect(within(totals).getByText('$28.00')).toBeInTheDocument()
  })

  it('says Settled rather than a balance of nothing', () => {
    // "Balance due $0.00" reads as a demand. It is not one.
    draw(invoice({ paid_amount: 48, due_amount: 0 }))

    const totals = document.querySelector('.invoice-totals') as HTMLElement
    expect(within(totals).getByText('Settled')).toBeInTheDocument()
    expect(within(totals).queryByText('Balance due')).toBeNull()
  })

  it('reads the due figure from the server rather than deriving it', () => {
    // The console and the phone must not be able to disagree about a debt, so
    // the arithmetic is done in one place and this only prints it.
    draw(invoice({ total_price: 100, paid_amount: 40, due_amount: 55 }))

    const totals = document.querySelector('.invoice-totals') as HTMLElement
    expect(within(totals).getByText('$55.00')).toBeInTheDocument()
  })
})

describe('how it was paid', () => {
  it('breaks down a mixed tender, in the money the customer counted', () => {
    // An invoice showing only the converted total is one the customer cannot
    // check against his own pocket.
    draw(
      invoice({
        payments: [
          { method: 'cash', amount: 20, currency: 'USD', value: 20, exchange_rate: null, reference: null },
          { method: 'whish', amount: 1790000, currency: 'LBP', value: 20, exchange_rate: 89500, reference: 'W-9' },
        ],
      }),
    )

    const box = within(document.querySelector('.invoice-tenders') as HTMLElement)
    expect(box.getByText(/1,790,000 LBP/)).toBeInTheDocument()
    expect(box.getByText(/W-9/)).toBeInTheDocument()
  })

  it('spells out a single foreign tender too', () => {
    // One lira payment still needs its own line: the total says dollars and the
    // customer handed over lira.
    draw(
      invoice({
        payments: [
          { method: 'cash', amount: 4296000, currency: 'LBP', value: 48, exchange_rate: 89500, reference: null },
        ],
      }),
    )

    expect(document.querySelector('.invoice-tenders')).not.toBeNull()
  })

  it('does not open a breakdown for a plain cash sale', () => {
    // A one-row breakdown repeating what the line above already said reads as
    // though something more complicated happened.
    draw()

    expect(document.querySelector('.invoice-tenders')).toBeNull()
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })
})

describe('the signature block', () => {
  it('rules a line for a signature that has not been given', () => {
    draw()

    const block = within(document.querySelector('.invoice-signature') as HTMLElement)
    expect(block.getByText('Customer signature')).toBeInTheDocument()
  })

  it('says so when the customer already signed on delivery', () => {
    // A ruled line under a document already signed for invites a second one.
    draw(invoice({ signature_path: 'signatures/1.png' }))

    expect(screen.getByText(/Signed for by the customer/)).toBeInTheDocument()
  })
})

describe('as a printed page', () => {
  it('is a report-doc, so the print rules hide the console around it', () => {
    const { container } = draw()

    expect(container.querySelector('.report-doc')).not.toBeNull()
  })

  it('repeats the company and the number in a footer for later pages', () => {
    const { container } = draw()
    const footer = container.querySelector('.report-footer')

    expect(footer!.textContent).toContain('Nestle Lebanon')
    expect(footer!.textContent).toContain('SI-42')
  })

  it('writes no undefined or NaN anywhere, on the emptiest invoice there can be', () => {
    const { container } = render(
      <InvoiceCard
        invoice={{ id: 7 } as unknown as Invoice}
        companyName="Nestle Lebanon"
      />,
    )

    expect(container.textContent).not.toContain('undefined')
    expect(container.textContent).not.toContain('NaN')
    expect(container.textContent).not.toContain('[object Object]')
  })
})
