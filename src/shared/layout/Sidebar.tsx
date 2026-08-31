import { NavLink } from 'react-router-dom'
import { ChevronLeft, Zap } from 'lucide-react'
import { SaleslyWordmark } from '@/shared/components/SaleslyWordmark/SaleslyWordmark'
import { NAV_GROUPS, type NavBadge } from './nav-config'
import { ICON_MAP } from './nav-icons'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS, type Permission } from '@/core/auth/permissions'
import { usePendingLoadRequestCount } from '@/features/my-depot/hooks/use-my-depot'


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

  const badgeCount = (badge?: NavBadge): number =>
    badge === 'pending-load-requests' ? pendingLoadRequests : 0

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
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-blue)] flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        {/* The same mark, just small. Collapsed there is no room for it at all,
            and the badge to the left is the brand at that width. */}
        {!collapsed && <SaleslyWordmark fontSize={18} />}
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
                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      title={
                        collapsed
                          ? count > 0
                            ? `${item.label} (${count} waiting)`
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
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--accent-amber)]" />
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && count > 0 && (
                        <span className="ml-auto rounded-full bg-[var(--accent-amber)]/20 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--accent-amber)]">
                          {count}
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
