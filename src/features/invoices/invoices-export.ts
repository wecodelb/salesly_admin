import { day, money, qty, scopeLine, sum, text } from '@/features/reports/report-format'
import type { ReportDocument } from '@/features/reports/report-types'
import type { Invoice } from './types'

/**
 * The Invoices screen, as a printed page.
 *
 * The one report people reconcile against, so it prints what was billed, what
 * came back, and the difference — with the difference totalled in the footer.
 * Anything less and the page has to be added up by hand, which is how a
 * printed figure ends up disagreeing with the screen it came from.
 */
export function invoicesExportDoc(
  rows: Invoice[],
  total: number,
  filters: Array<string | false | null | undefined>,
): ReportDocument<Invoice> {
  const owed = sum(rows, (i) => i.due_amount)

  return {
    title: 'Invoices',
    subtitle: scopeLine(rows.length, total, 'invoices', filters),
    columns: [
      { header: 'Invoice', value: (i) => text(i.trs_number), width: '12%' },
      { header: 'Date', kind: 'date', value: (i) => day(i.trs_date), width: '12%' },
      { header: 'Customer', value: (i) => text(i.customer), width: '21%' },
      { header: 'Salesman', value: (i) => text(i.salesman?.name), width: '14%' },
      {
        header: 'Units',
        kind: 'number',
        value: (i) => qty(i.total_qty),
        total: (i) => i.total_qty,
        width: '8%',
      },
      {
        header: 'Billed',
        kind: 'money',
        value: (i) => money(i.total_price),
        total: (i) => i.total_price,
        width: '11%',
      },
      {
        header: 'Collected',
        kind: 'money',
        value: (i) => money(i.paid_amount),
        total: (i) => i.paid_amount,
        width: '11%',
      },
      {
        header: 'Still owed',
        kind: 'money',
        // Server-computed, never derived here: the console and the phone must
        // not be able to disagree about what a customer owes.
        value: (i) => money(i.due_amount),
        total: (i) => i.due_amount,
        width: '11%',
      },
    ],
    groups: [{ key: 'all', title: '', rows }],
    summary: [
      { label: 'Invoices', value: qty(rows.length) },
      { label: 'Billed', value: money(sum(rows, (i) => i.total_price)) },
      { label: 'Collected', value: money(sum(rows, (i) => i.paid_amount)) },
      { label: 'Still owed', value: money(owed) },
      { label: 'Unsettled', value: qty(rows.filter((i) => i.due_amount > 0).length) },
    ],
    emptyMessage: 'No invoices match these filters.',
  }
}
