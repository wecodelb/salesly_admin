import { money, qty, scopeLine, sum, text } from '@/features/reports/report-format'
import type { ReportDocument, ReportGroup } from '@/features/reports/report-types'
import type { AdminItem } from './types'

/** How the printed catalog is broken up. Mirrors the screen's own filters. */
export type ProductGrouping = 'none' | 'category' | 'brand'

/**
 * The Products screen, as a printed page.
 *
 * Prints the catalog the way it is asked for out loud — by category, by brand,
 * or flat. Both prices go on the page: the office quotes in dollars and the van
 * collects in lira, and a catalog carrying only one of them gets rung up wrong.
 */
export function productsExportDoc(
  rows: AdminItem[],
  total: number,
  filters: Array<string | false | null | undefined>,
  grouping: ProductGrouping = 'none',
): ReportDocument<AdminItem> {
  return {
    title: 'Product catalog',
    subtitle: scopeLine(rows.length, total, 'products', [
      ...filters,
      grouping === 'category' ? 'By category' : grouping === 'brand' ? 'By brand' : null,
    ]),
    columns: [
      { header: 'Code', value: (p) => text(p.code), width: '11%' },
      { header: 'Product', value: (p) => text(p.name), width: '30%' },
      { header: 'Category', value: (p) => text(p.category), width: '14%' },
      { header: 'Brand', value: (p) => text(p.brand), width: '13%' },
      { header: 'Price (USD)', kind: 'money', value: (p) => money(p.price_usd), width: '11%' },
      {
        header: 'Price (LBP)',
        kind: 'number',
        // Lira are whole numbers in the hundreds of thousands; two decimals
        // here would be four characters of noise on every row.
        value: (p) => (p.price_lbp == null ? '—' : qty(Math.round(p.price_lbp))),
        width: '12%',
      },
      {
        header: 'Stock',
        kind: 'number',
        value: (p) => qty(p.available_qty),
        total: (p) => p.available_qty,
        width: '9%',
      },
    ],
    groups: groupProducts(rows, grouping),
    summary: [
      { label: 'Products', value: qty(rows.length) },
      { label: 'In stock', value: qty(rows.filter((p) => p.available_qty > 0).length) },
      { label: 'Out of stock', value: qty(rows.filter((p) => p.available_qty <= 0).length) },
      { label: 'Units on hand', value: qty(sum(rows, (p) => p.available_qty)) },
    ],
    emptyMessage: 'No products match these filters.',
  }
}

function groupProducts(
  rows: AdminItem[],
  grouping: ProductGrouping,
): ReportGroup<AdminItem>[] {
  if (grouping === 'none') return [{ key: 'all', title: '', rows }]

  const key = (p: AdminItem) => text(grouping === 'category' ? p.category : p.brand)
  const buckets = new Map<string, AdminItem[]>()
  for (const row of rows) {
    const k = key(row)
    const bucket = buckets.get(k)
    if (bucket) bucket.push(row)
    else buckets.set(k, [row])
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, group]) => ({
      key: title,
      title,
      caption: `${qty(group.length)} products · ${qty(sum(group, (p) => p.available_qty))} units`,
      rows: group,
    }))
}
