import type { ReactNode } from 'react'
import { usePermissions } from './use-permissions'
import type { Permission } from './permissions'

interface Props {
  permission?: Permission
  anyOf?: Permission[]
  allOf?: Permission[]
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGuard({ permission, anyOf, allOf, fallback = null, children }: Props) {
  const { can, canAny, canAll } = usePermissions()

  let allowed = true
  if (permission) allowed = can(permission)
  else if (anyOf) allowed = canAny(anyOf)
  else if (allOf) allowed = canAll(allOf)

  return allowed ? <>{children}</> : <>{fallback}</>
}
