import type { Workbook } from 'exceljs'

/**
 * The product spreadsheet: the template the office downloads, fills in and
 * loads back from the Products screen.
 *
 * One layout serves three jobs, and that is the point of it. The empty
 * template, the catalogue downloaded "with my products" and the file read back
 * on import all have the same columns under the same headings. Whatever the
 * console writes, it can read again: export, change three prices, import, and
 * only those three products change.
 *
 * Columns are found by their heading, not their position. A column dragged
 * somewhere else still reads correctly. A required heading that has gone
 * missing (renamed or deleted) stops the import before anything is sent,
 * because a sheet that has lost its Cost column would otherwise import every
 * product at no cost.
 *
 * The workbook is read here, in the browser, with the same library the report
 * exports already use. The server is sent plain rows and checks them like any
 * other form.
 */

// ─── The layout ─────────────────────────────────────────────────────────────

export type ColumnKey =
  | 'code' | 'name' | 'name2' | 'category' | 'brand'
  | 'unit' | 'cost' | 'price_1' | 'price_2' | 'price_3' | 'currency' | 'weight' | 'volume' | 'barcodes'
  | `pack${1 | 2}_${'unit' | 'contains' | 'price_1' | 'price_2' | 'price_3' | 'barcodes'}`

type Kind = 'text' | 'number' | 'barcodes'

export interface ImportColumn {
  key: ColumnKey
  header: string
  band: BandKey
  kind: Kind
  required?: boolean
  /** In characters, the unit Excel measures widths in. */
  width: number
  /** Shown as a note on the heading cell, and on the "How to fill" sheet. */
  help: string
  example: string
}

export type BandKey = 'product' | 'base' | 'pack1' | 'pack2'

export const BANDS: Record<BandKey, { title: string; argb: string }> = {
  product: { title: 'PRODUCT', argb: 'FF0A3D8F' },
  base: { title: 'BASE UNIT & PRICES', argb: 'FF0D9488' },
  pack1: { title: 'PACKAGING 1 (optional)', argb: 'FF7C3AED' },
  pack2: { title: 'PACKAGING 2 (optional)', argb: 'FFB45309' },
}

const packColumns = (n: 1 | 2): ImportColumn[] => [
  {
    key: `pack${n}_unit`, header: `Pack ${n} unit`, band: `pack${n}`, kind: 'text', width: 13,
    help: 'The unit this packaging is sold in, such as Box or Carton. Must differ from the base unit. Leave the whole block empty if the product has no packaging.',
    example: n === 1 ? 'Box' : 'Carton',
  },
  {
    key: `pack${n}_contains`, header: `Pack ${n} contains`, band: `pack${n}`, kind: 'number', width: 13,
    help: 'How many base units are in one of this packaging. A box of 24 pieces is 24.',
    example: n === 1 ? '24' : '96',
  },
  {
    key: `pack${n}_price_1`, header: `Pack ${n} retail price`, band: `pack${n}`, kind: 'number', width: 15,
    help: 'The retail price of one whole packaging, not of one piece.',
    example: n === 1 ? '17' : '66',
  },
  {
    key: `pack${n}_price_2`, header: `Pack ${n} wholesale price`, band: `pack${n}`, kind: 'number', width: 16,
    help: 'The wholesale price of one whole packaging. Blank means 0.',
    example: n === 1 ? '16' : '62',
  },
  {
    key: `pack${n}_price_3`, header: `Pack ${n} distribution price`, band: `pack${n}`, kind: 'number', width: 17,
    help: 'The distribution price of one whole packaging. Blank means 0.',
    example: n === 1 ? '15' : '58',
  },
  {
    key: `pack${n}_barcodes`, header: `Pack ${n} barcodes`, band: `pack${n}`, kind: 'barcodes', width: 18,
    help: 'The barcode printed on the packaging. Several are separated by commas.',
    example: n === 1 ? '5449000001009' : '',
  },
]

export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: 'code', header: 'Code', band: 'product', kind: 'text', required: true, width: 14,
    help: 'The product code. It is the key: a code you already have updates that product, a new code creates one. Each code goes on one row only.',
    example: 'COLA-330',
  },
  {
    key: 'name', header: 'Name', band: 'product', kind: 'text', required: true, width: 30,
    help: 'The product name as the salesmen and customers see it.',
    example: 'Cola 330ml can',
  },
  {
    key: 'name2', header: 'Second name', band: 'product', kind: 'text', width: 22,
    help: 'Optional. The name in a second language, such as Arabic.',
    example: 'كولا ٣٣٠ مل',
  },
  {
    key: 'category', header: 'Category', band: 'product', kind: 'text', width: 16,
    help: 'Optional. Typed by name. A category you do not have yet is created.',
    example: 'Drinks',
  },
  {
    key: 'brand', header: 'Brand', band: 'product', kind: 'text', width: 14,
    help: 'Optional. Typed by name. A brand you do not have yet is created.',
    example: 'Fizzy',
  },
  {
    key: 'unit', header: 'Base unit', band: 'base', kind: 'text', required: true, width: 12,
    help: 'The smallest unit the product is counted in, such as Piece. Prices, stock and every document are counted in it. A new unit is created.',
    example: 'Piece',
  },
  {
    key: 'cost', header: 'Cost', band: 'base', kind: 'number', required: true, width: 10,
    help: 'What one base unit costs you.',
    example: '0.40',
  },
  {
    key: 'price_1', header: 'Retail price', band: 'base', kind: 'number', required: true, width: 12,
    help: 'The retail price of one base unit.',
    example: '0.75',
  },
  {
    key: 'price_2', header: 'Wholesale price', band: 'base', kind: 'number', width: 14,
    help: 'Optional. The wholesale price of one base unit. Blank means 0.',
    example: '0.70',
  },
  {
    key: 'price_3', header: 'Distribution price', band: 'base', kind: 'number', width: 15,
    help: 'Optional. The distribution price of one base unit. Blank means 0.',
    example: '0.65',
  },
  {
    key: 'currency', header: 'Currency', band: 'base', kind: 'text', width: 10,
    help: 'Optional. The code of a currency you have set up, such as USD. Blank uses the company currency.',
    example: 'USD',
  },
  {
    key: 'weight', header: 'Weight', band: 'base', kind: 'number', width: 9,
    help: 'Optional. The weight of one base unit, for planning loads.',
    example: '0.35',
  },
  {
    key: 'volume', header: 'Volume', band: 'base', kind: 'number', width: 9,
    help: 'Optional. The volume of one base unit, for planning loads.',
    example: '0.33',
  },
  {
    key: 'barcodes', header: 'Barcodes', band: 'base', kind: 'barcodes', width: 18,
    help: 'Optional. The barcode on one base unit. Several are separated by commas. A barcode can belong to one product only.',
    example: '5449000000996',
  },
  ...packColumns(1),
  ...packColumns(2),
]

/** The tab the products go on. Read back by this name, or the first tab if it was renamed. */
export const SHEET_NAME = 'Products'
export const HELP_SHEET = 'How to fill'
export const LISTS_SHEET = 'Lists'
/** The band titles sit on row 1, the headings on row 2, products from row 3. */
export const HEADER_ROW = 2
/** Room the drop-downs and number checks are laid over, past the last product. */
export const SPARE_ROWS = 1000

// ─── What a row becomes ─────────────────────────────────────────────────────

export interface ImportPackaging {
  /** Which block of columns it came from. The server ignores it; it is kept
   *  so an error on the second packaging sent can still name the right block
   *  when the first one was left empty. */
  slot: 1 | 2
  unit: string | null
  contains: number | string | null
  price_1: number | string | null
  price_2: number | string | null
  price_3: number | string | null
  barcodes: string[]
}

/** One product, as posted to /items/import. */
export interface ImportRow {
  /** Where it sits in the workbook, so an error can say "row 14". */
  row: number
  code: string | null
  name: string | null
  name2: string | null
  category: string | null
  brand: string | null
  unit: string | null
  cost: number | string | null
  price_1: number | string | null
  price_2: number | string | null
  price_3: number | string | null
  currency: string | null
  weight: number | string | null
  volume: number | string | null
  barcodes: string[]
  packagings: ImportPackaging[]
}

/** Not the template, or nothing in it. Said before anything is sent. */
export class ImportFileError extends Error {}

/** A fresh workbook, with exceljs loaded on first use rather than with every screen. */
export async function newWorkbook(): Promise<Workbook> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Salesly'
  workbook.created = new Date()
  return workbook
}

export function importFileName(withProducts: boolean, at = new Date()): string {
  const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
  return withProducts ? `Salesly products ${day}.xlsx` : 'Salesly products template.xlsx'
}
