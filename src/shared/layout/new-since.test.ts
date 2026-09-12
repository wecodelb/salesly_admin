import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { countNewer, lastSeen, markSeen } from './new-since'

/**
 * "New since you last looked" — the counts on Invoices and Returns.
 */

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('when a screen was last seen', () => {
  it('starts a fresh browser at the start of today, so today’s documents read as new', () => {
    const now = new Date(2026, 8, 12, 15, 30)

    expect(lastSeen('invoices', now)).toBe(new Date(2026, 8, 12).getTime())
  })

  it('remembers the moment the screen was opened', () => {
    const at = new Date(2026, 8, 12, 16, 0).getTime()
    markSeen('returns', at)

    expect(lastSeen('returns')).toBe(at)
  })

  it('keeps each screen’s mark apart', () => {
    markSeen('invoices', 1000)

    expect(lastSeen('returns', new Date(2026, 8, 12, 9))).not.toBe(1000)
  })
})

describe('counting what is new', () => {
  const since = new Date(2026, 8, 12, 12, 0).getTime()

  it('counts documents dated after the mark, in the API’s own date format', () => {
    expect(
      countNewer(['12/09/2026 12:30', '12/09/2026 11:59', '11/09/2026 18:00', '2026-09-12T13:00:00'], since),
    ).toBe(2)
  })

  it('never counts a document with no date as new', () => {
    expect(countNewer([null, undefined, '', 'nonsense'], since)).toBe(0)
  })
})
