import type { ReactNode } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '../Input'

interface Props {
  search?: string
  onSearch?: (q: string) => void
  searchPlaceholder?: string
  filters?: ReactNode
  actions?: ReactNode
  /** How many filters are currently set — drives the "Clear" affordance. */
  activeCount?: number
  onClearFilters?: () => void
}

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = 'Search...',
  filters,
  actions,
  activeCount = 0,
  onClearFilters,
}: Props) {
  const showClear = activeCount > 0 && onClearFilters !== undefined

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {onSearch !== undefined && (
        <div className="w-64">
          <Input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            leftIcon={<Search size={14} />}
          />
        </div>
      )}

      {filters && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Anchors the row of pills so they read as one control group rather
              than as loose buttons trailing the search box. */}
          <SlidersHorizontal
            size={15}
            className="text-[var(--text-muted)] flex-shrink-0 hidden sm:block"
            aria-hidden
          />
          {filters}

          {showClear && (
            <button
              type="button"
              onClick={onClearFilters}
              className={[
                'h-10 px-2.5 inline-flex items-center gap-1.5 text-sm rounded-[var(--radius-btn)]',
                'text-[var(--text-secondary)] hover:text-[var(--accent-red)]',
                'hover:bg-[var(--accent-red)]/10 transition-colors cursor-pointer',
              ].join(' ')}
            >
              <X size={14} />
              Clear
              <span className="text-xs tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--bg-surface-raised)] text-[var(--text-muted)]">
                {activeCount}
              </span>
            </button>
          )}
        </div>
      )}

      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
