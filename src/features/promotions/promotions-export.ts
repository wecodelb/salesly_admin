import { listDoc } from '@/features/reports/list-doc'
import { day, money, qty, text } from '@/features/reports/report-format'
import type { Promotion } from './types'

/** The promotions, as a printed page. */
export function promotionsExportDoc(rows: Promotion[], total: number) {
  return listDoc<Promotion>({
    title: 'Promotions',
    noun: 'promotions',
    rows,
    total,
    columns: [
      { header: 'Promotion', value: (p) => text(p.name), width: '26%' },
      // What it applies to, which is the first thing anybody checks.
      { header: 'Applies to', value: (p) => text(p.item ?? p.category), width: '24%' },
      {
        header: 'Discount',
        kind: 'money',
        value: (p) => (p.type === 'percent' ? `${qty(p.value)}%` : money(p.value)),
        width: '13%',
      },
      { header: 'From', kind: 'date', value: (p) => day(p.starts_at), width: '13%' },
      { header: 'To', kind: 'date', value: (p) => day(p.ends_at), width: '13%' },
      {
        header: 'Status',
        value: (p) => (p.is_active ? 'Active' : 'Inactive'),
        width: '11%',
      },
    ],
    summary: [
      { label: 'Promotions', value: qty(rows.length) },
      { label: 'Active', value: qty(rows.filter((p) => p.is_active).length) },
    ],
    emptyMessage: 'No promotions yet.',
  })
}
