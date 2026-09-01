import { describe, expect, it } from 'vitest'

import {
  clampAccepted,
  isPendingUnload,
  isUnload,
  shortfallOf,
  unloadPill,
  type DepotTransfer,
} from './types'
import { unloadsExportDoc } from './unloads-export'

/**
 * The rules the Unloads screen turns on.
 *
 * An unload is not a document type — it is an LI whose *source* is a depot,
 * the same pair of documents as a load pointing the other way. Everything
 * here is about reading that direction correctly, because getting it backwards
 * would put the morning's loading in the queue of things to take back.
 */

const depot = { id: 7, code: 'DP1', name: 'Ahmad — Van 3', is_depot: true }
const warehouse = { id: 1, code: 'WH1', name: 'Main Warehouse', is_depot: false }

const doc = (over: Partial<DepotTransfer> = {}): DepotTransfer =>
  ({
    id: 1,
    trs_number: 'LI-14',
    trs_type: 'LI',
    status: 'DRAFT',
    trs_date: '12/03/2026 18:40',
    total_qty: 25,
    source: depot,
    destination: warehouse,
    salesman: { id: 3, name: 'Ahmad Khalil' },
    rows: [],
    ...over,
  }) as DepotTransfer

describe('telling an unload from a load', () => {
  it('reads the direction off the source, not off a flag', () => {
    expect(isUnload(doc())).toBe(true)
  })

  it('does not mistake a load into a depot for one coming out', () => {
    // The same document type, the same two warehouses, the other way round —
    // and the whole reason this cannot be asked of trs_type alone.
    expect(isUnload(doc({ source: warehouse, destination: depot }))).toBe(false)
  })

  it('does not claim a load request is an unload', () => {
    expect(isUnload(doc({ trs_type: 'LR' }))).toBe(false)
  })

  it('does not claim an acceptance is one', () => {
    expect(isUnload(doc({ trs_type: 'TRI' }))).toBe(false)
  })

  it('survives a document with no source at all', () => {
    expect(isUnload(doc({ source: undefined }))).toBe(false)
  })
})

describe('which unloads are still waiting', () => {
  it('counts a draft, because a draft is one nobody has answered', () => {
    expect(isPendingUnload(doc({ status: 'DRAFT' }))).toBe(true)
  })

  it('does not count one already taken back', () => {
    expect(isPendingUnload(doc({ status: 'COMPLETED' }))).toBe(false)
  })

  it('does not count one that was refused', () => {
    expect(isPendingUnload(doc({ status: 'CANCELED' }))).toBe(false)
  })

  it('does not count a load that is merely a draft', () => {
    // A drafted load out of the warehouse is waiting on somebody too, but not
    // on this screen — and it must never reach the Take back button, which
    // would sign goods into a salesman's depot on his behalf.
    expect(isPendingUnload(doc({ source: warehouse, destination: depot }))).toBe(false)
  })
})

describe('how an unload reads', () => {
  it('says what it is waiting for rather than borrowing the load vocabulary', () => {
    // "Load issued" on stock coming back off a van describes the opposite of
    // what happened, which is why this has its own words.
    expect(unloadPill({ status: 'DRAFT' })).toEqual({
      status: 'pending',
      label: 'Awaiting approval',
    })
    expect(unloadPill({ status: 'COMPLETED' })).toEqual({
      status: 'success',
      label: 'Taken back',
    })
    expect(unloadPill({ status: 'CANCELED' })).toEqual({ status: 'error', label: 'Refused' })
  })

  it('does not read a half-finished one as still unanswered', () => {
    // Approving issues and accepts in one call, so CONFIRMED should not
    // survive a round trip — but if one does, it must not look like something
    // somebody can answer a second time.
    expect(unloadPill({ status: 'CONFIRMED' }).label).not.toBe('Awaiting approval')
  })
})

describe('the quantity the warehouse is allowed to key', () => {
  it('never lets a line be signed for above what was declared', () => {
    // Upward is how a van quietly loses stock it never had: debited for a
    // figure nobody put on the sheet. The server refuses it; the box refusing
    // it first is what stops the refusal arriving after the whole count.
    expect(clampAccepted(40, 25)).toBe(25)
  })

  it('allows short, which is the ordinary case', () => {
    expect(clampAccepted(18, 25)).toBe(18)
  })

  it('reads an emptied box as nothing rather than as everything', () => {
    expect(clampAccepted(Number(''), 25)).toBe(0)
    expect(clampAccepted(Number('abc'), 25)).toBe(0)
    expect(clampAccepted(-5, 25)).toBe(0)
  })

  it('reports what stays on the van', () => {
    expect(shortfallOf(25, 18)).toBe(7)
    expect(shortfallOf(25, 25)).toBe(0)
    // Never negative, however the figures arrive.
    expect(shortfallOf(25, 40)).toBe(0)
  })
})

describe('the printed page', () => {
  const rows = [
    doc({ id: 1, trs_number: 'LI-14', status: 'DRAFT', total_qty: 25 }),
    doc({ id: 2, trs_number: 'LI-15', status: 'COMPLETED', total_qty: 40 }),
    doc({ id: 3, trs_number: 'LI-16', status: 'CANCELED', total_qty: 10 }),
  ]

  it('totals only what is actually frozen under "held on vans"', () => {
    // The figure the page is printed to answer. A taken-back unload is on the
    // shelf and a refused one was never held, so folding either in would
    // describe stock nobody is waiting on.
    const printed = unloadsExportDoc(rows, rows.length, '', false)
    const held = printed.summary?.find((s) => s.label === 'Held on vans')

    expect(held?.value).toBe('25')
  })

  it('totals every row under units, answered or not', () => {
    const printed = unloadsExportDoc(rows, rows.length, '', false)

    expect(printed.summary?.find((s) => s.label === 'Units')?.value).toBe('75')
    expect(printed.summary?.find((s) => s.label === 'Unloads')?.value).toBe('3')
  })

  it('says what it was narrowed by, so a partial page cannot read as the whole', () => {
    const printed = unloadsExportDoc([rows[0]], rows.length, 'ahmad', 'Status: waiting')

    // listDoc folds the filters into the scope line, which is the one place a
    // reader looks to see whether the page is everything or a slice.
    expect(printed.subtitle).toMatch(/ahmad/i)
    expect(printed.subtitle).toMatch(/waiting/i)
    expect(printed.subtitle).toMatch(/1 of 3/)
  })

  it('prints the depot the stock is leaving', () => {
    const printed = unloadsExportDoc(rows, rows.length, '', false)
    const from = printed.columns.find((c) => c.header === 'From')

    expect(from?.value(rows[0])).toBe('Ahmad — Van 3')
  })
})
