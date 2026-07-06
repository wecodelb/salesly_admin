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
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const { can } = usePermissions()

  // Wait for persist to finish reading localStorage before deciding — otherwise
  // a page refresh or deep link redirects an authenticated user to /login.
  if (!hasHydrated) return null

  if (!token) return <Navigate to="/login" replace />
  if (permission && !can(permission)) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
