import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
import { lastSeen, markSeen, useNewCount, type SeenKind } from './new-since'

/**
 * How each count is drawn. A solid circle for all of them; the colour says
 * what kind of thing is waiting, and only "online" pulses — it is live, the
 * others are a tally.
 */
const BADGE_LOOK: Record<NavBadge, { circle: string; dot: string; noun: string; pulse?: boolean }> = {
  'new-invoices': { circle: 'bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.2)]', dot: 'bg-blue-400', noun: 'new' },
  'new-returns': { circle: 'bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.2)]', dot: 'bg-rose-400', noun: 'new' },
  'pending-load-requests': { circle: 'bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.2)]', dot: 'bg-amber-400', noun: 'waiting' },
  'pending-unloads': { circle: 'bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.2)]', dot: 'bg-violet-400', noun: 'waiting' },
  'online-now': { circle: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]', dot: 'bg-emerald-400', noun: 'online now', pulse: true },
}

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

  // When each screen was last opened here. Opening it is seeing what is on
  // it, so arriving there moves the mark and the badge clears at once.
  const { pathname } = useLocation()
  const [seen, setSeen] = useState(() => ({
    invoices: lastSeen('invoices'),
    returns: lastSeen('returns'),
  }))
  useEffect(() => {
    const kind: SeenKind | null = pathname.startsWith('/invoices')
      ? 'invoices'
      : pathname.startsWith('/returns')
        ? 'returns'
        : null
    if (kind) setSeen((s) => ({ ...s, [kind]: markSeen(kind) }))
  }, [pathname])

  const { data: newInvoices = 0 } = useNewCount('invoices', seen.invoices, can(PERMISSIONS.INVOICES_VIEW))
  const { data: newReturns = 0 } = useNewCount('returns', seen.returns, can(PERMISSIONS.RETURNS_VIEW))

  const counts: Record<NavBadge, number> = {
    'pending-load-requests': pendingLoadRequests,
    'pending-unloads': pendingUnloads,
    'online-now': onlineNow,
    // The screen being read has nothing "new" on it — it is all in view.
    'new-invoices': pathname.startsWith('/invoices') ? 0 : newInvoices,
    'new-returns': pathname.startsWith('/returns') ? 0 : newReturns,
  }
  const badgeCount = (badge?: NavBadge): number => (badge ? counts[badge] : 0)

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
                  const look = item.badge ? BADGE_LOOK[item.badge] : null
                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      title={
                        collapsed
                          ? count > 0 && look
                            ? `${item.label} (${count} ${look.noun})`
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
                        {collapsed && count > 0 && look && (
                          <span
                            className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--bg-sidebar)] ${look.dot}`}
                          />
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {/* One shape for every count, a colour for each kind, so
                          the menu reads at a glance: blue new invoices, rose
                          new returns, amber loads to answer, violet unloads
                          to take back, green people online. */}
                      {!collapsed && count > 0 && look && (
                        <span
                          data-testid={`badge-${item.badge}`}
                          aria-label={`${count} ${look.noun}`}
                          className={`relative ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums text-white ${look.circle}`}
                        >
                          {look.pulse && (
                            <span className={`absolute inset-0 animate-ping rounded-full opacity-40 ${look.dot}`} />
                          )}
                          <span className="relative">{count > 99 ? '99+' : count}</span>
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
