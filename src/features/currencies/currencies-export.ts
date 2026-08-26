import { listDoc } from '@/features/reports/list-doc'
import { qty, text } from '@/features/reports/report-format'
import type { Currency } from '@/features/products/types'

/**
 * The currency catalog, as a printed page.
 *
 * The base currency is marked rather than sorted to the top: every rate in the
 * system is quoted against it, and a page that does not say which one it is
 * cannot be checked against anything.
 */
export function currenciesExportDoc(rows: Currency[], total: number) {
  return listDoc<Currency>({
    title: 'Currencies',
    noun: 'currencies',
    rows,
    total,
    columns: [
      { header: 'Code', value: (c) => text(c.code), width: '13%' },
      { header: 'Currency', value: (c) => text(c.name), width: '30%' },
      { header: 'Symbol', value: (c) => text(c.symbol), width: '12%' },
      { header: 'Renders as', value: renders, width: '17%' },
      { header: 'Base', value: (c) => (c.is_base ? 'Base' : ''), width: '13%' },
      {
        header: 'Status',
        value: (c) => (c.is_active ? 'Active' : 'Inactive'),
        width: '15%',
      },
    ],
    summary: [
      { label: 'Currencies', value: qty(rows.length) },
      { label: 'Active', value: qty(rows.filter((c) => c.is_active).length) },
      { label: 'Base', value: text(rows.find((c) => c.is_base)?.code) },
    ],
    emptyMessage: 'No currencies yet.',
  })
}

/** One unit written the way this currency renders it, symbol side and all. */
function renders(c: Currency): string {
  const decimals = c.decimal_places > 0 ? `.${'0'.repeat(c.decimal_places)}` : ''
  const amount = `1${decimals}`

  return c.symbol_position === 'before'
    ? `${c.symbol ?? ''}${amount}`
    : `${amount}${c.symbol ?? ''}`
}
