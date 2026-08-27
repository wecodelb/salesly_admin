import { listDoc } from '@/features/reports/list-doc'
import { day, money, qty, sum, text } from '@/features/reports/report-format'
import { describeMethod, tendersOf, type Collection } from './types'

/**
 * The Collections screen, as a printed page.
 *
 * This is the one people reconcile a day's cash against, so it carries both
 * ways money arrives — against a whole balance, and against one invoice — with
 * an Against column telling them apart. Printing only the first would have made
 * the total quietly short, and a total read as "all money received" when it is
 * not is worse than no total at all.
 */
export function collectionsExportDoc(
  rows: Collection[],
  total: number,
  filters: Array<string | false | null | undefined>,
) {
  const customers = new Set(rows.map((c) => c.customer_id).filter((id) => id != null))

  return listDoc<Collection>({
    title: 'Collections',
    noun: 'collections',
    rows,
    total,
    filters,
    columns: [
      { header: 'Receipt', value: (c) => text(c.trs_number), width: '11%' },
      { header: 'Date', kind: 'date', value: (c) => day(c.trs_date), width: '12%' },
      { header: 'Customer', value: (c) => text(c.customer), width: '20%' },
      { header: 'Salesman', value: (c) => text(c.salesman?.name), width: '14%' },
      // Spelled out rather than named: a 60/40 cash-and-whish receipt labelled
      // "cash" is a lie the row tells silently.
      { header: 'Method', value: (c) => describeMethod(c), width: '13%' },
      {
        header: 'Against',
        value: (c) => (c.source === 'invoice' ? 'One invoice' : 'Balance'),
        width: '11%',
      },
      {
        header: 'Collected',
        kind: 'money',
        value: (c) => money(c.amount),
        total: (c) => c.amount,
        width: '10%',
      },
      {
        header: 'Balance after',
        kind: 'money',
        // What the shop still owed when the salesman walked out, which is the
        // figure anybody chasing the round actually wants.
        value: (c) => money(c.balance_after),
        width: '9%',
      },
    ],
    groups: [{ key: 'all', title: '', rows }],
    summary: [
      { label: 'Receipts', value: qty(rows.length) },
      { label: 'Collected', value: money(sum(rows, (c) => c.amount)) },
      { label: 'Customers', value: qty(customers.size) },
      { label: 'Mixed tender', value: qty(rows.filter((c) => tendersOf(c).length > 1).length) },
      { label: 'Against invoice', value: qty(rows.filter((c) => c.source === 'invoice').length) },
    ],
    emptyMessage: 'No collections match these filters.',
  })
}
