import { listDoc, searchNote } from '@/features/reports/list-doc'
import { qty, text } from '@/features/reports/report-format'
import type { Uom } from './types'

/** The units of measure, as a printed page. */
export function uomsExportDoc(rows: Uom[], total: number, search: string) {
  return listDoc<Uom>({
    title: 'Units of measure',
    noun: 'units',
    rows,
    total,
    filters: [searchNote(search)],
    columns: [
      { header: 'Code', value: (u) => text(u.code), width: '18%' },
      { header: 'Unit', value: (u) => text(u.name), width: '46%' },
      {
        header: 'Base unit of',
        kind: 'number',
        value: (u) => qty(u.items_count),
        width: '18%',
      },
      {
        header: 'Packagings',
        kind: 'number',
        value: (u) => qty(u.packagings_count),
        width: '18%',
      },
    ],
    summary: [
      { label: 'Units', value: qty(rows.length) },
      // A unit nothing uses is safe to delete; one in use is not. That is the
      // only question anybody prints this page to answer.
      {
        label: 'Unused',
        value: qty(rows.filter((u) => !u.items_count && !u.packagings_count).length),
      },
    ],
  })
}
