import { useAuthStore } from './auth-store'
import type { Permission } from './permissions'

export function usePermissions() {
  const { role, permissions } = useAuthStore()
  const isAdmin = role === 'owner' || role === 'admin'

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
