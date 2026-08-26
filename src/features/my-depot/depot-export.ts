import { listDoc, searchNote } from '@/features/reports/list-doc'
import { day, qty, sum, text } from '@/features/reports/report-format'
import { transferPill, type DepotTransfer } from './types'

/**
 * The depot paperwork, as a printed page.
 *
 * Load requests and load issues are one document read from two ends, so they
 * share a builder and differ only in which warehouse is worth a column — where
 * the load was asked from, or where it went.
 */
export function depotExportDoc(
  rows: DepotTransfer[],
  total: number,
  search: string,
  statusLabel: string | false,
  kind: 'requests' | 'issues',
) {
  const requests = kind === 'requests'

  return listDoc<DepotTransfer>({
    title: requests ? 'Load requests' : 'Load issues',
    noun: requests ? 'requests' : 'loads',
    rows,
    total,
    filters: [searchNote(search), statusLabel],
    columns: [
      {
        header: requests ? 'Request' : 'Load',
        value: (t) => text(t.trs_number),
        width: '15%',
      },
      // trs_date arrives as `d/m/Y H:i`, which is exactly what day() reads —
      // passing it through rather than reparsing keeps one reading of the date.
      { header: 'Date', kind: 'date', value: (t) => day(t.trs_date), width: '14%' },
      { header: 'Salesman', value: (t) => text(t.salesman?.name), width: '20%' },
      {
        header: requests ? 'From' : 'To',
        value: (t) => text(requests ? t.source?.name : t.destination?.name),
        width: '20%',
      },
      {
        header: 'Units',
        kind: 'number',
        value: (t) => qty(t.total_qty),
        total: (t) => t.total_qty,
        width: '11%',
      },
      // The screen's own three words — requested, load issued, received — so
      // the page, the console and the phone say the same thing about the same
      // document.
      { header: 'Status', value: (t) => transferPill(t).label, width: '20%' },
    ],
    summary: [
      { label: requests ? 'Requests' : 'Loads', value: qty(rows.length) },
      { label: 'Units', value: qty(sum(rows, (t) => t.total_qty)) },
    ],
  })
}
