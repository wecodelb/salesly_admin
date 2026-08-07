import { COUNTRY_CODES, DEFAULT_COUNTRY_ISO } from './country-codes'

// A phone stays one string end to end — "+961 3 456 789" — because that is what
// the backend column holds, what the customers search matches on, and what the
// mobile app renders. The picker is a way of typing that string, not a second
// field: these helpers are the only place the string is taken apart or put back
// together.

export interface SplitPhone {
  iso: string
  /** The part after the dialling code, exactly as stored. */
  national: string
}

/** Longest dial code first, so +962 wins over +9 and +961 over +96. */
const BY_DIAL_LENGTH = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length)

/**
 * Splits a stored value into the country it belongs to and the rest.
 *
 * Anything without a leading "+" is treated as a local number in the default
 * country — which is how every phone recorded before this control existed
 * ("03 456 789") reads, and it keeps those rows editable without a migration.
 */
export function splitPhone(value: string | null | undefined, fallbackIso = DEFAULT_COUNTRY_ISO): SplitPhone {
  const trimmed = (value ?? '').trim()
  if (!trimmed.startsWith('+')) return { iso: fallbackIso, national: trimmed }

  const match = BY_DIAL_LENGTH.find((c) => trimmed.startsWith(c.dial))
  if (!match) return { iso: fallbackIso, national: trimmed }

  return { iso: match.iso, national: trimmed.slice(match.dial.length).trim() }
}

/**
 * Puts the two halves back together. An empty number yields an empty string
 * rather than a bare dialling code, so an untouched optional phone field still
 * saves as "no phone" instead of "+961".
 */
export function joinPhone(dial: string, national: string): string {
  const digits = national.trim()
  return digits === '' ? '' : `${dial} ${digits}`
}

/**
 * What a keystroke in the number box is allowed to leave behind: digits and
 * single spaces.
 *
 * The leading zero goes because it is the local trunk prefix — "03 456 789"
 * dialled from abroad is "+961 3 456 789", and keeping it would store a number
 * that cannot be called. Stripping as it is typed (rather than on blur) means
 * the box always shows exactly what will be saved.
 */
export function sanitizeNational(input: string): string {
  return input
    .replace(/[^\d ]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[0\s]+/, '')
}

/** Just the digits — "+961 3 456 789" and "03-456-789" both reduce to a number. */
export function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/**
 * Whether a stored number answers to what someone typed into a search box.
 *
 * Numbers are stored grouped ("+961 3 456 789") because that is how they are
 * read, which means a plain substring search fails on every formatting choice
 * the searcher didn't make. Comparing digits only fixes that, and dropping a
 * leading zero from the query covers the other half: people search for the
 * local "03 456 789" of a number stored internationally as "+961 3 456 789".
 */
export function phoneMatchesQuery(stored: string | null | undefined, query: string): boolean {
  // Leading zeros go from both sides: the same number is written "03 456 789"
  // locally and "+961 3 456 789" internationally, and either may be the stored
  // one — rows predate the picker, queries come from whoever is typing.
  const haystack = phoneDigits(stored).replace(/^0+/, '')
  const needle = phoneDigits(query).replace(/^0+/, '')
  // Two or three digits match almost any number; let the other fields answer.
  if (haystack.length < 4 || needle.length < 4) return false

  // Either direction: the query may be the fuller of the two (searching with a
  // country code for a number stored without one) or the shorter.
  return haystack.includes(needle) || needle.includes(haystack)
}
