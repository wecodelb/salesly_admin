import { describe, expect, it } from 'vitest'
import { grantableRoles, isAssignableRole, memberLocks } from './member-locks'
import { ROLE_OPTIONS } from './permission-catalog'
import type { CompanyUser } from './types'

const member = (over: Partial<CompanyUser> = {}): CompanyUser => ({
  id: 7,
  name: 'Rami',
  email: 'rami@demo.test',
  phone: null,
  image: null,
  role: 'salesman',
  permissions: [],
  status: 'active',
  ...over,
})

const admin = { id: '1', isAdmin: true }
const manager = { id: '2', isAdmin: false }

describe('memberLocks', () => {
  it('leaves an ordinary member fully editable', () => {
    expect(memberLocks(member(), admin)).toEqual({ access: null, membership: null })
    expect(memberLocks(member({ role: 'manager' }), manager)).toEqual({ access: null, membership: null })
  })

  it('locks the owner, even for an admin', () => {
    // Editing the owner used to send role=salesman, because "owner" is not a
    // role this form can express: fixing their phone number demoted them.
    const locks = memberLocks(member({ role: 'owner' }), admin)
    expect(locks.access).toMatch(/owner/)
    expect(locks.membership).toMatch(/owner/)
  })

  it('locks your own access and membership', () => {
    const locks = memberLocks(member({ id: 1, role: 'admin' }), admin)
    expect(locks.access).toMatch(/your own/)
    expect(locks.membership).toMatch(/your own/)
  })

  it('compares the numeric row id against the string the auth store keeps', () => {
    expect(memberLocks(member({ id: 2 }), manager).membership).not.toBeNull()
    expect(memberLocks(member({ id: 22 }), manager).membership).toBeNull()
  })

  it('keeps a manager off an admin, but not an admin off another admin', () => {
    expect(memberLocks(member({ role: 'admin' }), manager).access).toMatch(/Only an admin/)
    expect(memberLocks(member({ role: 'admin' }), admin)).toEqual({ access: null, membership: null })
  })

  it('does not treat an unknown editor id as a match', () => {
    expect(memberLocks(member(), { id: undefined, isAdmin: true }).membership).toBeNull()
  })
})

describe('isAssignableRole', () => {
  it('accepts only what the backend accepts on write', () => {
    expect(['admin', 'manager', 'salesman'].every(isAssignableRole)).toBe(true)
    expect(isAssignableRole('owner')).toBe(false)
    expect(isAssignableRole('supervisor')).toBe(false)
    expect(isAssignableRole(null)).toBe(false)
  })
})

describe('grantableRoles', () => {
  it('offers admin only to an admin', () => {
    expect(grantableRoles(ROLE_OPTIONS, admin).map((o) => o.value)).toContain('admin')
    expect(grantableRoles(ROLE_OPTIONS, manager).map((o) => o.value)).toEqual(['manager', 'salesman'])
  })
})
