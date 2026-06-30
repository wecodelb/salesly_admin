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
  setAuth: (token: string, user: AuthUser, role: string, permissions: Permission[]) => void
  setUser: (user: AuthUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      role: null,
      permissions: [],
      setAuth: (token, user, role, permissions) =>
        set({ token, user, role, permissions }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ token: null, user: null, role: null, permissions: [] }),
    }),
    {
      name: 'salesly-auth',
      partialize: (s) => ({ token: s.token, user: s.user, role: s.role, permissions: s.permissions }),
    },
  ),
)
