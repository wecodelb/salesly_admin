import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrderPrintSheet } from './OrderPrintSheet'
import type { Order } from '../types'

const ORDER: Order = {
  id: 1,
  trs_number: 101,
  trs_date: '15/10/2026 09:00',
  status: 'APPROVED',
  customer: { id: 9, code: 'C-9', name: 'Al Watan Grocery', phone: '+961 3 000000', balance: 480, credit_limit: 500 },
  salesman: { id: 4, name: 'Ahmad Khalil' },
  warehouse: { id: 1, name: 'Main Warehouse' },
  delivery_date: '2026-10-16',
  deliverer: { id: 4, name: 'Ahmad Khalil' },
  submitted_at: null,
  decided_at: null,
  decided_by: 5,
  decided_by_name: 'Rania Khoury',
  hold_reasons: [],
  rejected_reason: null,
  total_qty: 60,
  total_price: 120,
  total_price_lbp: 10740000,
  currency: 'USD',
  memo: 'Back door',
  rows: [
    { id: 1, item_id: 3, uom_id: 2, trs_qty: 5, qty: 60, price: 2, total: 120, item_code: 'NES-1', item_name: 'Nescafé Classic 50g', uom_name: 'Box', unit: 12 },
  ],
}

describe('the order on paper', () => {
  it('is a print-only report, so the console around it never prints', () => {
    const { container } = render(<OrderPrintSheet order={ORDER} companyName="Nestle" />)
    const sheet = container.querySelector('.report-doc.is-print-only') as HTMLElement

    expect(sheet).not.toBeNull()
    expect(within(sheet).getByText('Nestle')).toBeInTheDocument()
    expect(within(sheet).getByText('Order #101')).toBeInTheDocument()
  })

  it('carries the shop, the lines in their packaging, the total and where the goods are', () => {
    const { container } = render(<OrderPrintSheet order={ORDER} companyName="Nestle" />)
    const sheet = within(container.querySelector('.report-doc') as HTMLElement)

    expect(sheet.getByText('Al Watan Grocery')).toBeInTheDocument()
    expect(sheet.getByText('Delivery Fri 16 Oct')).toBeInTheDocument()
    expect(sheet.getByText('Box')).toBeInTheDocument()
    expect(sheet.getByText('$24.00')).toBeInTheDocument()
    expect(sheet.getAllByText('$120.00').length).toBe(2)
    expect(sheet.getByText(/still in the warehouse/)).toBeInTheDocument()
    expect(sheet.getByText('Note: Back door')).toBeInTheDocument()
  })
})
