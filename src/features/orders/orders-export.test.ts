import { describe, expect, it } from 'vitest'
import { ordersExportDoc } from './orders-export'
import type { Order } from './types'

const order = (id: number, status: string, total: number): Order =>
  ({
    id,
    trs_number: 100 + id,
    trs_date: '15/10/2026 09:00',
    status,
    customer: { id: 9, code: 'C-9', name: 'Al Watan Grocery', phone: null, balance: 0, credit_limit: 0 },
    salesman: { id: 4, name: 'Ahmad Khalil' },
    warehouse: { id: 1, name: 'Main Warehouse' },
    delivery_date: '2026-10-16',
    deliverer: { id: 4, name: 'Ahmad Khalil' },
    hold_reasons: [],
    total_price: total,
  }) as unknown as Order

describe('the orders list on paper', () => {
  it('says how much of the book it is and which filters narrowed it', () => {
    const doc = ordersExportDoc([order(1, 'SUBMITTED', 120)], 40, ['Customer: Al Watan Grocery', false])

    expect(doc.subtitle).toBe('1 of 40 orders · Customer: Al Watan Grocery')
  })

  it('totals the value and counts what waits and what is approved', () => {
    const doc = ordersExportDoc(
      [order(1, 'SUBMITTED', 120), order(2, 'APPROVED', 80.5), order(3, 'REJECTED', 10)],
      3,
      [],
    )

    expect(doc.summary?.map((s) => [s.label, s.value])).toEqual([
      ['Orders', '3'],
      ['Value', '$210.50'],
      ['Waiting for approval', '1'],
      ['Approved', '1'],
    ])
    const status = doc.columns.find((c) => c.header === 'Status')!
    expect(status.value(doc.groups[0].rows[0])).toBe('Waiting for approval')
  })
})
