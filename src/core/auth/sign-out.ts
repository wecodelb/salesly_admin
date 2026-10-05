import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import { useAuthStore } from './auth-store'

/** Long enough for a healthy server, short enough that a dead one can't hold the user hostage. */
const REVOKE_TIMEOUT_MS = 3000

/**
 * Revokes the session on the server, then forgets it here.
 *
 * The order is the whole point. This used to fire the revoke and clear the
 * store in the same tick, but axios runs its request interceptors
 * asynchronously — by the time the interceptor went to attach the bearer
 * token, the store had already dropped it. The server got an anonymous
 * /logout, the token stayed valid, and any other open tab kept working.
 *
 * Waiting is bounded: if the server is slow or unreachable the local session
 * is cleared anyway, because a sign-out button that doesn't sign out is worse
 * than a token left to expire.
 */
export async function signOut(): Promise<void> {
  if (useAuthStore.getState().token) {
    try {
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT, null, { timeout: REVOKE_TIMEOUT_MS })
    } catch {
      // Already revoked, unreachable, or timed out — nothing left to do but
      // clear what this browser holds.
    }
  }

  useAuthStore.getState().clearAuth()
  window.location.href = '/login'
}
