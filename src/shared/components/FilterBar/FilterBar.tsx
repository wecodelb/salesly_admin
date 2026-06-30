import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '../Input'

interface Props {
  search?: string
  onSearch?: (q: string) => void
  searchPlaceholder?: string
  filters?: ReactNode
  actions?: ReactNode
}

export function FilterBar({ search, onSearch, searchPlaceholder = 'Search...', filters, actions }: Props) {
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
      {filters && <div className="flex items-center gap-2">{filters}</div>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
