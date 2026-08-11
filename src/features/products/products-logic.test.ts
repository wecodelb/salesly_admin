import { describe, expect, it } from 'vitest'
import {
  carrierLine,
  distributionPill,
  distributionTotals,
  effectiveUsd,
  formatLbp,
  formatUsd,
  levelBreach,
  levelLabel,
  levelPill,
  type AdminItem,
  type ItemDistribution,
  type ItemLevel,
} from './types'

function item(overrides: Partial<AdminItem> = {}): AdminItem {
  return {
    id: 1,
    code: 'IT-1',
    name: 'Item',
    category: '',
    category_id: null,
    price: 10,
    price_usd: 10,
    price_lbp: 895000,
    exchange_rate: 89500,
    price_1: 10,
    price_2: 0,
    price_3: 0,
    stock: 5,
    available_qty: 5,
    cost: 6,
    promo: null,
    ...overrides,
  }
}

describe('formatUsd', () => {
  it('prefixes a dollar sign and groups thousands', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.5')
  })
  it('renders negatives with the sign before the dollar', () => {
    expect(formatUsd(-42)).toBe('-$42')
  })
})

describe('formatLbp', () => {
  it('groups thousands, drops decimals and suffixes LL', () => {
    expect(formatLbp(895000)).toBe('895,000 LL')
  })
})

describe('effectiveUsd', () => {
  it('is the base price when there is no promo', () => {
    expect(effectiveUsd(item())).toBe(10)
  })
  it('is the promo price when a promo is active', () => {
    expect(
      effectiveUsd(
        item({ promo: { id: 3, type: 'percent', value: 10, price_usd: 9, price_lbp: 805500 } }),
      ),
    ).toBe(9)
  })
})

/** One stock location, defaulting to a plain warehouse with nothing claimed. */
function location(overrides: Partial<ItemDistribution> = {}): ItemDistribution {
  return {
    warehouse: {
      id: 1,
      code: 'MAIN',
      name: 'Main Warehouse',
      is_depot: false,
      max_weight: null,
      max_volume: null,
    },
    qty: 49,
    available_qty: 44,
    reserved_qty: 5,
    ...overrides,
  }
}

/** A salesman's depot, optionally with the endpoint naming who holds it. */
function depot(overrides: Partial<ItemDistribution> = {}, salesman: string | null = null) {
  return location({
    warehouse: {
      id: 2,
      code: 'DEP-1',
      name: 'Depot 1',
      is_depot: true,
      max_weight: null,
      max_volume: null,
      salesman: salesman ? { id: 7, name: salesman } : null,
    },
    ...overrides,
  })
}

describe('distributionTotals', () => {
  // The three figures ITM-0110 actually reports across its three locations.
  const rows = [
    depot({ qty: 49, available_qty: 44, reserved_qty: 5 }),
    location({ qty: 88, available_qty: 48, reserved_qty: 0 }),
    location({ qty: 17, available_qty: 0, reserved_qty: 0 }),
  ]

  it('sums each figure in its own right', () => {
    const totals = distributionTotals(rows)
    expect(totals.qty).toBe(154)
    expect(totals.available_qty).toBe(92)
    expect(totals.reserved_qty).toBe(5)
  })

  it('does not infer available from qty minus reserved', () => {
    // The 17 that are neither free nor reserved would come back as sellable —
    // 149 rather than 92 — if the total were derived instead of summed from
    // what each location reports.
    const totals = distributionTotals(rows)
    expect(totals.available_qty).not.toBe(totals.qty - totals.reserved_qty)
  })

  it('counts the locations and the share riding in depots', () => {
    const totals = distributionTotals(rows)
    expect(totals.locations).toBe(3)
    expect(totals.depots).toBe(1)
    expect(totals.depot_qty).toBe(49)
  })

  it('is all zeros for a product nobody has ever stocked', () => {
    expect(distributionTotals([])).toEqual({
      qty: 0,
      available_qty: 0,
      reserved_qty: 0,
      depot_qty: 0,
      locations: 0,
      depots: 0,
    })
  })

  it('treats a missing figure as nothing rather than poisoning the total', () => {
    const absent = undefined as unknown as number
    const withGap = [
      location({ qty: 10, available_qty: 10, reserved_qty: 0 }),
      location({ qty: absent, available_qty: absent, reserved_qty: absent }),
    ]
    expect(distributionTotals(withGap).qty).toBe(10)
  })
})

describe('distributionPill', () => {
  it('calls a location with stock but nothing free committed, never out of stock', () => {
    const pill = distributionPill(location({ qty: 17, available_qty: 0, reserved_qty: 17 }))
    expect(pill.label).toBe('Fully committed')
    expect(pill.status).toBe('warning')
  })

  it('still reads as committed when the reservation is not itemised', () => {
    // The 17/0/0 case from real data: nothing free, and the claim recorded
    // somewhere other than reserved_qty. It is stock, not a hole.
    expect(distributionPill(location({ qty: 17, available_qty: 0, reserved_qty: 0 })).label).toBe(
      'Fully committed',
    )
  })

  it('calls an empty location out of stock', () => {
    const pill = distributionPill(location({ qty: 0, available_qty: 0, reserved_qty: 0 }))
    expect(pill.label).toBe('Out of stock')
    expect(pill.status).toBe('error')
  })

  it('names what is left where part of the stock is claimed', () => {
    expect(distributionPill(location({ qty: 49, available_qty: 44, reserved_qty: 5 }))).toEqual({
      status: 'active',
      label: '44 free',
    })
  })

  it('reads as plainly available when nothing is claimed', () => {
    expect(distributionPill(location({ qty: 88, available_qty: 88, reserved_qty: 0 })).label).toBe(
      'Available',
    )
  })
})

describe('carrierLine', () => {
  it('names the salesman holding a depot and what he has', () => {
    expect(carrierLine(depot({ qty: 12 }, 'Ahmad Khalil'))).toBe('Ahmad Khalil is carrying 12')
  })

  it('says nothing for a depot the endpoint left unattributed', () => {
    expect(carrierLine(depot({ qty: 12 }))).toBeNull()
  })

  it('says nothing for a fixed warehouse', () => {
    expect(carrierLine(location())).toBeNull()
  })
})

/** One line of the levels grid, defaulting to a warehouse nobody has set a
 *  level on — which is how every pair starts out. */
function level(overrides: Partial<ItemLevel> = {}): ItemLevel {
  return {
    warehouse: {
      id: 1,
      code: 'MAIN',
      name: 'Main Warehouse',
      is_depot: false,
      is_main: true,
      max_weight: null,
      max_volume: null,
    },
    qty: 45,
    available_qty: 40,
    reserved_qty: 5,
    min_qty: null,
    max_qty: null,
    below_min: false,
    above_max: false,
    ...overrides,
  }
}

describe('levelLabel', () => {
  it('reads an unset level as no limit and never as zero', () => {
    // The whole point of the nullable column: "nobody chose a floor here" and
    // "carry none of this" are opposite instructions, and a 0 in this cell
    // would report every warehouse in the company as sitting on a minimum.
    expect(levelLabel(null)).toBe('No limit')
    expect(levelLabel(undefined)).toBe('No limit')
  })

  it('reads a level of zero as zero', () => {
    expect(levelLabel(0)).toBe('0')
  })

  it('groups a real level the way quantities are read elsewhere', () => {
    expect(levelLabel(1250)).toBe('1,250')
  })
})

describe('levelBreach', () => {
  it('takes the server’s reading where it sent one', () => {
    // Only the backend sees the stored levels and the ledger row together, so
    // its answer wins even where the numbers in the payload look otherwise.
    expect(levelBreach(level({ qty: 2, min_qty: 10, below_min: true }))).toEqual({
      belowMin: true,
      aboveMax: false,
    })
  })

  it('falls back to the same rule where the flags are missing', () => {
    const missing = { ...level({ qty: 2, min_qty: 10 }), below_min: undefined }
    expect(levelBreach(missing).belowMin).toBe(true)
  })

  it('never reports a breach of a level nobody set', () => {
    const unset = { ...level({ qty: 0 }), below_min: undefined, above_max: undefined }
    expect(levelBreach(unset)).toEqual({ belowMin: false, aboveMax: false })
  })

  it('reads sitting exactly on a level as neither under nor over it', () => {
    const onTheNose = {
      ...level({ qty: 10, min_qty: 10, max_qty: 10 }),
      below_min: undefined,
      above_max: undefined,
    }
    expect(levelBreach(onTheNose)).toEqual({ belowMin: false, aboveMax: false })
  })
})

describe('levelPill', () => {
  it('flags a warehouse under its low level', () => {
    expect(levelPill(level({ qty: 2, min_qty: 10, below_min: true }))).toEqual({
      status: 'error',
      label: 'Below low',
    })
  })

  it('flags a warehouse over its maximum', () => {
    expect(levelPill(level({ qty: 90, max_qty: 50, above_max: true }))).toEqual({
      status: 'warning',
      label: 'Above max',
    })
  })

  it('leads with the floor when a row is somehow under both', () => {
    // Stock cannot be under a minimum and over a maximum at once, but a level
    // edited while a load was in flight can arrive saying so — and running out
    // stops a sale, while too much is only money in the wrong place.
    const both = level({ qty: 5, min_qty: 10, max_qty: 1, below_min: true, above_max: true })
    expect(levelPill(both)?.label).toBe('Below low')
  })

  it('says nothing at all about a pair with no levels set', () => {
    // Unmanaged is not the same as healthy: a green pill here would be a claim
    // nobody made.
    expect(levelPill(level({ qty: 0 }))).toBeNull()
  })

  it('calls a stocked warehouse within its levels', () => {
    expect(levelPill(level({ qty: 20, min_qty: 10, max_qty: 50 }))).toEqual({
      status: 'active',
      label: 'Within levels',
    })
  })

  it('holds a warehouse told to carry none of it to exactly that', () => {
    // Zero is a level: nothing on hand satisfies it, one carton breaches it.
    const empty = { ...level({ qty: 0, max_qty: 0 }), above_max: undefined }
    expect(levelPill(empty)?.label).toBe('Within levels')

    const stocked = { ...level({ qty: 1, max_qty: 0 }), above_max: undefined }
    expect(levelPill(stocked)?.label).toBe('Above max')
  })
})
