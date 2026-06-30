import { Navigate } from 'react-router-dom'
import { useAuthStore } from './auth-store'
import { usePermissions } from './use-permissions'
import type { Permission } from './permissions'
import type { ReactNode } from 'react'

interface Props {
  permission?: Permission
  children: ReactNode
}

export function ProtectedRoute({ permission, children }: Props) {
  const token = useAuthStore((s) => s.token)
  const { can } = usePermissions()

  if (!token) return <Navigate to="/login" replace />
  if (permission && !can(permission)) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
