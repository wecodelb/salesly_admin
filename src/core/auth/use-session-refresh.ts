import { useEffect } from 'react'
import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import { useAuthStore } from './auth-store'
import type { Permission } from './permissions'
import type { Module } from './modules'

interface UserEnvelope {
  data?: {
    user?: {
      role?: { name?: string; permissions?: Permission[] }
      permissions?: Permission[]
      modules?: Module[]
    }
  }
}

/**
 * Re-read who this person is, once per page load.
 *
 * The session is kept in the browser, so without this a manager signed in
 * last month keeps last month's permissions and modules until he signs out:
 * a key handed to him since, or a module the company has just bought, would
 * stay invisible to him while working for everybody who signed in after. The
 * server is the authority on both; this only brings the menu in line with it.
 *
 * A failure is left alone — the stored session carries on as it was, and a
 * 401 is already turned into a sign-out by the API client.
 */
export function useSessionRefresh() {
  const token = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const setAccess = useAuthStore((s) => s.setAccess)

  useEffect(() => {
    if (!hasHydrated || !token) return
    let cancelled = false

    apiClient
      .get<UserEnvelope>(ENDPOINTS.AUTH.USER)
      .then(({ data }) => {
        const user = data?.data?.user
        if (cancelled || !user) return

        setAccess(
          (user.role?.name ?? 'admin').toLowerCase(),
          user.permissions ?? user.role?.permissions ?? [],
          Array.isArray(user.modules) ? user.modules : [],
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // Once per load and per sign-in, not on every render.
  }, [hasHydrated, token, setAccess])
}
