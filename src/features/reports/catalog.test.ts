import { describe, expect, it } from 'vitest'

import { findView, groupingsFor, isoDay, presetRange, VIEWS, DEFAULT_VIEW } from './catalog'

/**
 * The catalogue and the window it reads.
 *
 * A preset is a promise about dates — "last month" that includes the 1st of
 * this month is a report that is wrong in the one way nobody checks.
 */

// A Wednesday, mid-month, mid-quarter.
const now = new Date(2026, 8, 16, 15, 30)

describe('the period presets', () => {
  it('reads today and yesterday as single days', () => {
    expect(presetRange('today', now)).toEqual({ from: '2026-09-16', to: '2026-09-16' })
    expect(presetRange('yesterday', now)).toEqual({ from: '2026-09-15', to: '2026-09-15' })
  })

  it('starts the week on Monday', () => {
    expect(presetRange('this_week', now)).toEqual({ from: '2026-09-14', to: '2026-09-16' })
    expect(presetRange('last_week', now)).toEqual({ from: '2026-09-07', to: '2026-09-13' })
  })

  it('treats a Sunday as the end of its week, not the start of the next', () => {
    const sunday = new Date(2026, 8, 20)
    expect(presetRange('this_week', sunday).from).toBe('2026-09-14')
  })

  it('closes last month on its own last day', () => {
    expect(presetRange('last_month', now)).toEqual({ from: '2026-08-01', to: '2026-08-31' })
    // Across a year boundary, and into a short month.
    expect(presetRange('last_month', new Date(2027, 0, 10))).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(presetRange('last_month', new Date(2026, 2, 5))).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('runs this month, quarter and year up to today', () => {
    expect(presetRange('this_month', now)).toEqual({ from: '2026-09-01', to: '2026-09-16' })
    expect(presetRange('this_quarter', now)).toEqual({ from: '2026-07-01', to: '2026-09-16' })
    expect(presetRange('this_year', now)).toEqual({ from: '2026-01-01', to: '2026-09-16' })
  })

  it('counts the last 30 days including today', () => {
    expect(presetRange('last_30', now)).toEqual({ from: '2026-08-18', to: '2026-09-16' })
  })

  it('writes dates in local time, not shifted by the time zone', () => {
    expect(isoDay(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})

describe('the catalogue', () => {
  it('covers every report on the list the office asked for', () => {
    const names = VIEWS.map((v) => v.name)
    for (const wanted of [
      'Sales by item', 'Sales by category', 'Sales by brand', 'Sales by customer', 'Sales by salesman', 'Sales by date',
      'Customer by item', 'Salesman by item', 'Salesman by category', 'Salesman by brand', 'Salesman by date', 'Item by date',
      'Inventory', 'Inventory by warehouse', 'Inventory by salesman',
      'Loads by item', 'Loads by salesman', 'Loads by date',
      'Unloads by item', 'Unloads by salesman', 'Unloads by date', 'Unload ratio',
    ]) {
      expect(names).toContain(wanted)
    }
  })

  it('has one id per view', () => {
    expect(new Set(VIEWS.map((v) => v.id)).size).toBe(VIEWS.length)
  })

  it('only opens a view with a grouping its engine can take', () => {
    for (const view of VIEWS) {
      const allowed = groupingsFor(view.engine)
      for (const level of view.levels) expect(allowed).toContain(level)
      expect(view.levels.length).toBeLessThanOrEqual(view.engine === 'sales' ? 3 : 1)
    }
  })

  it('never offers a date range on stock as it stands now', () => {
    for (const view of VIEWS.filter((v) => v.engine === 'inventory')) expect(view.dated).toBe(false)
  })

  it('falls back to the first view for an address it does not know', () => {
    expect(findView('nonsense')).toBe(DEFAULT_VIEW)
    expect(findView(null)).toBe(DEFAULT_VIEW)
    expect(findView('unload-ratio').ratio).toBe(true)
  })
})
