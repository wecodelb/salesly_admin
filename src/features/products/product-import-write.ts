import type { DataValidation, Workbook, Worksheet } from 'exceljs'

import {
  BANDS,
  HEADER_ROW,
  HELP_SHEET,
  IMPORT_COLUMNS,
  LISTS_SHEET,
  SHEET_NAME,
  SPARE_ROWS,
  newWorkbook,
  type BandKey,
  type ColumnKey,
} from './product-import'
import type { AdminItem } from './types'

/**
 * Writing the product template: empty, or holding the catalogue so it can be
 * edited and imported back. The layout itself lives in product-import.ts.
 */

// ─── Writing ────────────────────────────────────────────────────────────────

type CellValue = string | number | null

/**
 * One product as a row of cells, in column order. The same layout the reader
 * expects, which is what lets a downloaded catalogue be imported straight back.
 *
 * At most two packagings fit. `dropped` counts any beyond that so the screen
 * can say so: a third packaging is not lost by downloading, but it would be by
 * importing the file back.
 */
export function productCells(item: AdminItem): { cells: CellValue[]; dropped: number } {
  const variants = item.uoms ?? []
  const base = variants.find((v) => v.is_base)
  const packs = variants.filter((v) => !v.is_base)
  const baseBarcodes = base ? base.barcodes ?? [] : variants.length ? [] : item.barcodes ?? []

  const value: Partial<Record<ColumnKey, CellValue>> = {
    code: item.code,
    name: item.name,
    name2: item.name2 || null,
    category: item.category || null,
    brand: item.brand || null,
    unit: item.uom || null,
    cost: item.cost,
    price_1: item.price_1,
    price_2: item.price_2,
    price_3: item.price_3,
    currency: item.currency?.code ?? null,
    weight: item.weight ?? 0,
    volume: item.volume ?? 0,
    barcodes: baseBarcodes.join(', ') || null,
  }
  packs.slice(0, 2).forEach((pack, i) => {
    const n = (i + 1) as 1 | 2
    value[`pack${n}_unit`] = pack.uom?.name ?? null
    value[`pack${n}_contains`] = pack.unit
    value[`pack${n}_price_1`] = pack.price_1
    value[`pack${n}_price_2`] = pack.price_2
    value[`pack${n}_price_3`] = pack.price_3
    value[`pack${n}_barcodes`] = (pack.barcodes ?? []).join(', ') || null
  })

  return {
    cells: IMPORT_COLUMNS.map((c) => value[c.key] ?? null),
    dropped: Math.max(0, packs.length - 2),
  }
}

export interface TemplateLists {
  units: string[]
  categories: string[]
  brands: string[]
  currencies: string[]
}

const FONT = 'Segoe UI'
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })
const thin = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }

/**
 * The template, empty or holding the catalogue.
 *
 * Laid out to be filled in by somebody who has never seen it. Coloured bands
 * group the columns, required headings carry a red star, and every heading
 * has a note saying what goes under it. The unit, category, brand and currency
 * columns offer the company's own names in a drop-down that still accepts a
 * new one. Number columns refuse text as it is typed, which catches a typo in
 * Excel rather than at import. Codes and barcodes are stored as text so that
 * Excel keeps leading zeros and does not turn a barcode into 5.449E+12.
 */
export async function writeImportWorkbook(
  products: AdminItem[],
  lists: TemplateLists,
): Promise<{ buffer: ArrayBuffer; dropped: number }> {
  const workbook = await newWorkbook()
  workbook.title = 'Salesly products'

  const ws = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: HEADER_ROW, showGridLines: true }],
    properties: { defaultRowHeight: 18 },
  })
  writeHelpSheet(workbook)
  const listRanges = writeListsSheet(workbook, lists)

  // Band titles across row 1
  let start = 1
  for (const band of Object.keys(BANDS) as BandKey[]) {
    const span = IMPORT_COLUMNS.filter((c) => c.band === band).length
    const end = start + span - 1
    ws.mergeCells(1, start, 1, end)
    const cell = ws.getCell(1, start)
    cell.value = BANDS[band].title
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = fill(BANDS[band].argb)
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    start = end + 1
  }
  ws.getRow(1).height = 22

  // Headings on row 2
  const header = ws.getRow(HEADER_ROW)
  header.height = 34
  IMPORT_COLUMNS.forEach((col, i) => {
    const cell = header.getCell(i + 1)
    cell.value = col.required
      ? { richText: [
          { text: col.header, font: { name: FONT, size: 10, bold: true, color: { argb: 'FF111827' } } },
          { text: ' *', font: { name: FONT, size: 10, bold: true, color: { argb: 'FFDC2626' } } },
        ] }
      : col.header
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF111827' } }
    cell.fill = fill(col.required ? 'FFFDE68A' : tint(BANDS[col.band].argb))
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { top: thin, bottom: { style: 'medium', color: { argb: BANDS[col.band].argb } }, left: thin, right: thin }
    cell.note = `${col.header}${col.required ? ' (required)' : ''}\n${col.help}\nExample: ${col.example || '—'}`

    const column = ws.getColumn(i + 1)
    column.width = col.width
    if (col.kind !== 'number') column.numFmt = '@'
  })
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: IMPORT_COLUMNS.length } }

  // The products, if any
  let dropped = 0
  products.forEach((item, r) => {
    const { cells, dropped: lost } = productCells(item)
    dropped += lost
    const row = ws.getRow(HEADER_ROW + 1 + r)
    cells.forEach((value, c) => {
      const cell = row.getCell(c + 1)
      cell.value = value
      cell.font = { name: FONT, size: 10 }
    })
  })

  // Drop-downs and number checks, over the products and the room below them
  //
  // One rule per column range rather than one per cell: thousands of rows
  // times twenty columns of per-cell rules makes a slow, bloated file. The
  // range API exists in exceljs but is missing from its type definitions.
  const last = HEADER_ROW + products.length + SPARE_ROWS
  const validations = (ws as Worksheet & {
    dataValidations: { add: (range: string, rule: DataValidation) => void }
  }).dataValidations
  IMPORT_COLUMNS.forEach((col, i) => {
    const letter = ws.getColumn(i + 1).letter
    const range = `${letter}${HEADER_ROW + 1}:${letter}${last}`
    const listKey: keyof TemplateLists | null =
      col.key === 'unit' || col.key.endsWith('_unit') ? 'units'
        : col.key === 'category' ? 'categories'
        : col.key === 'brand' ? 'brands'
        : col.key === 'currency' ? 'currencies'
        : null

    if (listKey && listRanges[listKey]) {
      // A suggestion, not a rule: a name the company lacks is created on
      // import, so the list must not refuse it. Currencies are the exception
      // and are checked on import instead.
      validations.add(range, {
        type: 'list',
        allowBlank: true,
        formulae: [listRanges[listKey]!],
        showErrorMessage: false,
      })
    } else if (col.kind === 'number') {
      const contains = col.key.endsWith('_contains')
      validations.add(range, {
        type: 'decimal',
        operator: contains ? 'greaterThan' : 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: col.header,
        error: contains ? 'Type how many base units are in one packaging, above 0.' : 'Type a number, 0 or more, with no currency sign.',
      })
    }
  })

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
  return { buffer, dropped }
}

/** A band colour, faded for the heading cells under it. */
function tint(argb: string): string {
  const hex = argb.slice(2)
  const mix = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.15 + 255 * 0.85)
    .toString(16).padStart(2, '0').toUpperCase()
  return `FF${mix(0)}${mix(2)}${mix(4)}`
}

function writeHelpSheet(workbook: Workbook): void {
  const ws = workbook.addWorksheet(HELP_SHEET, { views: [{ showGridLines: false }] })
  ws.getColumn(1).width = 26
  ws.getColumn(2).width = 11
  ws.getColumn(3).width = 90
  ws.getColumn(4).width = 18

  const title = ws.getCell('A1')
  title.value = 'How to fill the Products sheet'
  title.font = { name: FONT, size: 16, bold: true, color: { argb: 'FF0A3D8F' } }

  const rules = [
    'Fill the Products tab exactly as it is. Do not rename, delete or merge the headings in rows 1 and 2.',
    'One product per row, starting on row 3. Columns marked with a red * must be filled in.',
    'The Code is the key. A code you already have updates that product. A new code creates a new product.',
    'Products that are not in the file are left as they are. Nothing is ever deleted by an import.',
    'Categories, brands and units are typed by name. A name you do not have yet is created.',
    'Prices are for one unit: the base prices for one base unit, a packaging\'s prices for one whole packaging.',
    'Leave a packaging block empty if the product has no packaging. Emptying it removes that packaging.',
    'Stock is not imported. Set stock per warehouse from the product\'s "Set stock" action.',
    'If anything in the file is wrong, nothing is imported, and every problem is listed by row.',
  ]
  rules.forEach((text, i) => {
    const cell = ws.getCell(3 + i, 1)
    cell.value = `${i + 1}.  ${text}`
    cell.font = { name: FONT, size: 11, color: { argb: 'FF111827' } }
    ws.mergeCells(3 + i, 1, 3 + i, 4)
  })

  const top = 3 + rules.length + 1
  const head = ws.getRow(top)
  ;['Column', 'Required', 'What to write', 'Example'].forEach((text, i) => {
    const cell = head.getCell(i + 1)
    cell.value = text
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = fill('FF0A3D8F')
    cell.alignment = { vertical: 'middle', indent: 1 }
  })
  head.height = 22

  IMPORT_COLUMNS.forEach((col, i) => {
    const row = ws.getRow(top + 1 + i)
    row.getCell(1).value = col.header
    row.getCell(2).value = col.required ? 'Yes' : ''
    row.getCell(3).value = col.help
    row.getCell(4).value = col.example
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      cell.font = { name: FONT, size: 10, bold: c === 1, color: { argb: c === 2 ? 'FFDC2626' : 'FF111827' } }
      cell.alignment = { vertical: 'top', wrapText: c === 3, indent: 1 }
      if (i % 2 === 0) cell.fill = fill('FFF8FAFC')
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
    })
    row.getCell(1).fill = fill(tint(BANDS[col.band].argb))
  })
}

/**
 * The names the drop-downs offer, on a hidden tab. A list typed straight into
 * a validation is capped at 255 characters, which a real catalogue's
 * categories pass easily; a range has no such cap.
 */
function writeListsSheet(workbook: Workbook, lists: TemplateLists): Partial<Record<keyof TemplateLists, string>> {
  const ws = workbook.addWorksheet(LISTS_SHEET, { state: 'hidden' })
  const ranges: Partial<Record<keyof TemplateLists, string>> = {}
  ;(['units', 'categories', 'brands', 'currencies'] as const).forEach((key, i) => {
    const values = [...new Set(lists[key].map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    const column = ws.getColumn(i + 1)
    column.width = 24
    ws.getCell(1, i + 1).value = key
    values.forEach((v, r) => {
      ws.getCell(2 + r, i + 1).value = v
    })
    if (values.length) ranges[key] = `${LISTS_SHEET}!$${column.letter}$2:$${column.letter}$${values.length + 1}`
  })
  return ranges
}
