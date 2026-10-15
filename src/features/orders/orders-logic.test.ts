import { describe, expect, it } from 'vitest'
import { canCancel, canDecide, decidedBy, formatDay, formatLbp, formatMoney, orderPill } from './orders-logic'

describe('what an order may do next', () => {
  it('is decided only while it waits', () => {
    expect(canDecide({ status: 'SUBMITTED' })).toBe(true)
    expect(canDecide({ status: 'APPROVED' })).toBe(false)
    expect(canDecide({ status: 'REJECTED' })).toBe(false)
  })

  it('is cancelled while waiting or approved, never once delivered or ended', () => {
    expect(canCancel({ status: 'SUBMITTED' })).toBe(true)
    expect(canCancel({ status: 'APPROVED' })).toBe(true)
    expect(canCancel({ status: 'COMPLETED' })).toBe(false)
    expect(canCancel({ status: 'CANCELED' })).toBe(false)
  })
})

describe('how an order reads', () => {
  it('names each status as the office says it', () => {
    expect(orderPill('SUBMITTED')).toEqual({ status: 'pending', label: 'Waiting for approval' })
    expect(orderPill('COMPLETED').label).toBe('Delivered')
    // Drafts from before approvals were carried over as approved.
    expect(orderPill('DRAFT').label).toBe('Approved')
  })

  it('says whether the rules or a person approved it', () => {
    expect(decidedBy({ status: 'APPROVED', decided_by: null, decided_by_name: null })).toBe('Approved automatically by the rules')
    expect(decidedBy({ status: 'APPROVED', decided_by: 3, decided_by_name: 'Rania' })).toBe('Approved by Rania')
    expect(decidedBy({ status: 'REJECTED', decided_by: 3, decided_by_name: 'Rania' })).toBe('Rejected by Rania')
    expect(decidedBy({ status: 'SUBMITTED', decided_by: null, decided_by_name: null })).toBeNull()
  })

  it('formats money and days', () => {
    expect(formatMoney(1240.5)).toBe('$1,240.50')
    expect(formatLbp(10755000.4)).toBe('10,755,000 LL')
    expect(formatDay('2026-10-15')).toBe('Thu 15 Oct')
    expect(formatDay(null)).toBe('—')
  })
})
