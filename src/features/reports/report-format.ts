/**
 * How figures are written on a report.
 *
 * Separate from the screens' own formatters on purpose: a report is read on
 * paper, often months later, by somebody who was not there when it was run.
 * Money always carries its sign and its currency, dates are unambiguous rather
 * than short, and a missing value prints as an em dash instead of a zero — a
 * blank and a nil are different facts and a printed page cannot be interrogated.
 */

const MONEY = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const PLAIN = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})

/** `$1,234.50`, and `—` for nothing at all. */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'

  return `$${MONEY.format(value)}`
}

/** A count or a quantity. */
export function qty(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'

  return PLAIN.format(value)
}

/**
 * `12 Mar 2026`. Long-form month because 03/04 is a different day depending on
 * which side of the Atlantic the reader learned to write dates.
 */
export function day(value: string | Date | null | undefined): string {
  if (!value) return '—'

  const date = value instanceof Date ? value : parseApiDate(value)
  if (!date || Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function text(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()

  return trimmed === '' ? '—' : trimmed
}

/**
 * The API writes dates two ways depending on the endpoint — ISO, and the
 * `dd/MM/yyyy` the sales endpoints use. Both are tried rather than guessed at,
 * because a report sorted on a misread date is worse than one with a gap.
 */
export function parseApiDate(raw: string | null | undefined): Date | null {
  const value = (raw ?? '').trim()
  if (value === '') return null

  const iso = new Date(value)
  if (!Number.isNaN(iso.getTime()) && /^\d{4}-/.test(value)) return iso

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(value)
  if (match) {
    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4] ?? 0),
      Number(match[5] ?? 0),
    )
  }

  return Number.isNaN(iso.getTime()) ? null : iso
}

/** Whether a date falls inside the range, with either end optional. */
export function within(
  raw: string | null | undefined,
  from: string,
  to: string,
): boolean {
  const date = parseApiDate(raw)
  // A row with no date is kept rather than dropped: excluding it silently would
  // make totals differ from the screen for a reason nobody can see.
  if (!date) return true

  if (from) {
    const start = new Date(`${from}T00:00:00`)
    if (date < start) return false
  }
  if (to) {
    const end = new Date(`${to}T23:59:59`)
    if (date > end) return false
  }

  return true
}

/** `12 Mar 2026 – 18 Mar 2026`, or an open-ended phrasing. */
export function rangeLabel(from: string, to: string): string {
  if (!from && !to) return 'All dates'
  if (from && !to) return `From ${day(from)}`
  if (!from && to) return `Up to ${day(to)}`

  return `${day(from)} – ${day(to)}`
}

/**
 * The line printed under a report's title: how much of the whole it is, then
 * the filters that narrowed it.
 *
 * The "of 310" half is the important one. A filtered page with no such note
 * reads as the complete book, and somebody totals it and acts on the total.
 */
export function scopeLine(
  shown: number,
  total: number,
  noun: string,
  filters: Array<string | false | null | undefined> = [],
): string {
  const scope =
    shown === total ? `${qty(total)} ${noun}` : `${qty(shown)} of ${qty(total)} ${noun}`

  return [scope, ...filters.filter(Boolean)].join(' · ')
}

/** Adds the numbers a report column totals, ignoring the holes. */
export function sum<T>(rows: T[], pick: (row: T) => number | null | undefined): number {
  return rows.reduce((acc, row) => acc + (pick(row) || 0), 0)
}

/**
 * A count with its noun, singular when it is one.
 *
 * "1 products" is the kind of thing nobody notices on screen and everybody
 * notices on a printed page, because paper is read slowly.
 */
export function counted(n: number, singular: string, plural = `${singular}s`): string {
  return `${qty(n)} ${n === 1 ? singular : plural}`
}
