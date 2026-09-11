import type { Worksheet } from 'exceljs'

import { parseApiDate } from './report-format'
import type { ColumnKind, ReportColumn, ReportDocument } from './report-types'

/**
 * Any screen's export, as an Excel workbook.
 *
 * Built from the same `ReportDocument` the PDF is printed from, so the two can
 * never disagree about which rows are in it or what the columns mean. The
 * difference is what each is for: the PDF is a page to file, the workbook is
 * figures to work with — so every money and quantity cell here is a real
 * number, every date a real date, and the totals are live formulas that follow
 * the filter somebody sets on the header row.
 *
 * Split in two on purpose. `sheetModel` decides what goes in each cell and is
 * plain data, cheap to test. `writeWorkbook` only lays that out with exceljs,
 * which is loaded on the first export rather than shipped with every screen.
 */

export type CellValue = string | number | Date | null

export interface SheetColumn {
  header: string
  kind: ColumnKind
  /** In characters, the unit Excel measures column widths in. */
  width: number
  /** Excel number format for the column's cells. */
  numFmt?: string
}

export interface SheetGroup {
  title: string
  caption?: string
  columns: SheetColumn[]
  rows: CellValue[][]
  /** Per column: the total, or null where the column is not totalled. Null when none is. */
  totals: (number | null)[] | null
}

export interface SheetModel {
  company: string
  title: string
  subtitle?: string
  generatedAt: Date
  summary: { label: string; value: string }[]
  groups: SheetGroup[]
  emptyMessage: string
}

const DASH = '—'

/**
 * Reads a figure back out of the text a column formatted it into.
 *
 * Strict on purpose: only a whole cell that is a figure — `$1,234.50`,
 * `-$20.00`, `($5.00)`, `42`, `12.5%` — becomes a number. Anything with words
 * in it stays text, because stripping the letters out of "3 of 10" yields 310.
 */
const FIGURE = /^([-−]|\()?\s*(?:[$€£])?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d*\.?\d+)\s*(%)?\)?$/

export function parseShownNumber(shown: string): number | string | null {
  const text = shown.trim()
  if (text === '' || text === DASH) return null

  const match = FIGURE.exec(text)
  if (!match) return text

  const value = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(value)) return text

  return match[1] ? -value : value
}

/**
 * One cell, as the spreadsheet should hold it.
 *
 * A column that knows its raw value says so; otherwise a money or number
 * column is read from its total, then from its own formatted text, and a date
 * from the text too. What cannot be read stays as the text it was — a cell
 * saying "Unlimited" is more honest than a zero.
 */
export function cellValue<Row>(column: ReportColumn<Row>, row: Row): CellValue {
  if (column.raw) return column.raw(row) ?? null

  const shown = column.value(row) ?? ''
  const kind = column.kind ?? 'text'

  if (kind === 'money' || kind === 'number') {
    if (column.total) {
      const n = column.total(row)
      if (Number.isFinite(n)) return n
    }
    return parseShownNumber(shown)
  }

  if (kind === 'date') {
    const trimmed = shown.trim()
    if (trimmed === '' || trimmed === DASH) return null
    const date = parseApiDate(trimmed)
    return date && !Number.isNaN(date.getTime()) ? date : trimmed
  }

  const trimmed = shown.trim()
  return trimmed === '' || trimmed === DASH ? null : trimmed
}

function numberFormat(kind: ColumnKind, values: CellValue[]): string | undefined {
  if (kind === 'money') return '"$"#,##0.00;[Red]-"$"#,##0.00'

  if (kind === 'number') {
    const whole = values.every((v) => typeof v !== 'number' || Number.isInteger(v))
    return whole ? '#,##0' : '#,##0.00'
  }

  if (kind === 'date') {
    const timed = values.some(
      (v) => v instanceof Date && (v.getHours() !== 0 || v.getMinutes() !== 0),
    )
    return timed ? 'dd mmm yyyy  hh:mm' : 'dd mmm yyyy'
  }

  return undefined
}

function widthOf<Row>(column: ReportColumn<Row>, rows: Row[]): number {
  const longest = rows.reduce((max, row) => {
    const shown = column.value(row) ?? ''
    return Math.max(max, shown.length)
  }, column.header.length)

  // Headers are bold and money gains a currency sign, so a little slack.
  return Math.min(48, Math.max(9, longest + 3))
}

export function sheetModel<Row>(
  doc: ReportDocument<Row>,
  { company, generatedAt }: { company: string; generatedAt: Date },
): SheetModel {
  const groups: SheetGroup[] = doc.groups
    .filter((group) => group.rows.length > 0)
    .map((group) => {
      const columns = group.columns ?? doc.columns
      const rows = group.rows.map((row) => columns.map((col) => cellValue(col, row)))

      const sheetColumns = columns.map((col, i) => ({
        header: col.header,
        kind: col.kind ?? 'text',
        width: widthOf(col, group.rows),
        numFmt: numberFormat(
          col.kind ?? 'text',
          rows.map((r) => r[i]),
        ),
      }))

      const totalled = columns.some((c) => c.total)
      const totals = totalled
        ? columns.map((col) =>
            col.total
              ? group.rows.reduce((sum, row) => {
                  const n = col.total!(row)
                  return Number.isFinite(n) ? sum + n : sum
                }, 0)
              : null,
          )
        : null

      return { title: group.title, caption: group.caption, columns: sheetColumns, rows, totals }
    })

  return {
    company,
    title: doc.title,
    subtitle: doc.subtitle,
    generatedAt,
    summary: doc.summary ?? [],
    groups,
    emptyMessage: doc.emptyMessage ?? 'Nothing matches these filters.',
  }
}

// ── Layout ──────────────────────────────────────────────────────────────────

const NAVY = 'FF0A3D8F'
const TEAL = 'FF0D9488'
const INK = 'FF111827'
const MUTED = 'FF6B7280'
const HAIR = 'FFE5E7EB'
const ZEBRA = 'FFF8FAFC'
const TILE = 'FFEEF3FB'
const TOTAL_FILL = 'FFE8EEF8'
const FONT = 'Segoe UI'

const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })

/** Excel stores a date without a zone; hand it the wall-clock time shown on screen. */
function asExcelDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()),
  )
}

function columnLetter(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** Sheet names may not carry []:*?/\ and stop at 31 characters. */
export function sheetName(title: string): string {
  const clean = title.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim()
  return (clean || 'Report').slice(0, 31)
}

/** `sales-analysis-2026-09-10.xlsx`. */
export function excelFileName(title: string, at: Date): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'report'
  const day = `${at.getFullYear()}-${`${at.getMonth() + 1}`.padStart(2, '0')}-${`${at.getDate()}`.padStart(2, '0')}`
  return `${slug}-${day}.xlsx`
}

function banner(ws: Worksheet, model: SheetModel, span: number): number {
  const merged = (row: number) => ws.mergeCells(row, 1, row, span)

  const company = ws.getRow(1)
  company.getCell(1).value = model.company.toUpperCase()
  company.getCell(1).font = { name: FONT, size: 9, bold: true, color: { argb: TEAL } }
  merged(1)

  const title = ws.getRow(2)
  title.height = 30
  title.getCell(1).value = model.title
  title.getCell(1).font = { name: FONT, size: 20, bold: true, color: { argb: NAVY } }
  title.getCell(1).alignment = { vertical: 'middle' }
  merged(2)

  let row = 3
  if (model.subtitle) {
    ws.getRow(row).getCell(1).value = model.subtitle
    ws.getRow(row).getCell(1).font = { name: FONT, size: 10, color: { argb: MUTED } }
    merged(row)
    row++
  }

  const stamp = model.generatedAt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  ws.getRow(row).getCell(1).value = `Generated ${stamp}`
  ws.getRow(row).getCell(1).font = { name: FONT, size: 9, italic: true, color: { argb: MUTED } }
  merged(row)

  // A navy rule under the masthead, the same one the PDF draws.
  for (let c = 1; c <= span; c++) {
    ws.getRow(row).getCell(c).border = { bottom: { style: 'medium', color: { argb: NAVY } } }
  }

  return row + 2
}

function summaryTiles(ws: Worksheet, model: SheetModel, start: number, span: number): number {
  if (model.summary.length === 0) return start

  let row = start
  for (let i = 0; i < model.summary.length; i += span) {
    const chunk = model.summary.slice(i, i + span)
    const labels = ws.getRow(row)
    const values = ws.getRow(row + 1)
    values.height = 24

    // White edges between tiles, so four figures read as four tiles rather
    // than one long strip.
    const gap = { style: 'thick' as const, color: { argb: 'FFFFFFFF' } }

    chunk.forEach((item, c) => {
      const label = labels.getCell(c + 1)
      label.value = item.label.toUpperCase()
      label.font = { name: FONT, size: 8, bold: true, color: { argb: MUTED } }
      label.fill = fill(TILE)
      label.border = { top: { style: 'medium', color: { argb: NAVY } }, left: gap, right: gap }
      label.alignment = { indent: 1 }

      const value = values.getCell(c + 1)
      const figure = summaryFigure(item.value)
      value.value = figure.value
      if (figure.numFmt) value.numFmt = figure.numFmt
      value.font = { name: FONT, size: 14, bold: true, color: { argb: NAVY } }
      value.fill = fill(TILE)
      value.border = { left: gap, right: gap }
      value.alignment = { indent: 1, vertical: 'middle', horizontal: 'left' }
    })

    row += 3
  }

  return row
}

/**
 * A summary tile's figure, as a number where it is one.
 *
 * Written as text, `$4,897.55` gets Excel's "number stored as text" flag on
 * every tile, and nobody can point a formula at it.
 */
export function summaryFigure(shown: string): { value: string | number; numFmt?: string } {
  const figure = parseShownNumber(shown)
  if (typeof figure !== 'number') return { value: shown }

  if (shown.includes('%')) return { value: figure, numFmt: Number.isInteger(figure) ? '0"%"' : '0.0"%"' }
  if (shown.includes('$')) return { value: figure, numFmt: '"$"#,##0.00' }
  return { value: figure, numFmt: Number.isInteger(figure) ? '#,##0' : '#,##0.00' }
}

function alignmentOf(kind: ColumnKind): 'left' | 'right' | 'center' {
  if (kind === 'money' || kind === 'number') return 'right'
  if (kind === 'date' || kind === 'badge') return 'center'
  return 'left'
}

export async function writeWorkbook(model: SheetModel): Promise<ArrayBuffer> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Salesly'
  workbook.title = model.title
  workbook.company = model.company
  workbook.created = model.generatedAt

  const widest = Math.max(4, ...model.groups.map((g) => g.columns.length))
  const ws = workbook.addWorksheet(sheetName(model.title), {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: widest > 5 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&L&8${model.company.replace(/&/g, '&&')}&C&8${model.title.replace(/&/g, '&&')}&R&8Page &P of &N`,
    },
  })

  let row = banner(ws, model, widest)
  row = summaryTiles(ws, model, row, widest)

  // Widths: the widest any group needs in each position — plus room for the
  // filter arrow when there is one, which otherwise sits on top of a
  // right-aligned heading.
  const arrow = model.groups.length === 1 ? 3 : 0
  for (let c = 0; c < widest; c++) {
    const width = Math.max(12, ...model.groups.map((g) => g.columns[c]?.width ?? 0))
    ws.getColumn(c + 1).width = width + arrow
  }

  if (model.groups.length === 0) {
    const cell = ws.getRow(row).getCell(1)
    cell.value = model.emptyMessage
    cell.font = { name: FONT, size: 11, italic: true, color: { argb: MUTED } }
    ws.mergeCells(row, 1, row, widest)
  }

  const single = model.groups.length === 1

  for (const group of model.groups) {
    const span = group.columns.length

    if (group.title) {
      const head = ws.getRow(row)
      head.height = 22
      head.getCell(1).value = {
        richText: [
          { text: group.title, font: { name: FONT, size: 12, bold: true, color: { argb: NAVY } } },
          ...(group.caption
            ? [{ text: `   ${group.caption}`, font: { name: FONT, size: 9, color: { argb: MUTED } } }]
            : []),
        ],
      }
      head.getCell(1).alignment = { vertical: 'bottom' }
      ws.mergeCells(row, 1, row, span)
      row++
    }

    const headerRow = row
    const header = ws.getRow(headerRow)
    header.height = 24
    group.columns.forEach((col, c) => {
      const cell = header.getCell(c + 1)
      cell.value = col.header
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = fill(NAVY)
      // Excel draws the filter arrow over the right edge of a heading, whatever
      // the column's width, so a right-aligned heading is pushed clear of it.
      const horizontal = alignmentOf(col.kind)
      cell.alignment = {
        vertical: 'middle',
        horizontal,
        indent: single && horizontal === 'right' ? 3 : 1,
      }
    })
    row++

    const firstData = row
    group.rows.forEach((values, r) => {
      const line = ws.getRow(row)
      line.height = 18
      values.forEach((value, c) => {
        const col = group.columns[c]
        const cell = line.getCell(c + 1)
        cell.value = value instanceof Date ? asExcelDate(value) : value
        cell.font = { name: FONT, size: 10, color: { argb: INK } }
        if (r % 2 === 1) cell.fill = fill(ZEBRA)
        cell.border = { bottom: { style: 'hair', color: { argb: HAIR } } }
        cell.alignment = { vertical: 'middle', horizontal: alignmentOf(col.kind), indent: 1 }
        if (col.numFmt && (typeof value === 'number' || value instanceof Date)) cell.numFmt = col.numFmt
      })
      row++
    })
    const lastData = row - 1

    if (group.totals) {
      const totals = ws.getRow(row)
      totals.height = 22
      group.columns.forEach((col, c) => {
        const cell = totals.getCell(c + 1)
        const total = group.totals![c]
        const letter = columnLetter(c)
        // SUBTOTAL(109) rather than SUM: it skips the rows a filter hides, so
        // narrowing the table in Excel narrows its total with it.
        cell.value =
          total !== null
            ? { formula: `SUBTOTAL(109,${letter}${firstData}:${letter}${lastData})`, result: total }
            : c === 0
              ? 'Total'
              : null
        cell.font = { name: FONT, size: 10, bold: true, color: { argb: NAVY } }
        cell.fill = fill(TOTAL_FILL)
        cell.border = { top: { style: 'medium', color: { argb: NAVY } } }
        cell.alignment = { vertical: 'middle', horizontal: alignmentOf(col.kind), indent: 1 }
        if (total !== null && col.numFmt) cell.numFmt = col.numFmt
      })
      row++
    }

    if (single) {
      // One table: its header stays in view while scrolling, carries a filter
      // arrow on every column, and repeats at the top of every printed page.
      ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }]
      ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastData, column: span } }
      ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`
    }

    row += 1
  }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function save(buffer: ArrayBuffer, fileName: string): void {
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked on the next tick: some browsers start the download asynchronously
  // and a URL revoked on the same line downloads nothing.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Builds the workbook for a document and hands it to the browser as a download. */
export async function downloadExcel<Row>(
  doc: ReportDocument<Row>,
  { company, generatedAt = new Date() }: { company: string; generatedAt?: Date },
): Promise<string> {
  const model = sheetModel(doc, { company, generatedAt })
  const buffer = await writeWorkbook(model)
  const fileName = excelFileName(doc.title, generatedAt)
  save(buffer, fileName)
  return fileName
}
