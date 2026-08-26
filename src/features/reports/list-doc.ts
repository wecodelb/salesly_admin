import { scopeLine } from './report-format'
import type { ReportColumn, ReportDocument, ReportGroup } from './report-types'

interface ListDocInput<Row> {
  title: string
  /** Plural, lowercase — "customers", "areas". Goes in "42 of 310 areas". */
  noun: string
  /** The rows the screen is showing, already filtered. */
  rows: Row[]
  /** How many there are in total, so a narrowed page says how narrow it is. */
  total: number
  columns: ReportColumn<Row>[]
  /** The active filters, in words. Falsy entries are dropped. */
  filters?: Array<string | false | null | undefined>
  summary?: { label: string; value: string }[]
  /** Grouped output. Defaults to one flat, unheaded run of rows. */
  groups?: ReportGroup<Row>[]
  emptyMessage?: string
}

/**
 * A list screen, as a printed page.
 *
 * Most of the console's screens are one table with a search box over it, and
 * their exports differ only in the columns. This holds the part that is the
 * same everywhere — and in particular the subtitle, which is the one thing an
 * export cannot be allowed to get wrong. On screen the filters are visible in
 * the bar above the table; on paper they are gone, and a narrowed list with
 * nothing saying so is read as the complete book.
 */
export function listDoc<Row>({
  title,
  noun,
  rows,
  total,
  columns,
  filters = [],
  summary,
  groups,
  emptyMessage,
}: ListDocInput<Row>): ReportDocument<Row> {
  return {
    title,
    subtitle: scopeLine(rows.length, total, noun, filters),
    columns,
    groups: groups ?? [{ key: 'all', title: '', rows }],
    summary,
    emptyMessage: emptyMessage ?? `No ${noun} match these filters.`,
  }
}

/** The search box, phrased for the page. Empty when nothing was typed. */
export function searchNote(search: string): string | false {
  const q = search.trim()
  return q ? `Search “${q}”` : false
}
