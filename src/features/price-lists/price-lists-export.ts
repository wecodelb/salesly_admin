import { listDoc } from '@/features/reports/list-doc'
import { qty, sum, text } from '@/features/reports/report-format'
import type { PriceList } from './types'

/** The price lists, as a printed page. */
export function priceListsExportDoc(rows: PriceList[], total: number) {
  return listDoc<PriceList>({
    title: 'Price lists',
    noun: 'price lists',
    rows,
    total,
    columns: [
      { header: 'Price list', value: (p) => text(p.name), width: '38%' },
      {
        header: 'Customers',
        kind: 'number',
        value: (p) => qty(p.customers?.length ?? 0),
        total: (p) => p.customers?.length ?? 0,
        width: '18%',
      },
      {
        header: 'Overrides',
        kind: 'number',
        value: (p) => qty(p.items_count),
        total: (p) => p.items_count ?? 0,
        width: '18%',
      },
      { header: 'Default', value: (p) => (p.is_default ? 'Default' : ''), width: '13%' },
      {
        header: 'Status',
        value: (p) => (p.is_active ? 'Active' : 'Inactive'),
        width: '13%',
      },
    ],
    summary: [
      { label: 'Price lists', value: qty(rows.length) },
      {
        label: 'Customers priced',
        value: qty(sum(rows, (p) => p.customers?.length ?? 0)),
      },
      { label: 'Overrides', value: qty(sum(rows, (p) => p.items_count)) },
    ],
    emptyMessage: 'No price lists yet.',
  })
}
