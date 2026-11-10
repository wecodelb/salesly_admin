import type { Worksheet } from 'exceljs'

import {
  HEADER_ROW,
  IMPORT_COLUMNS,
  ImportFileError,
  SHEET_NAME,
  newWorkbook,
  type ColumnKey,
  type ImportPackaging,
  type ImportRow,
} from './product-import'

/**
 * Reading a filled-in product template back into rows, and putting the
 * server's answer against the rows of the workbook.
 */

// ─── Reading ────────────────────────────────────────────────────────────────

/** A heading as it is compared: case, spacing and the required star ignored. */
const headingKey = (text: string) => text.replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Whatever exceljs hands back for a cell, as plain text or a number. */
function plain(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim()
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: unknown; error?: string }
    if (v.richText) return plain(v.richText.map((part) => part.text).join(''))
    if ('result' in v) return plain(v.result)
    if ('text' in v) return plain(v.text)
    if (v.error) return v.error
  }
  return String(value)
}

function asText(value: string | number | null): string | null {
  if (value === null) return null
  // A code or barcode Excel stored as a number. Whole numbers are written out
  // in full; String() alone would give 5.449e+12 for a long one.
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('en-US', { useGrouping: false }) : String(value)
  return value
}

/**
 * A figure, if the cell holds one. Anything else is sent as typed, so the
 * server answers "The Cost must be a number" against the right row instead of
 * this quietly sending 0.
 */
function asNumber(value: string | number | null): number | string | null {
  if (value === null || typeof value === 'number') return value
  const cleaned = value.replace(/[\s,$]/g, '')
  return cleaned !== '' && Number.isFinite(Number(cleaned)) ? Number(cleaned) : value
}

function asBarcodes(value: string | number | null): string[] {
  const text = asText(value)
  if (!text) return []
  return [...new Set(text.split(/[,;\n\s]+/).map((b) => b.trim()).filter(Boolean))]
}

/**
 * The rows of a filled-in template.
 *
 * Throws `ImportFileError` when the file is not the template (a required
 * heading is missing) or has no products in it. Wholly empty rows are skipped,
 * so a sheet with gaps between its products reads as if it had none.
 */
export async function readImportWorkbook(data: ArrayBuffer): Promise<ImportRow[]> {
  const workbook = await newWorkbook()
  try {
    await workbook.xlsx.load(data)
  } catch {
    throw new ImportFileError('This file could not be opened as an Excel workbook. Save it as .xlsx and try again.')
  }

  const ws = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets.find((s) => s.state === 'visible')
  if (!ws) throw new ImportFileError('This workbook has no sheets in it.')

  const { headerRow, columns } = locateHeadings(ws)

  const rows: ImportRow[] = []
  ws.eachRow({ includeEmpty: false }, (row, number) => {
    if (number <= headerRow) return
    const cell = (key: ColumnKey) => {
      const at = columns.get(key)
      return at ? plain(row.getCell(at).value) : null
    }
    if (IMPORT_COLUMNS.every((c) => cell(c.key) === null)) return

    const packagings: ImportPackaging[] = []
    for (const n of [1, 2] as const) {
      const pack: ImportPackaging = {
        slot: n,
        unit: asText(cell(`pack${n}_unit`)),
        contains: asNumber(cell(`pack${n}_contains`)),
        price_1: asNumber(cell(`pack${n}_price_1`)),
        price_2: asNumber(cell(`pack${n}_price_2`)),
        price_3: asNumber(cell(`pack${n}_price_3`)),
        barcodes: asBarcodes(cell(`pack${n}_barcodes`)),
      }
      const used = pack.unit !== null || pack.contains !== null || pack.price_1 !== null
        || pack.price_2 !== null || pack.price_3 !== null || pack.barcodes.length > 0
      if (used) packagings.push(pack)
    }

    rows.push({
      row: number,
      code: asText(cell('code')),
      name: asText(cell('name')),
      name2: asText(cell('name2')),
      category: asText(cell('category')),
      brand: asText(cell('brand')),
      unit: asText(cell('unit')),
      cost: asNumber(cell('cost')),
      price_1: asNumber(cell('price_1')),
      price_2: asNumber(cell('price_2')),
      price_3: asNumber(cell('price_3')),
      currency: asText(cell('currency')),
      weight: asNumber(cell('weight')),
      volume: asNumber(cell('volume')),
      barcodes: asBarcodes(cell('barcodes')),
      packagings,
    })
  })

  if (rows.length === 0) {
    throw new ImportFileError(`The ${ws.name} sheet has no products in it. Fill them in from row ${headerRow + 1}, under the headings.`)
  }
  return rows
}

/**
 * The heading row and which column each heading is in. Looked for in the
 * first few rows rather than assumed to be row 2, so a sheet whose band row
 * was deleted still reads.
 */
function locateHeadings(ws: Worksheet): { headerRow: number; columns: Map<ColumnKey, number> } {
  const wanted = new Map(IMPORT_COLUMNS.map((c) => [headingKey(c.header), c.key]))

  for (let r = 1; r <= 5; r++) {
    const columns = new Map<ColumnKey, number>()
    ws.getRow(r).eachCell((cell, c) => {
      const text = plain(cell.value)
      const key = typeof text === 'string' ? wanted.get(headingKey(text)) : undefined
      if (key && !columns.has(key)) columns.set(key, c)
    })
    if (!columns.has('code')) continue

    const missing = IMPORT_COLUMNS.filter((c) => c.required && !columns.has(c.key)).map((c) => c.header)
    if (missing.length) {
      throw new ImportFileError(
        `The ${missing.join(', ')} column${missing.length > 1 ? 's are' : ' is'} missing from the ${ws.name} sheet. Download the template again and keep its headings as they are.`,
      )
    }
    return { headerRow: r, columns }
  }

  throw new ImportFileError('This is not the Salesly products template: no "Code" heading was found. Download the template and fill that in.')
}

// ─── Reporting back ─────────────────────────────────────────────────────────

/**
 * The server's 422, as lines somebody can find in Excel.
 *
 * The server keys each problem by position in the posted list
 * (`rows.4.cost`); the row number in the workbook is put in front of it, and
 * which packaging block it was when it was one.
 */
export function importProblems(errors: Record<string, string[]>, rows: ImportRow[]): { row: number | null; text: string }[] {
  const lines: { row: number | null; text: string }[] = []
  for (const [key, messages] of Object.entries(errors)) {
    const match = /^rows\.(\d+)(?:\.packagings\.(\d+))?/.exec(key)
    const row = match ? rows[Number(match[1])]?.row ?? Number(match[1]) + HEADER_ROW + 1 : null
    const slot = match?.[2] !== undefined
      ? rows[Number(match[1])]?.packagings[Number(match[2])]?.slot ?? Number(match[2]) + 1
      : null
    const where = slot ? `Pack ${slot}: ` : ''
    for (const message of messages) lines.push({ row, text: where + message })
  }
  return lines.sort((a, b) => (a.row ?? 0) - (b.row ?? 0))
}
