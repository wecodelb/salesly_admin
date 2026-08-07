import { describe, expect, it } from 'vitest'
import { promoAmount, promoScope, type Promotion } from './types'

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 1,
    name: 'Promo',
    type: 'percent',
    value: 10,
    item_id: null,
    item: null,
    category_id: null,
    category: null,
    starts_at: null,
    ends_at: null,
    is_active: true,
    ...overrides,
  }
}

describe('promoAmount', () => {
  it('renders a percentage discount', () => {
    expect(promoAmount(promo({ type: 'percent', value: 15 }))).toBe('-15%')
  })
  it('renders a flat-amount discount', () => {
    expect(promoAmount(promo({ type: 'amount', value: 0.5 }))).toBe('-$0.5')
  })
})

describe('promoScope', () => {
  it('names the item when the promo targets one', () => {
    expect(promoScope(promo({ item_id: 5, item: 'Mouse M15' }))).toBe('Mouse M15')
  })
  it('labels a category promo', () => {
    expect(promoScope(promo({ category_id: 2, category: 'Computers' }))).toBe('Category · Computers')
  })
  it('falls back to all products when untargeted', () => {
    expect(promoScope(promo())).toBe('All products')
  })
})
