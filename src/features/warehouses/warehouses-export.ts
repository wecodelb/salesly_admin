import { listDoc, searchNote } from '@/features/reports/list-doc'
import { qty, text } from '@/features/reports/report-format'
import type { Warehouse } from './types'

/** The warehouses and vans, as a printed page. */
export function warehousesExportDoc(
  rows: Warehouse[],
  total: number,
  search: string,
  kindFilter: string,
) {
  return listDoc<Warehouse>({
    title: 'Warehouses',
    noun: 'warehouses',
    rows,
    total,
    filters: [
      searchNote(search),
      kindFilter && (kindFilter === 'depot' ? 'Depots only' : 'Warehouses only'),
    ],
    columns: [
      { header: 'Code', value: (w) => text(w.code), width: '12%' },
      { header: 'Name', value: (w) => text(w.name), width: '24%' },
      { header: 'Kind', value: (w) => (w.is_depot ? 'Depot' : 'Warehouse'), width: '13%' },
      // A depot is looked up by the man driving it far more often than by the
      // code nobody chose.
      { header: 'Salesman', value: (w) => text(w.salesman?.name), width: '18%' },
      { header: 'Area', value: (w) => text(w.area_name), width: '13%' },
      { header: 'Location', value: (w) => text(w.location), width: '13%' },
      { header: 'Main', value: (w) => (w.is_main ? 'Main' : ''), width: '7%' },
    ],
    summary: [
      { label: 'Warehouses', value: qty(rows.filter((w) => !w.is_depot).length) },
      { label: 'Depots', value: qty(rows.filter((w) => w.is_depot).length) },
      // A depot with nobody on it cannot be loaded, which is worth seeing.
      {
        label: 'Depots unmanned',
        value: qty(rows.filter((w) => w.is_depot && !w.salesman?.name).length),
      },
    ],
  })
}
