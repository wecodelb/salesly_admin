import { describe, expect, it } from 'vitest'
import {
  capacityUsage,
  clampAccepted,
  depotUtilisation,
  formatPercent,
  formatVolume,
  formatWeight,
  inTransitToward,
  isAcceptable,
  isApprovedRequest,
  isEditableDraft,
  isPendingRequest,
  lineTotal,
  loadTotals,
  parseApiDate,
  shortfallOf,
  sourceAvailability,
  stockLineVolume,
  stockLineWeight,
  toDateInput,
  transferPill,
  withLoad,
  withinDateRange,
  type DepotStock,
  type DepotStockLine,
  type DepotTransfer,
  type DepotTransferRow,
  type DepotTransferStatus,
  type DepotTransferType,
} from './types'

function doc(trs_type: DepotTransferType, status: DepotTransferStatus) {
  return { trs_type, status }
}

function stockLine(overrides: Partial<DepotStockLine> = {}): DepotStockLine {
  return {
    item_id: 1,
    item_code: 'IT-1',
    item_name: 'Item',
    uom_id: 1,
    uom_name: 'Piece',
    qty: 100,
    available_qty: 100,
    reserved_qty: 0,
    ...overrides,
  }
}

function row(overrides: Partial<DepotTransferRow> = {}): DepotTransferRow {
  return {
    id: 1,
    lno: 1,
    item_id: 1,
    item_code: 'IT-1',
    item_name: 'Item',
    uom_id: 2,
    uom_name: 'Carton',
    unit: 24,
    trs_qty: 4,
    qty: 96,
    warehouse_id: 1,
    issued_qty: null,
    accepted_qty: null,
    shortfall_qty: null,
    line_memo: null,
    ...overrides,
  }
}

describe('clampAccepted', () => {
  it('leaves a count below the issued quantity alone', () => {
    expect(clampAccepted(3, 4)).toBe(3)
  })

  it('never lets a line be signed for above what was issued', () => {
    // The one thing the backend refuses outright ("Accepted quantity exceeds
    // the quantity issued for item X"), so the box must not reach it.
    expect(clampAccepted(9, 4)).toBe(4)
  })

  it('accepts exactly the issued quantity', () => {
    expect(clampAccepted(4, 4)).toBe(4)
  })

  it('treats a negative or unparseable box as nothing arrived', () => {
    expect(clampAccepted(-2, 4)).toBe(0)
    expect(clampAccepted(Number.NaN, 4)).toBe(0)
  })
})

describe('shortfallOf', () => {
  it('is what did not turn up', () => {
    expect(shortfallOf(10, 7)).toBe(3)
  })

  it('is nil when the whole load was signed for', () => {
    expect(shortfallOf(10, 10)).toBe(0)
  })

  it('never goes negative, whatever it is handed', () => {
    expect(shortfallOf(10, 12)).toBe(0)
  })

  it('agrees with the clamp on an over-count', () => {
    const issued = 6
    expect(shortfallOf(issued, clampAccepted(11, issued))).toBe(0)
  })
})

describe('sourceAvailability', () => {
  it('reads what the source can still promise', () => {
    const available = sourceAvailability([stockLine({ item_id: 7, available_qty: 40 })])
    expect(available.get(7)).toBe(40)
  })

  it('is nothing at all for an item the source has never held', () => {
    expect(sourceAvailability([stockLine()]).get(999)).toBeUndefined()
  })

  it('hands a draft its own reservation back before checking it', () => {
    // The draft already took 96 off `available_qty`; editing it must not be
    // refused by stock this very load is holding.
    const available = sourceAvailability(
      [stockLine({ item_id: 1, available_qty: 4 })],
      [row({ item_id: 1, qty: 96 })],
    )
    expect(available.get(1)).toBe(100)
  })

  it('folds several lines of the same item together', () => {
    const available = sourceAvailability(
      [stockLine({ item_id: 1, available_qty: 0 })],
      [row({ id: 1, item_id: 1, qty: 24 }), row({ id: 2, item_id: 1, qty: 48 })],
    )
    expect(available.get(1)).toBe(72)
  })
})

describe('draft-only gating', () => {
  it('lets a draft load be edited, deleted, issued and cancelled', () => {
    expect(isEditableDraft(doc('TRO', 'DRAFT'))).toBe(true)
  })

  it('closes the door once the goods have left the warehouse', () => {
    expect(isEditableDraft(doc('TRO', 'CONFIRMED'))).toBe(false)
    expect(isEditableDraft(doc('TRO', 'COMPLETED'))).toBe(false)
    // Cancelled means the reservation is already back on the shelf; releasing
    // it twice would conjure stock out of nothing.
    expect(isEditableDraft(doc('TRO', 'CANCELED'))).toBe(false)
  })

  it('never offers those actions on a request or an acceptance', () => {
    expect(isEditableDraft(doc('TRR', 'DRAFT'))).toBe(false)
    expect(isEditableDraft(doc('TRI', 'CONFIRMED'))).toBe(false)
  })
})

describe('acceptance gating', () => {
  it('offers accept only while the load is in transit', () => {
    expect(isAcceptable(doc('TRO', 'CONFIRMED'))).toBe(true)
  })

  it('refuses before it has been issued and after it has been signed for', () => {
    expect(isAcceptable(doc('TRO', 'DRAFT'))).toBe(false)
    expect(isAcceptable(doc('TRO', 'COMPLETED'))).toBe(false)
  })
})

describe('request gating', () => {
  it('offers approve/reject only on a request nobody has answered', () => {
    expect(isPendingRequest(doc('TRR', 'DRAFT'))).toBe(true)
    expect(isPendingRequest(doc('TRR', 'CONFIRMED'))).toBe(false)
    expect(isPendingRequest(doc('TRR', 'CANCELED'))).toBe(false)
  })

  it('only lets a load be raised against an approved request', () => {
    expect(isApprovedRequest(doc('TRR', 'CONFIRMED'))).toBe(true)
    expect(isApprovedRequest(doc('TRR', 'DRAFT'))).toBe(false)
  })
})

describe('transferPill', () => {
  it('reads CONFIRMED as approved on a request and in transit on a load', () => {
    // Same status, two different facts — which is why the pill needs the type.
    expect(transferPill(doc('TRR', 'CONFIRMED')).label).toBe('Approved')
    expect(transferPill(doc('TRO', 'CONFIRMED')).label).toBe('In transit')
  })

  it('reads a cancelled request as rejected', () => {
    expect(transferPill(doc('TRR', 'CANCELED')).label).toBe('Rejected')
  })

  it('is always received on an acceptance', () => {
    expect(transferPill(doc('TRI', 'CONFIRMED')).status).toBe('success')
  })
})

describe('parseApiDate', () => {
  it('reads the API day-first rather than month-first', () => {
    // new Date('03/11/2026') would make this March.
    const date = parseApiDate('03/11/2026 14:30')
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(10)
    expect(date?.getDate()).toBe(3)
    expect(date?.getHours()).toBe(14)
  })

  it('accepts a bare date with no time', () => {
    expect(parseApiDate('01/02/2026')?.getMonth()).toBe(1)
  })

  it('is null on nothing, and on a day that never existed', () => {
    expect(parseApiDate(null)).toBeNull()
    expect(parseApiDate('')).toBeNull()
    expect(parseApiDate('2026-11-03')).toBeNull()
    expect(parseApiDate('31/02/2026')).toBeNull()
  })
})

describe('withinDateRange', () => {
  it('passes everything when neither end is set', () => {
    expect(withinDateRange('03/11/2026 08:00', '', '')).toBe(true)
    expect(withinDateRange(null, '', '')).toBe(true)
  })

  it('compares whole days, so the last day of the range is included', () => {
    expect(withinDateRange('03/11/2026 23:59', '2026-11-01', '2026-11-03')).toBe(true)
    expect(withinDateRange('04/11/2026 00:01', '2026-11-01', '2026-11-03')).toBe(false)
    expect(withinDateRange('31/10/2026 12:00', '2026-11-01', '')).toBe(false)
  })

  it('drops a document with no readable date once a range is set', () => {
    expect(withinDateRange(null, '2026-11-01', '')).toBe(false)
  })
})

describe('toDateInput', () => {
  it('pads month and day so the strings sort', () => {
    expect(toDateInput(new Date(2026, 1, 3))).toBe('2026-02-03')
  })
})

function transfer(overrides: Partial<DepotTransfer> = {}): DepotTransfer {
  return {
    id: 1,
    company_id: 1,
    uuid: null,
    trs_type: 'TRO',
    trs_number: 'TRO-1',
    trs_date: '03/11/2026 08:00',
    status: 'CONFIRMED',
    is_in_transit: true,
    source: { id: 1, code: 'WH', name: 'Main', is_depot: false },
    destination: { id: 9, code: 'DP', name: 'Depot 9', is_depot: true },
    salesman: { id: 3, name: 'Sami' },
    created_by: null,
    created_by_name: null,
    confirmed_at: null,
    confirmed_by: null,
    confirmed_by_name: null,
    total_qty: 100,
    total_cost: 0,
    total_weight: 200,
    total_volume: 0.5,
    discrepancy_qty: null,
    src_type: null,
    src_id: null,
    memo: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

function depotStock(overrides: Partial<DepotStock> = {}): DepotStock {
  return {
    warehouse: { id: 9, code: 'DP', name: 'Depot 9', is_depot: true },
    salesman: { id: 3, name: 'Sami' },
    total_qty: 0,
    total_available_qty: 0,
    total_reserved_qty: 0,
    items: [],
    ...overrides,
  }
}

describe('capacityUsage', () => {
  it('reads what is on board as a percentage of the cap', () => {
    const usage = capacityUsage(600, 0, 1200)
    expect(usage.usedPct).toBe(50)
    expect(usage.totalPct).toBe(50)
    expect(usage.over).toBe(false)
  })

  it('counts what is already travelling toward the depot against the same cap', () => {
    // 900 on board, 140 on the road: the room for a third load is what is left
    // of 1,200 after both, not after the first.
    const usage = capacityUsage(900, 140, 1200)
    expect(usage.total).toBe(1040)
    expect(Math.round(usage.totalPct)).toBe(87)
    expect(usage.over).toBe(false)
  })

  it('draws the in-transit segment on the room the contents left', () => {
    const usage = capacityUsage(900, 140, 1200)
    expect(usage.usedWidth).toBe(75)
    expect(usage.incomingWidth).toBeCloseTo(11.667, 3)
    expect(usage.usedWidth + usage.incomingWidth).toBeLessThanOrEqual(100)
  })

  it('never lets the two segments overrun the track, however far over it is', () => {
    const usage = capacityUsage(1400, 600, 1000)
    expect(usage.usedWidth).toBe(100)
    expect(usage.incomingWidth).toBe(0)
    // The bar is full, but the figure beside it is not clamped — 200% is the
    // whole point of showing it.
    expect(usage.totalPct).toBe(200)
    expect(usage.over).toBe(true)
  })

  it('gives an overload with room on board its own segment', () => {
    const usage = capacityUsage(800, 400, 1000)
    expect(usage.usedWidth).toBe(80)
    expect(usage.incomingWidth).toBe(20)
    expect(usage.over).toBe(true)
  })

  it('is not an overload when the cap is filled exactly', () => {
    const usage = capacityUsage(1000, 0, 1000)
    expect(usage.totalPct).toBe(100)
    expect(usage.over).toBe(false)
  })

  it('treats a missing cap as no limit rather than as a limit of nothing', () => {
    // Every fixed warehouse is here, and a depot nobody has measured: the
    // figures still read, nothing is ever over, and no bar is drawn.
    for (const max of [null, undefined, 0]) {
      const usage = capacityUsage(900, 100, max)
      expect(usage.uncapped).toBe(true)
      expect(usage.max).toBeNull()
      expect(usage.total).toBe(1000)
      expect(usage.totalPct).toBe(0)
      expect(usage.usedWidth).toBe(0)
      expect(usage.incomingWidth).toBe(0)
      expect(usage.over).toBe(false)
    }
  })

  it('reads nonsense as nothing rather than drawing a bar backwards', () => {
    const usage = capacityUsage(-50, Number.NaN, 1000)
    expect(usage.used).toBe(0)
    expect(usage.incoming).toBe(0)
    expect(usage.totalPct).toBe(0)
  })
})

describe('withLoad', () => {
  it('puts the load being keyed where the goods on the road already are', () => {
    const after = withLoad(capacityUsage(900, 100, 1200), 40)
    expect(after.used).toBe(900)
    expect(after.incoming).toBe(140)
    expect(Math.round(after.totalPct)).toBe(87)
  })

  it('tips a depot over without touching what is on board', () => {
    const after = withLoad(capacityUsage(1000, 0, 1200), 400)
    expect(after.over).toBe(true)
    expect(after.usedWidth).toBeCloseTo(83.333, 3)
  })

  it('leaves an uncapped depot uncapped, however much is added', () => {
    const after = withLoad(capacityUsage(100, 0, null), 5000)
    expect(after.uncapped).toBe(true)
    expect(after.total).toBe(5100)
    expect(after.over).toBe(false)
  })
})

describe('lineTotal', () => {
  it('multiplies the per-unit figure by what is on the line', () => {
    expect(lineTotal(96, 0.75)).toBe(72)
  })

  it('takes a ready-made total over doing the multiplication again', () => {
    expect(lineTotal(96, 0.75, 60)).toBe(60)
  })

  it('is null when nobody has weighed the item — which is not the same as nil', () => {
    expect(lineTotal(96)).toBeNull()
    expect(lineTotal(96, null, null)).toBeNull()
    expect(lineTotal(96, 0)).toBe(0)
  })

  it('reads a stock line either way the endpoint sends it', () => {
    expect(stockLineWeight(stockLine({ qty: 10, weight: 2 }))).toBe(20)
    expect(stockLineWeight(stockLine({ qty: 10, weight: 2, total_weight: 18 }))).toBe(18)
    expect(stockLineVolume(stockLine({ qty: 10, volume: 0.02 }))).toBeCloseTo(0.2, 6)
    expect(stockLineWeight(stockLine())).toBeNull()
  })
})

describe('loadTotals', () => {
  it('totals a load the way the server does — base units times the item figure', () => {
    const totals = loadTotals([
      { qty: 96, weight: 0.75, volume: 0.001 },
      { qty: 20, weight: 12, volume: 0.05 },
    ])
    expect(totals.weight).toBe(312)
    expect(totals.volume).toBeCloseTo(1.096, 6)
  })

  it('skips a line whose item has no figure rather than counting it as nil', () => {
    // The figure is understated, not wrong: an unweighed item contributes an
    // unknown amount, and inventing a zero would read as "this weighs nothing".
    expect(loadTotals([{ qty: 5 }, { qty: 10, weight: 2 }]).weight).toBe(20)
  })

  it('is nothing at all for an empty form', () => {
    expect(loadTotals([])).toEqual({ weight: 0, volume: 0 })
  })
})

describe('inTransitToward', () => {
  it('counts only what has left the warehouse and been signed for by nobody', () => {
    const feed = [
      transfer({ id: 1 }),
      transfer({ id: 2, is_in_transit: false, total_weight: 999 }),
      transfer({ id: 3, total_weight: 50, total_volume: 0.25 }),
    ]
    const travelling = inTransitToward(feed, 9)
    expect(travelling.weight).toBe(250)
    expect(travelling.volume).toBe(0.75)
    expect(travelling.count).toBe(2)
  })

  it('ignores a load travelling somewhere else', () => {
    const feed = [
      transfer({ destination: { id: 4, code: 'DP4', name: 'Depot 4', is_depot: true } }),
    ]
    expect(inTransitToward(feed, 9).count).toBe(0)
  })

  it('is nothing when no warehouse is named', () => {
    expect(inTransitToward([transfer()], null)).toEqual({ weight: 0, volume: 0, count: 0 })
  })
})

describe('depotUtilisation', () => {
  it('takes the endpoint at its word wherever it has a figure', () => {
    const usage = depotUtilisation(
      depotStock({
        capacity: {
          max_weight: 1200,
          max_volume: 3,
          used_weight: 900,
          used_volume: 2,
          in_transit_weight: 140,
          in_transit_volume: 0.4,
        },
        items: [stockLine({ qty: 10, weight: 1 })],
      }),
    )
    expect(usage.weight.used).toBe(900)
    expect(usage.weight.incoming).toBe(140)
    expect(usage.weight.max).toBe(1200)
    expect(usage.volume.total).toBe(2.4)
  })

  it('totals the lines itself when the endpoint says nothing about contents', () => {
    const usage = depotUtilisation(
      depotStock({
        capacity: {
          max_weight: 500,
          max_volume: null,
          used_weight: 0,
          used_volume: 0,
          in_transit_weight: 0,
          in_transit_volume: 0,
        },
        items: [stockLine({ item_id: 1, qty: 10, weight: 2 }), stockLine({ item_id: 2, qty: 4, weight: 5 })],
      }),
    )
    expect(usage.weight.used).toBe(40)
    expect(usage.weight.max).toBe(500)
    // Volume was never declared on either the item or the warehouse, so there
    // is nothing to be over.
    expect(usage.volume.uncapped).toBe(true)
  })

  it('reads the in-transit segment off the feed when the endpoint omits it', () => {
    const usage = depotUtilisation(
      depotStock({
        capacity: {
          max_weight: 1000,
          max_volume: 2,
          used_weight: 400,
          used_volume: 1,
          in_transit_weight: 0,
          in_transit_volume: 0,
        },
      }),
      [transfer({ total_weight: 200, total_volume: 0.5 })],
    )
    expect(usage.weight.incoming).toBe(200)
    expect(usage.weight.total).toBe(600)
    expect(usage.volume.incoming).toBe(0.5)
  })

  it('is an uncapped, empty pair for a depot nothing is known about', () => {
    const usage = depotUtilisation(undefined, [transfer()])
    expect(usage.weight.uncapped).toBe(true)
    expect(usage.weight.total).toBe(0)
    expect(usage.volume.total).toBe(0)
  })
})

describe('capacity formatting', () => {
  it('groups a weight and keeps a tenth of a kilo', () => {
    expect(formatWeight(1040)).toBe('1,040')
    expect(formatWeight(1040.25)).toBe('1,040.3')
  })

  it('keeps three places on a volume, since a case is thousandths of a cubic metre', () => {
    expect(formatVolume(0.024)).toBe('0.024')
    expect(formatVolume(2.4)).toBe('2.4')
  })

  it('rounds a percentage to the whole number a loading bay reads in', () => {
    expect(formatPercent(86.6)).toBe('87%')
    expect(formatPercent(118.2)).toBe('118%')
  })
})
