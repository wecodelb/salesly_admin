import { describe as group, expect, it } from 'vitest'
import {
  describe,
  formatAmount,
  formatDwell,
  hasAmount,
  timeAgo,
  type ActivityEvent,
} from './types'

function event(over: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'doc-1',
    kind: 'invoice',
    at: '2026-09-09T10:00:00+00:00',
    reference: '#417',
    document_id: 1,
    status: 'CONFIRMED',
    customer_id: 2,
    customer_name: 'Corner Shop',
    salesman_id: 5,
    salesman_name: 'Ahmad',
    amount: 250,
    currency: 'USD',
    ...over,
  }
}

group('what an event says happened', () => {
  it('names the document for a document', () => {
    expect(describe(event())).toBe('Invoice')
    expect(describe(event({ kind: 'return' }))).toBe('Return')
    expect(describe(event({ kind: 'collection' }))).toBe('Collection')
  })

  it('tells arriving from leaving', () => {
    // Both are the same visit. Calling both "Visit" would read as the shop
    // being called on twice.
    expect(describe(event({ kind: 'visit', status: 'checked_in' }))).toBe(
      'Arrived at the shop',
    )
    expect(describe(event({ kind: 'visit', status: 'checked_out' }))).toBe(
      'Left the shop',
    )
  })
})

group('money on the row', () => {
  it('is shown for the kinds that carry it', () => {
    expect(hasAmount(event())).toBe(true)
    expect(formatAmount(event())).toBe('$250')
  })

  it('is never shown against a shop door', () => {
    // A visit has no value, and a zero there would read as a sale of nothing.
    const visit = event({ kind: 'visit', amount: null, status: 'checked_in' })
    expect(hasAmount(visit)).toBe(false)
    expect(formatAmount(visit)).toBe('—')
  })

  it('is absent when the document carries no total', () => {
    expect(formatAmount(event({ amount: null }))).toBe('—')
  })
})

group('how long ago', () => {
  const now = new Date('2026-09-09T12:00:00+00:00')

  it('reads in the unit a person would use', () => {
    expect(timeAgo('2026-09-09T11:59:40+00:00', now)).toBe('just now')
    expect(timeAgo('2026-09-09T11:40:00+00:00', now)).toBe('20 min ago')
    expect(timeAgo('2026-09-09T09:00:00+00:00', now)).toBe('3 h ago')
    expect(timeAgo('2026-09-07T12:00:00+00:00', now)).toBe('2 d ago')
  })

  it('survives a document written without a date', () => {
    expect(timeAgo(null, now)).toBe('—')
    expect(timeAgo('not a date', now)).toBe('—')
  })

  it('never counts forwards', () => {
    // A phone whose clock runs fast would otherwise report a negative age.
    expect(timeAgo('2026-09-09T12:05:00+00:00', now)).toBe('just now')
  })
})

group('how long he was inside', () => {
  it('reads in minutes, then hours', () => {
    expect(formatDwell(event({ kind: 'visit', minutes: 45 }))).toBe('45 min')
    expect(formatDwell(event({ kind: 'visit', minutes: 60 }))).toBe('1 h')
    expect(formatDwell(event({ kind: 'visit', minutes: 95 }))).toBe('1 h 35 min')
  })

  it('says nothing about a visit still open', () => {
    expect(formatDwell(event({ kind: 'visit', minutes: null }))).toBe('—')
  })
})
