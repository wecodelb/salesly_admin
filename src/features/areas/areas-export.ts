import { listDoc, searchNote } from '@/features/reports/list-doc'
import { qty, sum, text } from '@/features/reports/report-format'
import type { Area } from './types'

/** The delivery areas, as a printed page. */
export function areasExportDoc(rows: Area[], total: number, search: string) {
  return listDoc<Area>({
    title: 'Areas',
    noun: 'areas',
    rows,
    total,
    filters: [searchNote(search)],
    columns: [
      { header: 'Code', value: (a) => text(a.code), width: '18%' },
      { header: 'Area', value: (a) => text(a.name), width: '57%' },
      {
        header: 'Customers',
        kind: 'number',
        value: (a) => qty(a.customers_count),
        total: (a) => a.customers_count,
        width: '25%',
      },
    ],
    summary: [
      { label: 'Areas', value: qty(rows.length) },
      { label: 'Customers covered', value: qty(sum(rows, (a) => a.customers_count)) },
      // An area nobody delivers to is worth seeing on the page: it is either a
      // gap in the round or a row that should be deleted.
      { label: 'Empty areas', value: qty(rows.filter((a) => !a.customers_count).length) },
    ],
  })
}
