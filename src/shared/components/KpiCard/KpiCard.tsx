import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  change?: number
  changePeriod?: string
  icon?: ReactNode
  iconBg?: string
  sparkline?: ReactNode
  loading?: boolean
}

export function KpiCard({ title, value, change, changePeriod = 'vs last month', icon, iconBg, sparkline, loading = false }: Props) {
  const isPositive = (change ?? 0) > 0
  const isNeutral = change === 0 || change === undefined

  return (
    <div className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)] flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-[var(--border-default)] rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-[var(--text-primary)] font-mono">{value}</p>
          )}
        </div>
        {icon && (
          <div
            className={[
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              iconBg ?? 'bg-[var(--accent-primary)]/10',
            ].join(' ')}
          >
            {icon}
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1.5">
          {isNeutral ? (
            <Minus size={14} className="text-[var(--text-muted)]" />
          ) : isPositive ? (
            <TrendingUp size={14} className="text-[var(--accent-green)]" />
          ) : (
            <TrendingDown size={14} className="text-[var(--accent-red)]" />
          )}
          <span className={[
            'text-xs font-medium',
            isNeutral ? 'text-[var(--text-muted)]' : isPositive ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]',
          ].join(' ')}>
            {isNeutral ? '—' : `${isPositive ? '+' : ''}${change}%`}
          </span>
          <span className="text-xs text-[var(--text-muted)]">{changePeriod}</span>
        </div>
      )}

      {sparkline && <div className="mt-auto">{sparkline}</div>}
    </div>
  )
}
