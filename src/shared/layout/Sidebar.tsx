import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, Activity, ShoppingCart, FileText, RotateCcw, Banknote,
  MapPin, Route, CheckSquare, Users, Building2, Package, Tags, Percent,
  BarChart2, Trophy, UserCog, CreditCard, Key, MessageCircle, Shield, Settings,
  ChevronLeft, Zap, type LucideIcon,
} from 'lucide-react'
import { NAV_GROUPS } from './nav-config'
import { usePermissions } from '@/core/auth/use-permissions'
import type { Permission } from '@/core/auth/permissions'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Map, Activity, ShoppingCart, FileText, RotateCcw, Banknote,
  MapPin, Route, CheckSquare, Users, Building2, Package, Tags, Percent,
  BarChart2, Trophy, UserCog, CreditCard, Key, MessageCircle, Shield, Settings,
}

interface Props {
  collapsed: boolean
  onCollapse: (c: boolean) => void
}

export function Sidebar({ collapsed, onCollapse }: Props) {
  const { can, role } = usePermissions()
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
        {!collapsed && (
          <span className="text-base font-bold text-white font-heading tracking-tight">Salesly</span>
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
                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
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
                      {Icon && <Icon size={18} className="flex-shrink-0" />}
                      {!collapsed && <span className="truncate">{item.label}</span>}
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
