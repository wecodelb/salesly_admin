import { listDoc } from '@/features/reports/list-doc'
import { day, qty, sum, text } from '@/features/reports/report-format'
import { rowsOf, typesOf, type Adjustment } from './types'

/**
 * The Adjustments screen, as a printed page.
 *
 * The status column is not decoration here. A pending sheet has moved no stock,
 * so a printed page that listed it beside an approved one without saying which
 * was which would be a page of movements half of which never happened — and on
 * paper there is nobody to ask.
 */
export function adjustmentsExportDoc(
  rows: Adjustment[],
  total: number,
  filters: Array<string | false | null | undefined>,
) {
  const approved = rows.filter((a) => a.status === 'approved')

  return listDoc<Adjustment>({
    title: 'Stock adjustments',
    noun: 'adjustments',
    rows,
    total,
    filters,
    columns: [
      { header: 'No.', value: (a) => text(String(a.number ?? '')), width: '8%' },
      { header: 'Date', kind: 'date', value: (a) => day(a.adjusted_at), width: '12%' },
      { header: 'Warehouse', value: (a) => text(a.warehouse), width: '16%' },
      // The types on the sheet, which is what makes a page of them scannable.
      {
        header: 'Types',
        value: (a) => typesOf(a).map((t) => t.name).join(', ') || '—',
        width: '22%',
      },
      {
        header: 'Rows',
        kind: 'number',
        value: (a) => qty(rowsOf(a).length || a.rows_count),
        total: (a) => rowsOf(a).length || a.rows_count || 0,
        width: '8%',
      },
      {
        header: 'In',
        kind: 'number',
        // Kept apart from Out rather than netted: a day that added a thousand
        // and lost a thousand is not a day where nothing happened.
        value: (a) => qty(movement(a, 'in')),
        total: (a) => movement(a, 'in'),
        width: '10%',
      },
      {
        header: 'Out',
        kind: 'number',
        value: (a) => qty(movement(a, 'out')),
        total: (a) => movement(a, 'out'),
        width: '10%',
      },
      { header: 'Status', value: (a) => statusWord(a), width: '14%' },
    ],
    groups: [{ key: 'all', title: '', rows }],
    summary: [
      { label: 'Sheets', value: qty(rows.length) },
      { label: 'Approved', value: qty(approved.length) },
      { label: 'Awaiting approval', value: qty(rows.filter((a) => a.status === 'pending').length) },
      // Only the approved ones. A pending sheet has moved nothing, and folding
      // it into these would describe a shelf that does not exist.
      { label: 'Units in', value: qty(sum(approved, (a) => movement(a, 'in'))) },
      { label: 'Units out', value: qty(sum(approved, (a) => movement(a, 'out'))) },
    ],
    emptyMessage: 'No adjustments match these filters.',
  })
}

/** Base units moving one way on a sheet. Zero unless the sheet was approved. */
function movement(adjustment: Adjustment, direction: 'in' | 'out'): number {
  if (adjustment.status !== 'approved') return 0

  return rowsOf(adjustment)
    .filter((row) => row.direction === direction)
    .reduce((acc, row) => acc + (Number.isFinite(row.qty) ? row.qty : 0), 0)
}

function statusWord(adjustment: Adjustment): string {
  if (adjustment.status === 'approved') return 'Approved'
  if (adjustment.status === 'rejected') return 'Rejected'

  return 'Awaiting approval'
}
