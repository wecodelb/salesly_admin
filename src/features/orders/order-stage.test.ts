import { describe, expect, it } from 'vitest'
import { goodsStage } from './order-stage'

const order = (
  status: string,
  invoice: { id: number; trs_number: number; trs_date: string } | null = null,
  loaded_at: string | null = null,
) => ({
  status: status as never,
  warehouse: { id: 1, name: 'Main Warehouse' },
  deliverer: { id: 7, name: 'Ahmad Khalil' },
  invoice,
  loaded_at,
})

describe('where an order\'s goods are', () => {
  it('holds nothing while the order waits', () => {
    expect(goodsStage(order('SUBMITTED'))).toMatchObject({ key: 'waiting', reached: 1 })
  })

  it('keeps approved goods in the warehouse until the salesman signs for his load', () => {
    const stage = goodsStage(order('APPROVED'))
    expect(stage).toMatchObject({ key: 'held', reached: 2 })
    expect(stage.sentence).toBe(
      "Held for this order in Main Warehouse — still in the warehouse. They move to Ahmad Khalil's van only when he signs for them on his load.",
    )
  })

  it('reads an order the salesman has signed for as on his van', () => {
    const stage = goodsStage(order('APPROVED', null, '19/10/2026 09:30'))
    expect(stage).toMatchObject({ key: 'onVan', reached: 3 })
    expect(stage.sentence).toBe(
      "On Ahmad Khalil's van since 19/10/2026 09:30 — signed for on his load and held there for this shop until he delivers it.",
    )
  })

  it('names the invoice a delivered order became', () => {
    expect(goodsStage(order('COMPLETED', { id: 40, trs_number: 12, trs_date: '20/10/2026' })).sentence).toBe(
      'Delivered, as invoice #12.',
    )
  })

  it('says a rejected or cancelled order holds nothing', () => {
    expect(goodsStage(order('REJECTED')).sentence).toContain('nothing was held')
    expect(goodsStage(order('CANCELED')).sentence).toContain('nothing is held')
  })
})
