import { listDoc, searchNote } from '@/features/reports/list-doc'
import { day, qty, sum, text } from '@/features/reports/report-format'
import { isPendingUnload, unloadPill, type DepotTransfer } from './types'

/**
 * What is coming back off the vans, as a printed page.
 *
 * Its own builder rather than a third `kind` on depotExportDoc: the two
 * columns that matter here are the depot it is leaving and whether anybody has
 * answered yet, and the summary is about stock that is frozen — neither of
 * which the loading page has any use for.
 */
export function unloadsExportDoc(
  rows: DepotTransfer[],
  total: number,
  search: string,
  statusLabel: string | false,
) {
  const waiting = rows.filter(isPendingUnload)

  return listDoc<DepotTransfer>({
    title: 'Unloads',
    noun: 'unloads',
    rows,
    total,
    filters: [searchNote(search), statusLabel],
    columns: [
      { header: 'Unload', value: (t) => text(t.trs_number), width: '15%' },
      // trs_date arrives as `d/m/Y H:i`, which is exactly what day() reads —
      // passing it through rather than reparsing keeps one reading of the date.
      { header: 'Date', kind: 'date', value: (t) => day(t.trs_date), width: '14%' },
      { header: 'Salesman', value: (t) => text(t.salesman?.name), width: '20%' },
      { header: 'From', value: (t) => text(t.source?.name), width: '20%' },
      {
        header: 'Units',
        kind: 'number',
        value: (t) => qty(t.total_qty),
        total: (t) => t.total_qty,
        width: '11%',
      },
      { header: 'Status', value: (t) => unloadPill(t).label, width: '20%' },
    ],
    summary: [
      { label: 'Unloads', value: qty(rows.length) },
      { label: 'Units', value: qty(sum(rows, (t) => t.total_qty)) },
      // The figure this page is printed to answer: stock nobody can sell and
      // the warehouse has not got either, sitting on vans until somebody here
      // says yes.
      { label: 'Held on vans', value: qty(sum(waiting, (t) => t.total_qty)) },
    ],
  })
}
