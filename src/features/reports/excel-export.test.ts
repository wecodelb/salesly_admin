// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import {
  cellValue,
  excelFileName,
  parseShownNumber,
  sheetModel,
  sheetName,
  summaryFigure,
  writeWorkbook,
} from './excel-export'
import type { ReportDocument } from './report-types'

/**
 * The workbook a screen's export becomes.
 *
 * What makes an Excel export worth having over the PDF is that its figures are
 * figures: a total somebody can re-add, a column they can sort, a filter that
 * narrows the total with it. So most of this checks cell types, not text.
 */

interface Row {
  name: string
  owed: number | null
  qty: number
  since: string | null
}

const rows: Row[] = [
  { name: 'Corner Shop', owed: 400, qty: 12, since: '15/03/2026 10:00' },
  { name: 'Bakery Nour', owed: null, qty: 3, since: null },
  { name: 'Zahle Depot', owed: 150.5, qty: 7, since: '2026-06-21' },
]

const doc: ReportDocument<Row> = {
  title: 'Customers: owing',
  subtitle: '3 customers · Owing',
  columns: [
    { header: 'Customer', value: (r) => r.name },
    {
      header: 'Owed',
      kind: 'money',
      value: (r) => (r.owed === null ? '—' : `$${r.owed.toFixed(2)}`),
      total: (r) => r.owed as number,
    },
    { header: 'Qty', kind: 'number', value: (r) => String(r.qty) },
    { header: 'Since', kind: 'date', value: (r) => r.since ?? '—' },
  ],
  groups: [{ key: 'all', title: '', rows }],
  summary: [{ label: 'Total owed', value: '$550.50' }],
}

const at = new Date(2026, 8, 10, 12, 30)

describe('reading a figure back out of its text', () => {
  it('handles currency, thousands and negatives', () => {
    expect(parseShownNumber('$1,234.50')).toBe(1234.5)
    expect(parseShownNumber('-$20.00')).toBe(-20)
    expect(parseShownNumber('($5.00)')).toBe(-5)
    expect(parseShownNumber('42')).toBe(42)
  })

  it('leaves a gap as a gap, and words as words', () => {
    // A dash is "nothing", not zero; "Unlimited" is not a number at all.
    expect(parseShownNumber('—')).toBeNull()
    expect(parseShownNumber('')).toBeNull()
    expect(parseShownNumber('Unlimited')).toBe('Unlimited')
  })

  it('never glues the digits of a phrase together', () => {
    // Stripping the letters out of "3 of 10" would make it 310.
    expect(parseShownNumber('3 of 10')).toBe('3 of 10')
    expect(parseShownNumber('SI-1040')).toBe('SI-1040')
    expect(parseShownNumber('01 234 567')).toBe('01 234 567')
  })

  it('reads a percentage as its figure', () => {
    expect(parseShownNumber('12.5%')).toBe(12.5)
  })
})

describe('a summary tile', () => {
  it('holds a real number, formatted as the tile showed it', () => {
    expect(summaryFigure('$4,897.55')).toEqual({ value: 4897.55, numFmt: '"$"#,##0.00' })
    expect(summaryFigure('14')).toEqual({ value: 14, numFmt: '#,##0' })
    expect(summaryFigure('31.4%')).toEqual({ value: 31.4, numFmt: '0.0"%"' })
  })

  it('keeps words as words', () => {
    expect(summaryFigure('3 of 10')).toEqual({ value: '3 of 10' })
  })
})

describe('one cell', () => {
  it('prefers the raw value a column declares', () => {
    const col = { header: 'X', kind: 'money' as const, value: () => 'shown', raw: () => 7 }
    expect(cellValue(col, {})).toBe(7)
  })

  it('reads money from the total, not from the formatted text', () => {
    expect(cellValue(doc.columns[1], rows[2])).toBe(150.5)
  })

  it('turns both of the API date shapes into real dates', () => {
    const first = cellValue(doc.columns[3], rows[0]) as Date
    const third = cellValue(doc.columns[3], rows[2]) as Date

    expect(first).toBeInstanceOf(Date)
    expect([first.getFullYear(), first.getMonth(), first.getDate(), first.getHours()]).toEqual([2026, 2, 15, 10])
    expect(third).toBeInstanceOf(Date)
  })

  it('writes nothing, rather than a dash or a zero, for a missing value', () => {
    expect(cellValue(doc.columns[1], rows[1])).toBeNull()
    expect(cellValue(doc.columns[3], rows[1])).toBeNull()
  })
})

describe('the sheet model', () => {
  const model = sheetModel(doc, { company: 'Nestle Lebanon', generatedAt: at })

  it('carries the masthead the PDF carries', () => {
    expect(model.company).toBe('Nestle Lebanon')
    expect(model.title).toBe('Customers: owing')
    expect(model.subtitle).toBe('3 customers · Owing')
    expect(model.summary).toEqual([{ label: 'Total owed', value: '$550.50' }])
  })

  it('totals only the columns that say they are worth totalling', () => {
    expect(model.groups[0].totals).toEqual([null, 550.5, null, null])
  })

  it('formats whole quantities without decimals and money with two', () => {
    const [, owed, qty, since] = model.groups[0].columns
    expect(owed.numFmt).toContain('#,##0.00')
    expect(qty.numFmt).toBe('#,##0')
    expect(since.numFmt).toContain('hh:mm')
  })

  it('drops groups with nothing in them, as the PDF does', () => {
    const empty = sheetModel(
      { ...doc, groups: [{ key: 'a', title: 'Nobody', rows: [] }] },
      { company: 'X', generatedAt: at },
    )
    expect(empty.groups).toHaveLength(0)
  })
})

describe('names', () => {
  it('gives the file a readable, dated name', () => {
    expect(excelFileName('Customers: owing', at)).toBe('customers-owing-2026-09-10.xlsx')
    expect(excelFileName('', at)).toBe('report-2026-09-10.xlsx')
  })

  it('keeps the sheet name inside what Excel accepts', () => {
    expect(sheetName('Sales / by item [2026]?')).toBe('Sales by item 2026')
    expect(sheetName('x'.repeat(40))).toHaveLength(31)
  })
})

describe('the workbook itself', () => {
  async function readBack() {
    const model = sheetModel(doc, { company: 'Nestle Lebanon', generatedAt: at })
    const buffer = await writeWorkbook(model)
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(buffer)
    return book.worksheets[0]
  }

  function find(ws: ExcelJS.Worksheet, text: string) {
    let hit: ExcelJS.Cell | null = null
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        if (!hit && cell.value === text) hit = cell
      }),
    )
    return hit as ExcelJS.Cell | null
  }

  it('opens as a real workbook, headed with the company and the title', async () => {
    const ws = await readBack()

    expect(ws.name).toBe('Customers owing')
    expect(ws.getCell('A1').value).toBe('NESTLE LEBANON')
    expect(ws.getCell('A2').value).toBe('Customers: owing')
  })

  it('stores figures as numbers, and gaps as empty cells', async () => {
    const ws = await readBack()
    const header = find(ws, 'Owed')!
    const first = ws.getRow(Number(header.row) + 1)

    expect(first.getCell(1).value).toBe('Corner Shop')
    expect(first.getCell(2).value).toBe(400)
    expect(first.getCell(3).value).toBe(12)
    expect(first.getCell(4).value).toBeInstanceOf(Date)
    expect(ws.getRow(Number(header.row) + 2).getCell(2).value).toBeNull()
  })

  it('totals with a formula that follows the filter', async () => {
    const ws = await readBack()
    const header = find(ws, 'Owed')!
    const total = ws.getRow(Number(header.row) + 4).getCell(2).value as ExcelJS.CellFormulaValue

    expect(total.formula).toMatch(/^SUBTOTAL\(109,B\d+:B\d+\)$/)
    expect(total.result).toBe(550.5)
  })

  it('freezes the header and puts a filter on it', async () => {
    const ws = await readBack()
    const header = find(ws, 'Owed')!

    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: Number(header.row) })
    expect(ws.autoFilter).toBeTruthy()
  })

  it('says so, rather than writing an empty sheet, when nothing matched', async () => {
    const model = sheetModel(
      { ...doc, groups: [{ key: 'a', title: '', rows: [] }], emptyMessage: 'No customers owe anything.' },
      { company: 'X', generatedAt: at },
    )
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(await writeWorkbook(model))

    expect(find(book.worksheets[0], 'No customers owe anything.')).not.toBeNull()
  })
})
