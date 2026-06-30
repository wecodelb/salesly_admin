import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { SortState } from '@/core/types/common'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  keyField?: keyof T
  loading?: boolean
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  loading = false,
  onRowClick,
  emptyMessage = 'No data found',
}: Props<T>) {
  const [sort, setSort] = useState<SortState | null>(null)

  const toggleSort = (field: string) => {
    setSort((prev) =>
      prev?.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    )
  }

  const sorted = [...data].sort((a, b) => {
    if (!sort) return 0
    const aVal = a[sort.field]
    const bVal = b[sort.field]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sort.direction === 'asc' ? cmp : -cmp
  })

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--bg-surface-raised)] border-b border-[var(--border-default)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  'text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide',
                  col.width ?? '',
                  col.sortable ? 'cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors' : '',
                ].join(' ')}
                onClick={() => col.sortable && toggleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    sort?.field === col.key ? (
                      sort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ChevronsUpDown size={12} className="opacity-40" />
                    )
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border-subtle)]">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-[var(--border-default)] rounded animate-pulse w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={keyField ? String(row[keyField as string]) : i}
                className={[
                  'border-b border-[var(--border-subtle)] transition-colors',
                  'hover:bg-[var(--bg-surface-raised)]',
                  onRowClick ? 'cursor-pointer' : '',
                ].join(' ')}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-[var(--text-primary)]">
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
