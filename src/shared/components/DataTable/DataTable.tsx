import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from 'lucide-react'
import type { SortState } from '@/core/types/common'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  /**
   * What this column actually sorts by, where the stored value doesn't sort
   * itself — a `d/m/Y` date compared as text puts the 3rd of November before
   * the 2nd of January. Falls back to the field named by `key`.
   */
  sortValue?: (row: T) => string | number | null | undefined
  width?: string
  /** Numeric columns read better right-aligned. */
  align?: 'left' | 'right' | 'center'
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  keyField?: keyof T
  loading?: boolean
  onRowClick?: (row: T) => void
  emptyMessage?: string
  /** Shown above the empty message — an empty table is worth illustrating. */
  emptyIcon?: ReactNode
  /** Rendered under the empty message, e.g. a "New category" button. */
  emptyAction?: ReactNode
  /**
   * The rows as the table is actually showing them — sorted, in order.
   *
   * The sort lives in here rather than in the page, so a page has no other way
   * to know what its own table looks like. Export needs exactly that: a PDF
   * printed in a different order from the table it was run from is a PDF nobody
   * can check against the screen. Fired on a change, not every render.
   */
  onVisibleRows?: (rows: T[]) => void
}

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const

// Varying the widths stops the loading state reading as a striped block and
// makes it look like text that hasn't arrived yet.
const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-1/3']

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  loading = false,
  onRowClick,
  emptyMessage = 'No data found',
  emptyIcon,
  emptyAction,
  onVisibleRows,
}: Props<T>) {
  const [sort, setSort] = useState<SortState | null>(null)

  // Read inside the sort without being a dependency of it — see the memo below.
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const toggleSort = (field: string) => {
    setSort((prev) =>
      prev?.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    )
  }

  // Memoised on the data and the sort alone. `columns` is rebuilt on every
  // render by most pages, so keying on it would make this a fresh array each
  // time and turn the effect below into a loop.
  const sorted = useMemo(() => {
    const rows = [...data]
    if (!sort) return rows

    const read = columnsRef.current.find((col) => col.key === sort.field)?.sortValue

    return rows.sort((a, b) => {
      const aVal = read ? read(a) : a[sort.field]
      const bVal = read ? read(b) : b[sort.field]
      if (aVal == null) return 1
      if (bVal == null) return -1
      // Numbers compare numerically; anything else falls back to a natural
      // string compare so "Item 2" sorts before "Item 10".
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [data, sort])

  useEffect(() => {
    onVisibleRows?.(sorted)
  }, [sorted, onVisibleRows])

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[var(--bg-surface-raised)] border-b border-[var(--border-default)]">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={
                  sort?.field === col.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : col.sortable
                      ? 'none'
                      : undefined
                }
                className={[
                  'px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap',
                  ALIGN[col.align ?? 'left'],
                  col.width ?? '',
                  col.sortable
                    ? 'cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors'
                    : '',
                ].join(' ')}
                onClick={() => col.sortable && toggleSort(col.key)}
              >
                <div
                  className={[
                    'flex items-center gap-1',
                    col.align === 'right' ? 'justify-end' : '',
                    col.align === 'center' ? 'justify-center' : '',
                  ].join(' ')}
                >
                  {col.header}
                  {col.sortable &&
                    (sort?.field === col.key ? (
                      sort.direction === 'asc' ? (
                        <ChevronUp size={12} className="text-[var(--accent-primary)]" />
                      ) : (
                        <ChevronDown size={12} className="text-[var(--accent-primary)]" />
                      )
                    ) : (
                      <ChevronsUpDown size={12} className="opacity-40" />
                    ))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border-subtle)]">
                {columns.map((col, c) => (
                  <td key={col.key} className="px-4 py-3.5">
                    <div
                      className={`h-4 bg-[var(--border-default)] rounded animate-pulse ${
                        SKELETON_WIDTHS[(i + c) % SKELETON_WIDTHS.length]
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16">
                <div className="flex flex-col items-center gap-3 text-center">
                  {emptyIcon && <div className="text-[var(--text-muted)] opacity-60">{emptyIcon}</div>}
                  <p className="text-sm text-[var(--text-muted)]">{emptyMessage}</p>
                  {emptyAction}
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={keyField ? String(row[keyField as string]) : i}
                className={[
                  'border-b border-[var(--border-subtle)] last:border-0 transition-colors',
                  'hover:bg-[var(--bg-surface-raised)]',
                  onRowClick ? 'cursor-pointer' : '',
                ].join(' ')}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-3.5 text-[var(--text-primary)]',
                      ALIGN[col.align ?? 'left'],
                    ].join(' ')}
                  >
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

/** Convenience default so callers don't each import the same icon. */
DataTable.EmptyIcon = <Inbox size={30} />
