import { listDoc, searchNote } from '@/features/reports/list-doc'
import { qty, sum, text } from '@/features/reports/report-format'
import type { CustomerGroup } from './types'

/** The customer groups, as a printed page. */
export function customerGroupsExportDoc(
  rows: CustomerGroup[],
  total: number,
  search: string,
) {
  return listDoc<CustomerGroup>({
    title: 'Customer groups',
    noun: 'groups',
    rows,
    total,
    filters: [searchNote(search)],
    columns: [
      // Printed in the company's own order rather than alphabetically — the
      // sort order is the vocabulary, and re-sorting it loses the meaning.
      { header: 'Order', kind: 'number', value: (g) => qty(g.sort_order), width: '14%' },
      { header: 'Group', value: (g) => text(g.name), width: '58%' },
      {
        header: 'Customers',
        kind: 'number',
        value: (g) => qty(g.customers_count),
        total: (g) => g.customers_count,
        width: '28%',
      },
    ],
    summary: [
      { label: 'Groups', value: qty(rows.length) },
      { label: 'Customers classified', value: qty(sum(rows, (g) => g.customers_count)) },
    ],
  })
}
