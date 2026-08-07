import { describe, expect, it } from 'vitest'
import { PERMISSIONS, type Permission } from '@/core/auth/permissions'
import { PERMISSION_GROUPS, ROLE_PRESETS } from './permission-catalog'

const cataloged = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key))
const all = Object.values(PERMISSIONS) as Permission[]

describe('permission catalog', () => {
  it('offers every permission the app knows about', () => {
    // The matrix can only toggle what it renders: a key missing here is a key
    // nobody can grant. customers.delete and customers.verify were both live in
    // the gating code while absent from this list.
    const missing = all.filter((p) => !cataloged.includes(p))
    expect(missing).toEqual([])
  })

  it('offers nothing the app does not know about', () => {
    const unknown = cataloged.filter((p) => !all.includes(p))
    expect(unknown).toEqual([])
  })

  it('lists each permission exactly once', () => {
    const seen = new Set<Permission>()
    const duplicates = cataloged.filter((p) => (seen.has(p) ? true : (seen.add(p), false)))
    expect(duplicates).toEqual([])
  })

  it('gives admins and managers everything', () => {
    expect([...ROLE_PRESETS.admin].sort()).toEqual([...all].sort())
    expect([...ROLE_PRESETS.manager].sort()).toEqual([...all].sort())
  })

  it('keeps a salesman out of reports, user management and reference data', () => {
    expect(ROLE_PRESETS.salesman).not.toContain(PERMISSIONS.REPORTS_VIEW)
    expect(ROLE_PRESETS.salesman).not.toContain(PERMISSIONS.USERS_EDIT)
    expect(ROLE_PRESETS.salesman).not.toContain(PERMISSIONS.PREFERENCES_MANAGE)
    // …while keeping what the mobile app actually needs.
    expect(ROLE_PRESETS.salesman).toContain(PERMISSIONS.CUSTOMERS_VIEW)
    expect(ROLE_PRESETS.salesman).toContain(PERMISSIONS.PRODUCTS_VIEW)
  })
})
