import { describe, expect, it } from 'vitest'
import { capacityLine, deleteBlockedReason, hasSystemOwnedIdentity, type Warehouse } from './types'

function warehouse(overrides: Partial<Warehouse> = {}): Warehouse {
  return {
    id: 1,
    uuid: null,
    code: 'WH-1',
    name: 'Second Warehouse',
    location: '',
    area_id: null,
    is_depot: false,
    is_main: false,
    salesman: null,
    max_weight: null,
    max_volume: null,
    ...overrides,
  }
}

function depot(overrides: Partial<Warehouse> = {}): Warehouse {
  return warehouse({
    id: 16,
    code: 'DEP-AK',
    name: 'Ahmad Khalil depot',
    is_depot: true,
    salesman: { id: 7, name: 'Ahmad Khalil' },
    ...overrides,
  })
}

describe('deleteBlockedReason', () => {
  it('lets an ordinary warehouse go', () => {
    expect(deleteBlockedReason(warehouse())).toBeNull()
  })

  it('holds on to the main warehouse', () => {
    // Every document that names no source comes out of it, and the failure
    // would otherwise surface on a phone in a car park.
    expect(deleteBlockedReason(warehouse({ is_main: true }))).toContain('main warehouse')
  })

  it('holds on to a depot somebody is still driving, and names him', () => {
    // The ledger rows cascade with the warehouse, so this would delete stock
    // that is sitting on a vehicle.
    expect(deleteBlockedReason(depot())).toContain('Ahmad Khalil')
  })

  it('lets a depot nobody drives go', () => {
    // Exactly the backend's rule: it asks whether the depot has an owner, not
    // whether it is a depot.
    expect(deleteBlockedReason(depot({ salesman: null }))).toBeNull()
  })

  it('answers for the main warehouse first when both would refuse', () => {
    expect(deleteBlockedReason(depot({ is_main: true }))).toContain('main warehouse')
  })
})

describe('hasSystemOwnedIdentity', () => {
  it('is the depots, whose names were written with their salesman’s account', () => {
    expect(hasSystemOwnedIdentity(depot())).toBe(true)
  })

  it('leaves a fixed warehouse fully editable', () => {
    expect(hasSystemOwnedIdentity(warehouse())).toBe(false)
  })
})

describe('capacityLine', () => {
  it('says nothing at all for a warehouse nobody has measured', () => {
    // Uncapped and "holds nothing" are opposite facts, and every fixed
    // warehouse is the first one.
    expect(capacityLine(warehouse())).toBeNull()
  })

  it('reads both ceilings with their units', () => {
    expect(capacityLine(depot({ max_weight: 3500, max_volume: 20 }))).toBe('3,500 kg · 20 m³')
  })

  it('leaves out the half nobody measured rather than printing a zero', () => {
    expect(capacityLine(depot({ max_weight: 1200 }))).toBe('1,200 kg')
  })

  it('keeps a ceiling of zero, which is somebody saying it carries nothing', () => {
    expect(capacityLine(depot({ max_weight: 0 }))).toBe('0 kg')
  })
})
