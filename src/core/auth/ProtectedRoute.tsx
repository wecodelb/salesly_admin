import { useEffect } from 'react'
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
  const role = useAuthStore((s) => s.role)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { can } = usePermissions()

  // Salesmen belong in the mobile app, not this console. If a salesman session
  // was ever persisted, clear it so they can't linger in the admin.
  const isSalesman = role === 'salesman'
  useEffect(() => {
    if (hasHydrated && token && isSalesman) clearAuth()
  }, [hasHydrated, token, isSalesman, clearAuth])

  // Wait for persist to finish reading localStorage before deciding — otherwise
  // a page refresh or deep link redirects an authenticated user to /login.
  if (!hasHydrated) return null

  if (!token || isSalesman) return <Navigate to="/login" replace />
  if (permission && !can(permission)) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
