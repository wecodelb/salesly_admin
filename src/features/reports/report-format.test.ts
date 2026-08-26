import { describe, expect, it } from 'vitest'

import { day, money, parseApiDate, qty, rangeLabel, text, within } from './report-format'

/**
 * How figures are written on a report.
 *
 * These matter more than screen formatters do. A report is read on paper,
 * months later, by somebody who was not there when it was run — there is
 * nobody to ask what a blank cell meant, so the distinction between "nothing"
 * and "zero" has to survive onto the page.
 */
describe('money', () => {
  it('always carries its currency and two decimals', () => {
    expect(money(1234.5)).toBe('$1,234.50')
    expect(money(0)).toBe('$0.00')
  })

  it('writes nothing as a dash, never as zero', () => {
    // A customer with no credit limit and one with a limit of zero are
    // different facts, and a printed page cannot be interrogated.
    expect(money(null)).toBe('—')
    expect(money(undefined)).toBe('—')
    expect(money(NaN)).toBe('—')
  })

  it('keeps a negative visible rather than swallowing the sign', () => {
    expect(money(-40)).toBe('$-40.00')
  })
})

describe('qty', () => {
  it('groups thousands and drops meaningless decimals', () => {
    expect(qty(1200)).toBe('1,200')
    expect(qty(3.5)).toBe('3.5')
  })

  it('distinguishes nothing from zero', () => {
    expect(qty(0)).toBe('0')
    expect(qty(null)).toBe('—')
  })
})

describe('day', () => {
  it('writes a month name rather than a number', () => {
    // 03/04 is a different day either side of the Atlantic, and a report gets
    // read by people who did not choose the locale it was run in.
    expect(day('2026-03-04')).toBe('04 Mar 2026')
  })

  it('reads the dd/MM/yyyy the sales endpoints use', () => {
    expect(day('04/03/2026')).toBe('04 Mar 2026')
  })

  it('gives a dash for a date it cannot read, rather than Invalid Date', () => {
    expect(day('not a date')).toBe('—')
    expect(day(null)).toBe('—')
    expect(day('')).toBe('—')
  })
})

describe('parseApiDate', () => {
  it('tells the two API date shapes apart', () => {
    const iso = parseApiDate('2026-03-04')
    const slash = parseApiDate('04/03/2026')

    expect(iso?.getMonth()).toBe(2)
    expect(iso?.getDate()).toBe(4)
    // The same day, written the other way. Read as 4 March, not 3 April.
    expect(slash?.getMonth()).toBe(2)
    expect(slash?.getDate()).toBe(4)
  })

  it('carries the time when one is present', () => {
    expect(parseApiDate('04/03/2026 14:30')?.getHours()).toBe(14)
  })

  it('returns null rather than an invalid date', () => {
    expect(parseApiDate('rubbish')).toBeNull()
    expect(parseApiDate('')).toBeNull()
    expect(parseApiDate(null)).toBeNull()
  })
})

describe('within', () => {
  it('includes both ends of the range', () => {
    expect(within('2026-03-01', '2026-03-01', '2026-03-31')).toBe(true)
    expect(within('2026-03-31', '2026-03-01', '2026-03-31')).toBe(true)
  })

  it('covers the whole of the closing day, not midnight on it', () => {
    // An invoice written at 17:00 on the last day of the range belongs in it.
    expect(within('31/03/2026 17:00', '2026-03-01', '2026-03-31')).toBe(true)
  })

  it('excludes what falls outside', () => {
    expect(within('2026-02-28', '2026-03-01', '2026-03-31')).toBe(false)
    expect(within('2026-04-01', '2026-03-01', '2026-03-31')).toBe(false)
  })

  it('treats either end as optional', () => {
    expect(within('2026-03-15', '2026-03-01', '')).toBe(true)
    expect(within('2026-03-15', '', '2026-03-31')).toBe(true)
    expect(within('2026-03-15', '', '')).toBe(true)
  })

  it('keeps a row with no date rather than dropping it silently', () => {
    // Excluding it would make the report total differ from the screen for a
    // reason nobody reading either could see.
    expect(within(null, '2026-03-01', '2026-03-31')).toBe(true)
  })
})

describe('rangeLabel', () => {
  it('says what was actually asked for', () => {
    expect(rangeLabel('', '')).toBe('All dates')
    expect(rangeLabel('2026-03-01', '2026-03-31')).toBe('01 Mar 2026 – 31 Mar 2026')
    expect(rangeLabel('2026-03-01', '')).toBe('From 01 Mar 2026')
    expect(rangeLabel('', '2026-03-31')).toBe('Up to 31 Mar 2026')
  })
})

describe('text', () => {
  it('turns a blank into a dash so a cell is never mysteriously empty', () => {
    expect(text('  ')).toBe('—')
    expect(text(null)).toBe('—')
    expect(text('Corner Shop')).toBe('Corner Shop')
  })
})
