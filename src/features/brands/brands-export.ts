import { listDoc, searchNote } from '@/features/reports/list-doc'
import { qty, sum, text } from '@/features/reports/report-format'
import type { Brand } from './types'

/** The brand list, as a printed page. */
export function brandsExportDoc(rows: Brand[], total: number, search: string) {
  return listDoc<Brand>({
    title: 'Brands',
    noun: 'brands',
    rows,
    total,
    filters: [searchNote(search)],
    columns: [
      { header: 'Code', value: (b) => text(b.code), width: '18%' },
      { header: 'Brand', value: (b) => text(b.name), width: '57%' },
      {
        header: 'Products',
        kind: 'number',
        value: (b) => qty(b.items_count),
        total: (b) => b.items_count ?? 0,
        width: '25%',
      },
    ],
    summary: [
      { label: 'Brands', value: qty(rows.length) },
      { label: 'Products', value: qty(sum(rows, (b) => b.items_count)) },
      { label: 'Empty', value: qty(rows.filter((b) => !b.items_count).length) },
    ],
  })
}
