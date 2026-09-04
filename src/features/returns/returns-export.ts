import { listDoc, searchNote } from '@/features/reports/list-doc'
import { day, qty, sum, text } from '@/features/reports/report-format'
import { owesRefund, returnPill, type SalesReturn } from './types'

/**
 * What came back off the vans, as a printed page.
 *
 * The summary keeps the value of the goods apart from what was actually
 * credited. Netting them would hide the only figure on this page worth
 * printing it for: money still owed back to shops that handed goods in after
 * they had already paid.
 */
export function returnsExportDoc(
  rows: SalesReturn[],
  total: number,
  search: string,
  statusLabel: string | false,
) {
  const owing = rows.filter(owesRefund)

  return listDoc<SalesReturn>({
    title: 'Sales returns',
    noun: 'returns',
    rows,
    total,
    filters: [searchNote(search), statusLabel],
    columns: [
      { header: 'Return', value: (r) => text(`#${r.trs_number}`), width: '12%' },
      // trs_date arrives as `d/m/Y H:i`, which is exactly what day() reads —
      // passing it through rather than reparsing keeps one reading of the date.
      { header: 'Date', kind: 'date', value: (r) => day(r.trs_date), width: '13%' },
      { header: 'Customer', value: (r) => text(r.customer?.name), width: '22%' },
      { header: 'Salesman', value: (r) => text(r.salesman?.name), width: '16%' },
      {
        header: 'Units',
        kind: 'number',
        value: (r) => qty(r.total_qty),
        total: (r) => r.total_qty,
        width: '10%',
      },
      {
        header: 'Credited',
        kind: 'number',
        value: (r) => qty(r.credit_applied),
        total: (r) => r.credit_applied,
        width: '13%',
      },
      {
        header: 'Refund owing',
        kind: 'number',
        value: (r) => (owesRefund(r) ? qty(r.credit_excess) : '—'),
        total: (r) => r.credit_excess,
        width: '14%',
      },
    ],
    summary: [
      { label: 'Returns', value: qty(rows.length) },
      { label: 'Units back', value: qty(sum(rows, (r) => r.total_qty)) },
      { label: 'Goods worth', value: qty(sum(rows, (r) => r.credit_value)) },
      { label: 'Credited', value: qty(sum(rows, (r) => r.credit_applied)) },
      // The figure the page exists to surface. Kept last so it reads as the
      // conclusion rather than as one number among six.
      { label: 'Refunds owing', value: qty(sum(owing, (r) => r.credit_excess)) },
    ],
  })
}

/** Kept beside the builder so the page and the print agree on the wording. */
export const returnStatusLabel = (document: SalesReturn) => returnPill(document).label
