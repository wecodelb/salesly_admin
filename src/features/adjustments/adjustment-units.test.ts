import { describe, expect, it } from 'vitest'
import { localDay, unitOptions } from './types'

const bottle = {
  uom: 'Bottle',
  uom_id: 1,
  uoms: [
    { uom_id: 1, unit: 1, is_base: true, uom: { id: 1, code: 'BTL', name: 'Bottle' } },
    { uom_id: 5, unit: 24, uom: { id: 5, code: 'CS', name: 'Case' } },
  ],
} as unknown as Parameters<typeof unitOptions>[0]

describe('unitOptions', () => {
  it('offers the base unit first, then each packaging with its factor', () => {
    expect(unitOptions(bottle)).toEqual([
      { value: '', label: 'Bottle (base)' },
      { value: '5', label: 'Case (24)' },
    ])
  })

  it('still offers a base unit before the product has loaded', () => {
    expect(unitOptions(undefined)).toEqual([{ value: '', label: 'Base unit' }])
  })

  it("keeps a saved row's unit on offer when the product no longer lists it", () => {
    // Otherwise the select would fall back to the base and saving would
    // re-read four cases as four bottles.
    const options = unitOptions(undefined, { uomId: '5', name: 'Case' })
    expect(options).toContainEqual({ value: '5', label: 'Case' })
  })

  it('does not list the base unit twice when a row names it by id', () => {
    expect(unitOptions(bottle, { uomId: '1', name: 'Bottle' })).toHaveLength(2)
  })
})

describe('localDay', () => {
  it('formats the local calendar date, not the UTC one', () => {
    // 00:30 local on 25 Sep is still the 25th here, whatever UTC says.
    expect(localDay(new Date(2026, 8, 25, 0, 30))).toBe('2026-09-25')
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
