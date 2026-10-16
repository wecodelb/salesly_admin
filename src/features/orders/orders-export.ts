import { money, qty, scopeLine, sum, text } from '@/features/reports/report-format'
import type { ReportDocument } from '@/features/reports/report-types'
import { formatDay, orderPill } from './orders-logic'
import type { Order } from './types'

/**
 * The Orders screen, as a printed page: what was taken, for whom, when it is
 * due and in what state — with the value totalled and what still waits for a
 * decision counted, which is what the morning meeting reads it for.
 */
export function ordersExportDoc(
  rows: Order[],
  total: number,
  filters: Array<string | false | null | undefined>,
): ReportDocument<Order> {
  return {
    title: 'Orders',
    subtitle: scopeLine(rows.length, total, 'orders', filters),
    columns: [
      { header: 'Order', value: (o) => text(`#${o.trs_number}`), width: '9%' },
      { header: 'Taken', value: (o) => text(o.trs_date), width: '14%' },
      { header: 'Customer', value: (o) => text(o.customer.name), width: '22%' },
      { header: 'Salesman', value: (o) => text(o.salesman.name), width: '14%' },
      { header: 'Delivery', value: (o) => formatDay(o.delivery_date), width: '11%' },
      { header: 'Status', value: (o) => orderPill(o.status).label, width: '16%' },
      {
        header: 'Total',
        kind: 'money',
        value: (o) => money(o.total_price),
        total: (o) => o.total_price,
        width: '14%',
      },
    ],
    groups: [{ key: 'all', title: '', rows }],
    summary: [
      { label: 'Orders', value: qty(rows.length) },
      { label: 'Value', value: money(sum(rows, (o) => o.total_price)) },
      { label: 'Waiting for approval', value: qty(rows.filter((o) => o.status === 'SUBMITTED').length) },
      { label: 'Approved', value: qty(rows.filter((o) => o.status === 'APPROVED' || o.status === 'DRAFT').length) },
    ],
    emptyMessage: 'No orders match these filters.',
  }
}
