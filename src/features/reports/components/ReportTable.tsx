import { Fragment, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { money, qty } from '../report-format'
import { groupRows, type AnyRow, type ScreenColumn } from '../server-report-doc'

interface Props {
  rows: AnyRow[]
  levels: string[]
  keyColumns: ScreenColumn<AnyRow>[]
  measures: ScreenColumn<AnyRow>[]
  /** Heading for the first level's column when the table is grouped. */
  groupHeading?: string
  /** Figures are being re-read; the old ones stay, faded. */
  refreshing?: boolean
}

type Sort = { id: string; dir: 'asc' | 'desc' } | null

function compare(a: number | string | null | undefined, b: number | string | null | undefined): number {
  // Blanks sort last whichever way the column runs: a row with no figure is
  // never the answer to "who sold the most" or "who sold the least".
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

function sumOf(rows: AnyRow[], col: ScreenColumn<AnyRow>): string {
  if (!col.total) return ''
  const total = rows.reduce((s, r) => {
    const v = col.total!(r)
    return Number.isFinite(v) ? s + v : s
  }, 0)
  return col.kind === 'money' ? money(total) : qty(total)
}

function Cell({ col, row }: { col: ScreenColumn<AnyRow>; row: AnyRow }) {
  const text = col.value(row)
  const raw = col.raw?.(row)
  const value = typeof raw === 'number' ? raw : null

  if (col.display === 'share') {
    const width = Math.max(0, Math.min(100, value ?? 0))
    return (
      <div className="relative ml-auto flex h-6 w-24 items-center justify-end">
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 rounded-sm bg-[var(--accent-primary)]/12"
          style={{ width: `${width}%` }}
        />
        <span className="relative pr-1">{text}</span>
      </div>
    )
  }

  if (col.display === 'growth') {
    if (value === null) return <span className="text-[var(--text-muted)]">—</span>
    const up = value > 0
    const flat = value === 0
    const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
    return (
      <span
        className={[
          'inline-flex items-center justify-end gap-1 font-medium',
          flat ? 'text-[var(--text-muted)]' : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--accent-red)]',
        ].join(' ')}
      >
        <Icon size={14} aria-hidden />
        {text}
      </span>
    )
  }

  if (col.display === 'ratio') {
    if (value === null) return <span className="text-[var(--text-muted)]">—</span>
    // Most of a load should be sold. A tenth back is normal; a quarter is a
    // van loaded with the wrong things.
    const tone =
      value < 10
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : value < 25
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{text}</span>
  }

  return <>{text}</>
}

/**
 * A report's rows: flat when grouped one way, a collapsible tree when grouped
 * two or three ways, sortable on any column either way.
 */
export function ReportTable({ rows, levels, keyColumns, measures, groupHeading, refreshing }: Props) {
  const [sort, setSort] = useState<Sort>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const grouped = levels.length > 1
  const leafKeys = grouped ? keyColumns.slice(1) : keyColumns
  const columns = [...leafKeys, ...measures]

  const groups = useMemo(() => {
    const cut = groupRows(rows, levels)
    if (!sort) return cut

    const col = columns.find((c) => c.id === sort.id)
    if (!col?.sortValue) return cut
    const dir = sort.dir === 'asc' ? 1 : -1
    const byRow = (a: AnyRow, b: AnyRow) => dir * compare(col.sortValue!(a), col.sortValue!(b))

    return cut.map((g) => ({ ...g, rows: [...g.rows].sort(byRow) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, levels, sort])

  const toggleSort = (id: string) =>
    setSort((s) => (s?.id !== id ? { id, dir: 'desc' } : s.dir === 'desc' ? { id, dir: 'asc' } : null))

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const numeric = (c: ScreenColumn<AnyRow>) => c.kind === 'money' || c.kind === 'number'
  const firstIsGroup = grouped

  return (
    <div
      className={[
        'overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] transition-opacity',
        refreshing ? 'opacity-60' : '',
      ].join(' ')}
    >
      <table className="w-full min-w-[680px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface-raised)]">
            {firstIsGroup && (
              <th className="w-8 px-2 py-3" aria-label={groupHeading ?? 'Group'} />
            )}
            {columns.map((col, i) => {
              const active = sort?.id === col.id
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={[
                    'whitespace-nowrap px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]',
                    numeric(col) ? 'text-right' : 'text-left',
                    i === 0 && !firstIsGroup ? 'pl-4' : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.id)}
                    className={[
                      'inline-flex items-center gap-1 rounded transition-colors hover:text-[var(--text-primary)]',
                      active ? 'text-[var(--text-primary)]' : '',
                    ].join(' ')}
                  >
                    {col.header}
                    {active &&
                      (sort!.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {groups.map((group) => {
            const shut = collapsed.has(group.key)
            return (
              <Fragment key={group.key}>
                {grouped && (
                  <tr className="border-b border-[var(--border-default)] bg-[var(--accent-primary)]/[0.04]">
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={!shut}
                        aria-label={`${shut ? 'Show' : 'Hide'} ${group.label}`}
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
                      >
                        {shut ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                    <td colSpan={leafKeys.length} className="px-2.5 py-2">
                      <span className="font-semibold text-[var(--text-primary)]">{group.label}</span>
                      <span className="ml-2 rounded-full bg-[var(--bg-surface-raised)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                        {group.rows.length}
                      </span>
                    </td>
                    {measures.map((col) => (
                      <td
                        key={col.id}
                        className="whitespace-nowrap px-2.5 py-2 text-right font-semibold tabular-nums text-[var(--text-primary)]"
                      >
                        {sumOf(group.rows, col)}
                      </td>
                    ))}
                  </tr>
                )}

                {!shut &&
                  group.rows.map((row, r) => (
                    <tr
                      key={`${group.key}-${r}`}
                      className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--bg-surface-raised)]/70"
                    >
                      {grouped && <td />}
                      {columns.map((col, i) => (
                        <td
                          key={col.id}
                          className={[
                            'whitespace-nowrap px-2.5 py-2',
                            numeric(col)
                              ? 'text-right tabular-nums text-[var(--text-secondary)]'
                              : 'text-[var(--text-primary)]',
                            i === 0 && !grouped ? 'pl-4 font-medium' : '',
                            i === 0 && grouped ? 'pl-3' : '',
                            col.id === 'net' ? 'font-semibold !text-[var(--text-primary)]' : '',
                          ].join(' ')}
                        >
                          <Cell col={col} row={row} />
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            )
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-[var(--accent-primary)]/40 bg-[var(--bg-surface-raised)]">
            {firstIsGroup && <td />}
            {columns.map((col, i) => (
              <td
                key={col.id}
                className={[
                  'whitespace-nowrap px-2.5 py-2.5 font-bold tabular-nums text-[var(--text-primary)]',
                  numeric(col) ? 'text-right' : 'text-left',
                  i === 0 && !firstIsGroup ? 'pl-4' : '',
                ].join(' ')}
              >
                {i === 0 ? 'Total' : measures.includes(col) ? sumOf(rows, col) : ''}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
