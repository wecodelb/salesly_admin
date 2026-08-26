import { money, qty, scopeLine, sum, text } from '@/features/reports/report-format'
import type { ReportDocument } from '@/features/reports/report-types'
import type { AdminCustomer } from './types'

/** Whether credit checking applies at all, and whether it has been breached. */
function overLimit(c: AdminCustomer): boolean {
  return c.credit_limit != null && c.credit_limit > 0 && c.balance > c.credit_limit
}

/**
 * The Customers screen, as a printed page.
 *
 * Built from the rows the table is currently showing rather than from the full
 * list, so the PDF and the screen can never disagree about which customers are
 * in it. The filters that produced them are printed under the title, because a
 * page found in a folder six months later has to explain why it holds forty
 * customers rather than four hundred.
 */
export function customersExportDoc(
  rows: AdminCustomer[],
  total: number,
  filters: Array<string | false | null | undefined>,
): ReportDocument<AdminCustomer> {
  return {
    title: 'Customers',
    subtitle: scopeLine(rows.length, total, 'customers', filters),
    columns: [
      { header: 'Code', value: (c) => text(c.code), width: '9%' },
      { header: 'Customer', value: (c) => text(c.name), width: '22%' },
      { header: 'Salesman', value: (c) => text(c.salesman_name), width: '14%' },
      { header: 'Group', value: (c) => text(c.customer_group_name), width: '12%' },
      { header: 'Phone', value: (c) => text(c.phone1 || c.phone2), width: '13%' },
      {
        header: 'Balance',
        kind: 'money',
        value: (c) => money(c.balance),
        total: (c) => c.balance,
        width: '11%',
      },
      {
        header: 'Credit limit',
        kind: 'money',
        // No limit and a limit of zero are different facts, and only one of
        // them means "this customer is not credit-checked".
        value: (c) => (c.credit_limit == null ? '—' : money(c.credit_limit)),
        width: '11%',
      },
      {
        header: 'Standing',
        value: (c) =>
          !c.is_active
            ? 'Inactive'
            : overLimit(c)
              ? 'Over limit'
              : c.balance > 0
                ? 'Owing'
                : 'Clear',
        width: '8%',
      },
    ],
    groups: [{ key: 'all', title: '', rows }],
    summary: [
      { label: 'Customers', value: qty(rows.length) },
      { label: 'Owing', value: qty(rows.filter((c) => c.balance > 0).length) },
      { label: 'Total owed', value: money(sum(rows, (c) => c.balance)) },
      { label: 'Over limit', value: qty(rows.filter(overLimit).length) },
    ],
    emptyMessage: 'No customers match these filters.',
  }
}
