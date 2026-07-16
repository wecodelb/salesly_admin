import { Bell, Search, Sun, Moon, LogOut, ChevronDown } from 'lucide-react'
import { useThemeStore } from '@/core/theme/theme-store'
import { useAuthStore } from '@/core/auth/auth-store'
import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'

export function TopBar() {
  const { theme, toggle } = useThemeStore()
  const { user, clearAuth } = useAuthStore()

  // Don't await the revoke call — if the backend is slow/unreachable, sign-out
  // must still clear local state and redirect immediately rather than hang.
  const handleLogout = () => {
    apiClient.post(ENDPOINTS.AUTH.LOGOUT).catch(() => {})
    clearAuth()
    window.location.href = '/login'
  }

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <header className="fixed top-0 right-0 left-0 z-20 h-16 bg-[var(--bg-topbar)] border-b border-[var(--border-default)] flex items-center gap-4 px-4">
      {/* Search */}
      <div className="flex-1 max-w-sm ml-60">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            placeholder="Quick search..."
            className="w-full h-9 pl-8 pr-3 text-sm rounded-[var(--radius-btn)] bg-[var(--bg-surface-raised)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors">
          <Bell size={16} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--accent-red)]" />
        </button>

        {/* User menu */}
        <Dropdown
          align="right"
          trigger={
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface-raised)] cursor-pointer transition-colors">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-blue)] flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-[var(--text-primary)] leading-none">{user?.name ?? 'User'}</p>
                <p className="text-[10px] text-[var(--text-muted)] leading-none mt-0.5">{user?.email ?? ''}</p>
              </div>
              <ChevronDown size={14} className="text-[var(--text-muted)]" />
            </div>
          }
          items={[
            { label: 'Sign out', icon: <LogOut size={14} />, onClick: handleLogout, danger: true },
          ]}
        />
      </div>
    </header>
  )
}
