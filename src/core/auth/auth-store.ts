import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Permission } from './permissions'
import type { Module } from './modules'

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
  /** What the company bought. Read off login and refreshed on every load. */
  modules: Module[]
  hasHydrated: boolean
  setAuth: (token: string, user: AuthUser, role: string, permissions: Permission[], modules?: Module[]) => void
  setUser: (user: AuthUser) => void
  /** Swap in what the server says now, keeping the token and the user. */
  setAccess: (role: string, permissions: Permission[], modules: Module[]) => void
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
      modules: [],
      // Tracks whether persist has finished reading localStorage. Route guards
      // wait for this so a refresh/deep-link doesn't bounce an authed user to
      // /login before the persisted token is rehydrated.
      hasHydrated: false,
      setAuth: (token, user, role, permissions, modules = []) =>
        set({ token, user, role, permissions, modules }),
      setUser: (user) => set({ user }),
      setAccess: (role, permissions, modules) => set({ role, permissions, modules }),
      clearAuth: () => set({ token: null, user: null, role: null, permissions: [], modules: [] }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'salesly-auth',
      partialize: (s) => ({ token: s.token, user: s.user, role: s.role, permissions: s.permissions, modules: s.modules }),
      // A session saved before modules existed has no list at all; read it as
      // none rather than undefined, until the refresh on load fills it in.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AuthStore>
        return { ...current, ...saved, modules: Array.isArray(saved.modules) ? saved.modules : [] }
      },
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)
