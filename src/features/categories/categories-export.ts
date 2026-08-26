import { listDoc, searchNote } from '@/features/reports/list-doc'
import { qty, sum, text } from '@/features/reports/report-format'
import type { Category } from './types'

/** The category list, as a printed page. */
export function categoriesExportDoc(rows: Category[], total: number, search: string) {
  return listDoc<Category>({
    title: 'Categories',
    noun: 'categories',
    rows,
    total,
    filters: [searchNote(search)],
    columns: [
      { header: 'Code', value: (c) => text(c.code), width: '18%' },
      { header: 'Category', value: (c) => text(c.name), width: '57%' },
      {
        header: 'Products',
        kind: 'number',
        value: (c) => qty(c.items_count),
        total: (c) => c.items_count ?? 0,
        width: '25%',
      },
    ],
    summary: [
      { label: 'Categories', value: qty(rows.length) },
      { label: 'Products', value: qty(sum(rows, (c) => c.items_count)) },
      { label: 'Empty', value: qty(rows.filter((c) => !c.items_count).length) },
    ],
  })
}
