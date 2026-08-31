import { listDoc, searchNote } from '@/features/reports/list-doc'
import { qty, text } from '@/features/reports/report-format'
import type { AdjustmentType } from './types'
import { directionWord } from './types'

/** The kinds of adjustment this company recognises, as a printed page. */
export function adjustmentTypesExportDoc(
  rows: AdjustmentType[],
  total: number,
  search: string,
  activity: string,
) {
  return listDoc<AdjustmentType>({
    title: 'Adjustment types',
    noun: 'types',
    rows,
    total,
    filters: [
      searchNote(search),
      activity === 'active' ? 'In use only' : activity === 'inactive' ? 'Switched off only' : '',
    ],
    columns: [
      { header: 'Code', value: (t) => text(t.code), width: '16%' },
      { header: 'Type', value: (t) => text(t.name), width: '30%' },
      // The business rule, and the reason this page is worth printing: which
      // way stock is allowed to move under each heading.
      { header: 'Direction', value: (t) => directionWord(t.direction), width: '16%' },
      { header: 'Status', value: (t) => (t.is_active ? 'In use' : 'Switched off'), width: '16%' },
      { header: 'Sheets', kind: 'number', value: (t) => qty(t.rows_count), width: '10%' },
      { header: 'Origin', value: (t) => (t.is_system ? 'Standard' : 'Yours'), width: '12%' },
    ],
    summary: [
      { label: 'Types', value: qty(rows.length) },
      { label: 'In use', value: qty(rows.filter((t) => t.is_active).length) },
      // A type nothing has been written under can still be deleted; one with
      // history can only be switched off. That is the question this page
      // answers for somebody tidying the list.
      { label: 'Never used', value: qty(rows.filter((t) => !t.rows_count).length) },
    ],
  })
}
