import { useAuthStore } from './auth-store'
import type { Permission } from './permissions'

export function usePermissions() {
  const { role: rawRole, permissions } = useAuthStore()
  // The backend Role names are capitalized ('Admin'); sessions persisted
  // before login normalization may still carry that casing — lowercase here
  // so every consumer compares against one vocabulary.
  const role = rawRole?.toLowerCase() ?? null
  // Admin is the highest role (there is no "owner"); admins bypass permission checks.
  const isAdmin = role === 'admin'

  const can = (permission: Permission): boolean => {
    if (isAdmin) return true
    return permissions.includes(permission)
  }

  const canAny = (perms: Permission[]): boolean => {
    if (isAdmin) return true
    return perms.some((p) => permissions.includes(p))
  }

  const canAll = (perms: Permission[]): boolean => {
    if (isAdmin) return true
    return perms.every((p) => permissions.includes(p))
  }

  return { can, canAny, canAll, isAdmin, role, permissions }
}
