import { beforeEach, describe, expect, it } from 'vitest'
import { formatMoney, isOverLimit, type AdminCustomer } from './types'
import {
  MOCK_SALESMEN,
  mockAssignSalesman,
  mockFetchCustomers,
  mockFetchSalesmen,
  mockSetCreditLimit,
} from './mock-data'

const customer = (over: Partial<AdminCustomer> = {}): AdminCustomer => ({
  id: 1,
  code: 'C-0001',
  name: 'Test Shop',
  phone1: '',
  phone2: '',
  email: '',
  address: '',
  salesman_id: null,
  salesman_name: null,
  credit_limit: null,
  balance: 0,
  is_active: true,
  is_verified: true,
  ...over,
})

describe('isOverLimit', () => {
  it('is true only once the balance passes the limit', () => {
    expect(isOverLimit(customer({ credit_limit: 1000, balance: 1001 }))).toBe(true)
    expect(isOverLimit(customer({ credit_limit: 1000, balance: 1000 }))).toBe(false)
    expect(isOverLimit(customer({ credit_limit: 1000, balance: 999 }))).toBe(false)
  })

  it('treats no limit as no cap', () => {
    expect(isOverLimit(customer({ credit_limit: null, balance: 99_999 }))).toBe(false)
  })

  it('ignores a zero limit rather than flagging every balance', () => {
    // A 0 limit reads as "unset" in the backend contract, not "cash only".
    expect(isOverLimit(customer({ credit_limit: 0, balance: 50 }))).toBe(false)
  })

  it('never flags a customer in credit', () => {
    expect(isOverLimit(customer({ credit_limit: 100, balance: -500 }))).toBe(false)
  })
})

describe('formatMoney', () => {
  it('formats positives with a thousands separator', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.5')
    expect(formatMoney(0)).toBe('$0')
  })

  it('puts the sign before the currency symbol, not after', () => {
    expect(formatMoney(-480)).toBe('-$480')
  })

  it('caps at two decimal places', () => {
    expect(formatMoney(10.129)).toBe('$10.13')
  })
})

describe('mock store', () => {
  // The store is module-level and mutable, so each test re-reads it rather
  // than trusting state from a previous one.
  beforeEach(async () => {
    const all = await mockFetchCustomers()
    await Promise.all(
      all.map((c) => mockAssignSalesman(c.id, c.salesman_id)),
    )
  })

  it('hands out copies so callers cannot mutate the store', async () => {
    const first = await mockFetchCustomers()
    first[0].name = 'MUTATED'

    const second = await mockFetchCustomers()
    expect(second[0].name).not.toBe('MUTATED')
  })

  it('assigns a salesman and resolves the display name', async () => {
    await mockAssignSalesman(5, 12)

    const found = (await mockFetchCustomers()).find((c) => c.id === 5)!
    expect(found.salesman_id).toBe(12)
    expect(found.salesman_name).toBe('Omar Nasser')
  })

  it('unassigns by clearing both id and name', async () => {
    await mockAssignSalesman(1, null)

    const found = (await mockFetchCustomers()).find((c) => c.id === 1)!
    expect(found.salesman_id).toBeNull()
    expect(found.salesman_name).toBeNull()
  })

  it('ignores an unknown salesman id instead of storing a dangling ref', async () => {
    await mockAssignSalesman(1, 9999)

    const found = (await mockFetchCustomers()).find((c) => c.id === 1)!
    expect(found.salesman_id).toBeNull()
    expect(found.salesman_name).toBeNull()
  })

  it('touches only the targeted customer', async () => {
    const before = await mockFetchCustomers()
    const untouched = before.filter((c) => c.id !== 5)

    await mockAssignSalesman(5, 13)

    const after = await mockFetchCustomers()
    for (const c of untouched) {
      const now = after.find((x) => x.id === c.id)!
      expect(now.salesman_id).toBe(c.salesman_id)
    }
  })

  it('sets and clears a credit limit', async () => {
    await mockSetCreditLimit(5, 2500)
    expect((await mockFetchCustomers()).find((c) => c.id === 5)!.credit_limit).toBe(2500)

    await mockSetCreditLimit(5, null)
    expect((await mockFetchCustomers()).find((c) => c.id === 5)!.credit_limit).toBeNull()
  })

  it('exposes salesmen for the assign dropdown', async () => {
    const salesmen = await mockFetchSalesmen()
    expect(salesmen).toHaveLength(MOCK_SALESMEN.length)
    expect(salesmen.map((s) => s.name)).toContain('Ahmad Khalil')
  })

  it('every assigned customer points at a real salesman', async () => {
    const salesmanIds = new Set(MOCK_SALESMEN.map((s) => s.id))

    for (const c of await mockFetchCustomers()) {
      if (c.salesman_id !== null) {
        expect(salesmanIds).toContain(c.salesman_id)
        expect(c.salesman_name).toBeTruthy()
      } else {
        expect(c.salesman_name).toBeNull()
      }
    }
  })

  it('ships some unassigned customers so the assign flow is demoable', async () => {
    const all = await mockFetchCustomers()
    expect(all.some((c) => c.salesman_id === null)).toBe(true)
    expect(all.some((c) => isOverLimit(c))).toBe(true)
  })
})
