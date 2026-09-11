import { NavLink } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { SaleslyWordmark } from '@/shared/components/SaleslyWordmark/SaleslyWordmark'
import { NAV_GROUPS, type NavBadge } from './nav-config'
import { ICON_MAP } from './nav-icons'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS, type Permission } from '@/core/auth/permissions'
import {
  usePendingLoadRequestCount,
  usePendingUnloadCount,
} from '@/features/my-depot/hooks/use-my-depot'
import { useOnlineCount } from '@/features/activity/hooks/use-activity'


interface Props {
  collapsed: boolean
  onCollapse: (c: boolean) => void
}

export function Sidebar({ collapsed, onCollapse }: Props) {
  const { can, role } = usePermissions()
  // Polled, and only for somebody who may read the feed it counts — the menu
  // renders for everyone, and asking on behalf of a user who would be refused
  // is a 403 every half-minute.
  const { data: pendingLoadRequests = 0 } = usePendingLoadRequestCount(can(PERMISSIONS.DEPOT_VIEW))
  const { data: pendingUnloads = 0 } = usePendingUnloadCount(can(PERMISSIONS.DEPOT_VIEW))

  const { data: onlineNow = 0 } = useOnlineCount(can(PERMISSIONS.ORDERS_VIEW))

  const badgeCount = (badge?: NavBadge): number =>
    badge === 'pending-load-requests'
      ? pendingLoadRequests
      : badge === 'pending-unloads'
        ? pendingUnloads
        : badge === 'online-now'
          ? onlineNow
          : 0

  return (
    <aside
      className={[
        'fixed left-0 top-0 bottom-0 z-30 flex flex-col transition-all duration-300',
        'bg-[var(--bg-sidebar)] border-r border-white/5',
        collapsed ? 'w-16' : 'w-60',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5 min-h-[64px]">
        {/* The wordmark alone, as on the splash. Collapsed there is no room
            for it, so the app icon — the same S and arrow — stands in. */}
        {collapsed ? (
          <img src="/salesly-icon-192.png" alt="Salesly" className="w-8 h-8 rounded-lg flex-shrink-0" />
        ) : (
          <SaleslyWordmark fontSize={20} />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-none">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => {
            const permOk = !item.permission || can(item.permission as Permission)
            const roleOk = !item.roles || (role != null && item.roles.includes(role))
            return permOk && roleOk
          })
          if (visible.length === 0) return null
          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visible.map((item) => {
                  const Icon = ICON_MAP[item.icon]
                  const count = badgeCount(item.badge)
                  const online = item.badge === 'online-now'
                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      title={
                        collapsed
                          ? count > 0
                            ? `${item.label} (${count} ${online ? 'online' : 'waiting'})`
                            : item.label
                          : undefined
                      }
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/60 hover:bg-white/5 hover:text-white',
                          collapsed ? 'justify-center' : '',
                        ].join(' ')
                      }
                    >
                      <span className="relative flex-shrink-0">
                        {Icon && <Icon size={18} />}
                        {/* Collapsed there is no room for the figure, but the
                            fact that something is waiting still has to survive
                            — a dot on the icon says it without the width. */}
                        {collapsed && count > 0 && (
                          <span
                            className={[
                              'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full',
                              online ? 'bg-emerald-500 ring-2 ring-[var(--bg-sidebar)]' : 'bg-[var(--accent-amber)]',
                            ].join(' ')}
                          />
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && count > 0 && !online && (
                        <span className="ml-auto rounded-full bg-[var(--accent-amber)]/20 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--accent-amber)]">
                          {count}
                        </span>
                      )}
                      {/* Online is good news, not a queue: a solid green
                          circle with a live pulse, rather than the amber pill
                          the depot counts use for work waiting. */}
                      {!collapsed && count > 0 && online && (
                        <span
                          data-testid="online-badge"
                          aria-label={`${count} online now`}
                          className="relative ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold tabular-nums text-white shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                        >
                          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />
                          <span className="relative">{count}</span>
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-white/5">
        <button
          onClick={() => onCollapse(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronLeft
            size={16}
            className={['transition-transform', collapsed ? 'rotate-180' : ''].join(' ')}
          />
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
