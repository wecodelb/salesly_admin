import { describe, expect, it } from 'vitest'
import { ean13Bars } from './ean13'

describe('ean13Bars', () => {
  it('draws 95 modules with the guards where a scanner expects them', () => {
    const bars = ean13Bars('4006381333931')
    expect(bars).toHaveLength(95)
    expect(bars.slice(0, 3)).toBe('101')
    expect(bars.slice(45, 50)).toBe('01010')
    expect(bars.slice(-3)).toBe('101')
  })

  it('uses the left-hand pattern the first digit calls for', () => {
    // First digit 4 is LGLLGG: the second digit, 0, is drawn from set L.
    expect(ean13Bars('4006381333931').slice(3, 10)).toBe('0001101')
    // And the third, also 0, from set G.
    expect(ean13Bars('4006381333931').slice(10, 17)).toBe('0100111')
  })

  it('refuses anything that is not thirteen digits', () => {
    expect(() => ean13Bars('123')).toThrow()
  })
})
