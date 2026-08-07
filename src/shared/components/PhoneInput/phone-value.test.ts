import { describe, expect, it } from 'vitest'
import { joinPhone, phoneMatchesQuery, sanitizeNational, splitPhone } from './phone-value'

describe('splitPhone', () => {
  it('reads back a stored international number', () => {
    expect(splitPhone('+961 3 456 789')).toEqual({ iso: 'LB', national: '3 456 789' })
  })

  it('prefers the longest matching dial code', () => {
    // +96 is not a country, but +961 and +962 both start with it.
    expect(splitPhone('+962 7 900 000').iso).toBe('JO')
    expect(splitPhone('+961 70 123 456').iso).toBe('LB')
  })

  it('treats a number with no dial code as local to Lebanon', () => {
    // How every phone recorded before the picker existed looks.
    expect(splitPhone('03 456 789')).toEqual({ iso: 'LB', national: '03 456 789' })
  })

  it('falls back to the default country for an unknown code', () => {
    expect(splitPhone('+999 123').iso).toBe('LB')
  })

  it('handles an empty field', () => {
    expect(splitPhone('')).toEqual({ iso: 'LB', national: '' })
    expect(splitPhone(null)).toEqual({ iso: 'LB', national: '' })
  })
})

describe('joinPhone', () => {
  it('puts the code and the number back together', () => {
    expect(joinPhone('+961', '3 456 789')).toBe('+961 3 456 789')
  })

  it('leaves an empty number empty rather than storing a bare dial code', () => {
    expect(joinPhone('+961', '')).toBe('')
    expect(joinPhone('+961', '   ')).toBe('')
  })
})

describe('sanitizeNational', () => {
  it('drops the local trunk zero, which is not dialled internationally', () => {
    expect(sanitizeNational('03 456 789')).toBe('3 456 789')
  })

  it('keeps digits and single spaces, drops everything else', () => {
    expect(sanitizeNational('(3) 456-789')).toBe('3 456789')
    expect(sanitizeNational('3   456')).toBe('3 456')
  })

  it('round-trips through join and split unchanged', () => {
    const stored = joinPhone('+971', sanitizeNational('050 123 4567'))
    expect(stored).toBe('+971 50 123 4567')
    expect(splitPhone(stored)).toEqual({ iso: 'AE', national: '50 123 4567' })
  })
})

describe('phoneMatchesQuery', () => {
  const STORED = '+961 3 456 789'

  it('matches however the searcher spaces or punctuates it', () => {
    expect(phoneMatchesQuery(STORED, '3456789')).toBe(true)
    expect(phoneMatchesQuery(STORED, '3 456 789')).toBe(true)
    expect(phoneMatchesQuery(STORED, '3-456-789')).toBe(true)
    expect(phoneMatchesQuery(STORED, '+961 3456789')).toBe(true)
  })

  it('matches the local form of a number stored internationally', () => {
    expect(phoneMatchesQuery(STORED, '03 456 789')).toBe(true)
    expect(phoneMatchesQuery(STORED, '03456789')).toBe(true)
  })

  it('matches a partial number', () => {
    expect(phoneMatchesQuery(STORED, '4567')).toBe(true)
  })

  it('ignores queries too short to mean anything', () => {
    expect(phoneMatchesQuery(STORED, '3')).toBe(false)
    expect(phoneMatchesQuery(STORED, 'Al Watan')).toBe(false)
  })

  it('does not match a different number, or an empty field', () => {
    expect(phoneMatchesQuery(STORED, '70 111 222')).toBe(false)
    expect(phoneMatchesQuery('', '3456789')).toBe(false)
    expect(phoneMatchesQuery(null, '3456789')).toBe(false)
  })

  it('keeps rows recorded before the picker findable', () => {
    // Stored locally, searched internationally, and the other way round.
    expect(phoneMatchesQuery('03 456 789', '+961 3 456 789')).toBe(true)
    expect(phoneMatchesQuery('03 456 789', '456 789')).toBe(true)
  })
})
