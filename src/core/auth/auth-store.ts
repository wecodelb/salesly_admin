import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Permission } from './permissions'

export interface AuthUser {
  id: string
  name: string
  email: string
  avatar?: string
  company?: string
}

interface AuthStore {
  token: string | null
  user: AuthUser | null
  role: string | null
  permissions: Permission[]
  hasHydrated: boolean
  setAuth: (token: string, user: AuthUser, role: string, permissions: Permission[]) => void
  setUser: (user: AuthUser) => void
  clearAuth: () => void
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      role: null,
      permissions: [],
      // Tracks whether persist has finished reading localStorage. Route guards
      // wait for this so a refresh/deep-link doesn't bounce an authed user to
      // /login before the persisted token is rehydrated.
      hasHydrated: false,
      setAuth: (token, user, role, permissions) =>
        set({ token, user, role, permissions }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ token: null, user: null, role: null, permissions: [] }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'salesly-auth',
      partialize: (s) => ({ token: s.token, user: s.user, role: s.role, permissions: s.permissions }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)
