// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { IMPORT_COLUMNS, ImportFileError, SHEET_NAME } from './product-import'
import { importProblems, readImportWorkbook } from './product-import-read'
import { writeImportWorkbook, type TemplateLists } from './product-import-write'
import type { AdminItem } from './types'

/**
 * The product spreadsheet, written and read back for real through exceljs.
 *
 * The promise this file keeps is the round trip. A catalogue downloaded "with
 * my products" and uploaded again must come back as exactly the rows that went
 * out, because the server leaves a product alone only when its row matches it.
 * If anything drifts on the way (a barcode turned into 5.4E+12, a dropped
 * leading zero, a blank read as 0), every product reads as changed, and an
 * untouched export would rewrite the whole catalogue.
 */

const lists: TemplateLists = {
  units: ['Piece', 'Box', 'Carton'],
  categories: ['Drinks', 'Snacks'],
  brands: ['Fizzy'],
  currencies: ['USD', 'LBP'],
}

const cola: AdminItem = {
  id: 1, code: 'COLA-330', name: 'Cola 330ml', name2: 'كولا',
  category: 'Drinks', category_id: 1, brand: 'Fizzy', brand_id: 1,
  price: 0.75, price_usd: 0.75, price_lbp: 67125, exchange_rate: 89500,
  currency_id: 1, currency: { id: 1, code: 'USD', symbol: '$' },
  price_1: 0.75, price_2: 0.7, price_3: 0.65, weight: 0.35, volume: 0.33,
  stock: 10, available_qty: 10, cost: 0.4, uom: 'Piece', uom_id: 1, promo: null,
  uoms: [
    { uom_id: 1, uom: { id: 1, code: 'PCS', name: 'Piece' }, unit: 1, is_base: true, cost: 0.4,
      price_1: 0.75, price_2: 0.7, price_3: 0.65, weight: 0.35, volume: 0.33, barcodes: ['5449000000996'] },
    { uom_id: 2, uom: { id: 2, code: 'BOX', name: 'Box' }, unit: 24, is_base: false, cost: 9.6,
      price_1: 17, price_2: 16, price_3: 15, weight: 8.4, volume: 7.92, barcodes: ['5449000001009', '0012345678905'] },
  ],
}

/** The bare minimum: no brand, no second name, no currency, no packaging, a code that is all digits. */
const plain: AdminItem = {
  id: 2, code: '000123', name: 'Water 1L', name2: null, category: '', category_id: null, brand: '', brand_id: null,
  price: 0.3, price_usd: 0.3, price_lbp: null, exchange_rate: null, currency_id: null, currency: null,
  price_1: 0.3, price_2: 0, price_3: 0, weight: 0, volume: 0, stock: 0, available_qty: 0, cost: 0.1,
  uom: 'Piece', uom_id: 1, promo: null,
  uoms: [{ uom_id: 1, uom: { id: 1, code: 'PCS', name: 'Piece' }, unit: 1, is_base: true, cost: 0.1,
    price_1: 0.3, price_2: 0, price_3: 0, weight: 0, volume: 0, barcodes: [] }],
}

async function load(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return wb
}

async function saveBack(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

const col = (header: string) => IMPORT_COLUMNS.findIndex((c) => c.header === header) + 1

describe('the template', () => {
  it('lays the headings under coloured bands, with the required ones starred', async () => {
    const { buffer } = await writeImportWorkbook([], lists)
    const ws = (await load(buffer)).getWorksheet(SHEET_NAME)!

    expect(ws.getCell(1, 1).value).toBe('PRODUCT')
    expect(ws.getCell(1, col('Base unit')).value).toBe('BASE UNIT & PRICES')
    expect(ws.getCell(1, col('Pack 1 unit')).value).toBe('PACKAGING 1 (optional)')
    expect(ws.getCell(1, col('Pack 2 unit')).value).toBe('PACKAGING 2 (optional)')

    const code = ws.getCell(2, 1).value as { richText: { text: string }[] }
    expect(code.richText.map((p) => p.text).join('')).toBe('Code *')
    expect(ws.getCell(2, col('Brand')).value).toBe('Brand')
    // Every heading explains itself.
    expect(String(ws.getCell(2, col('Pack 1 contains')).note)).toContain('A box of 24 pieces is 24')
  })

  it('keeps codes and barcodes as text, and offers the company\'s units in a drop-down', async () => {
    const { buffer } = await writeImportWorkbook([], lists)
    const wb = await load(buffer)
    const ws = wb.getWorksheet(SHEET_NAME)!

    expect(ws.getColumn(col('Code')).numFmt).toBe('@')
    expect(ws.getColumn(col('Barcodes')).numFmt).toBe('@')

    const unit = ws.getCell(3, col('Base unit')).dataValidation
    expect(unit.type).toBe('list')
    expect(unit.formulae[0]).toBe('Lists!$A$2:$A$4')
    // Off, so a unit the company lacks can still be typed; Excel leaves the flag out when it is off.
    expect(unit.showErrorMessage).toBeFalsy()
    expect(ws.getCell(3, col('Cost')).dataValidation.type).toBe('decimal')

    expect(wb.getWorksheet('Lists')!.state).toBe('hidden')
    expect(wb.getWorksheet('How to fill')).toBeDefined()
  })

  it('an empty template has no products to import', async () => {
    const { buffer } = await writeImportWorkbook([], lists)
    await expect(readImportWorkbook(buffer)).rejects.toThrow(/has no products in it/)
  })
})

describe('the round trip', () => {
  it('reads back exactly what the catalogue download wrote', async () => {
    const { buffer, dropped } = await writeImportWorkbook([cola, plain], lists)
    expect(dropped).toBe(0)

    const rows = await readImportWorkbook(buffer)

    expect(rows).toEqual([
      {
        row: 3, code: 'COLA-330', name: 'Cola 330ml', name2: 'كولا', category: 'Drinks', brand: 'Fizzy',
        unit: 'Piece', cost: 0.4, price_1: 0.75, price_2: 0.7, price_3: 0.65, currency: 'USD',
        weight: 0.35, volume: 0.33, barcodes: ['5449000000996'],
        packagings: [{ slot: 1, unit: 'Box', contains: 24, price_1: 17, price_2: 16, price_3: 15,
          barcodes: ['5449000001009', '0012345678905'] }],
      },
      {
        row: 4, code: '000123', name: 'Water 1L', name2: null, category: null, brand: null,
        unit: 'Piece', cost: 0.1, price_1: 0.3, price_2: 0, price_3: 0, currency: null,
        weight: 0, volume: 0, barcodes: [], packagings: [],
      },
    ])
  })

  it('reads a sheet edited in Excel: a changed price, a new row, and a barcode typed as a number', async () => {
    const { buffer } = await writeImportWorkbook([cola], lists)
    const wb = await load(buffer)
    const ws = wb.getWorksheet(SHEET_NAME)!

    ws.getCell(3, col('Retail price')).value = 0.8
    const added = ws.getRow(5) // a blank row left between them is skipped
    added.getCell(col('Code')).value = 'CHIPS'
    added.getCell(col('Name')).value = 'Chips 50g'
    added.getCell(col('Base unit')).value = 'piece'
    added.getCell(col('Cost')).value = '0.20'
    added.getCell(col('Retail price')).value = { formula: '0.2*2.5', result: 0.5 }
    added.getCell(col('Barcodes')).value = 6291234567890
    added.getCell(col('Pack 2 unit')).value = 'Carton'
    added.getCell(col('Pack 2 contains')).value = 40

    const rows = await readImportWorkbook(await saveBack(wb))

    expect(rows).toHaveLength(2)
    expect(rows[0].price_1).toBe(0.8)
    expect(rows[1]).toMatchObject({
      row: 5, code: 'CHIPS', unit: 'piece', cost: 0.2, price_1: 0.5,
      barcodes: ['6291234567890'],
      // Filled in the second block with the first left empty: still a packaging, and still known as Pack 2.
      packagings: [{ slot: 2, unit: 'Carton', contains: 40, price_1: null, barcodes: [] }],
    })
  })

  it('passes a cell that is not a number through as typed, for the server to name', async () => {
    const { buffer } = await writeImportWorkbook([cola], lists)
    const wb = await load(buffer)
    wb.getWorksheet(SHEET_NAME)!.getCell(3, col('Cost')).value = 'cheap'

    const [row] = await readImportWorkbook(await saveBack(wb))
    expect(row.cost).toBe('cheap')
  })

  it('finds the columns by heading even when they have been moved about', async () => {
    const { buffer } = await writeImportWorkbook([cola], lists)
    const wb = await load(buffer)
    const ws = wb.getWorksheet(SHEET_NAME)!
    ws.spliceRows(1, 1) // the band row deleted
    ws.spliceColumns(1, 0, ['Notes', 'ignore me']) // an extra column put in front

    const [row] = await readImportWorkbook(await saveBack(wb))
    expect(row).toMatchObject({ row: 2, code: 'COLA-330', price_1: 0.75 })
  })

  it('warns when a product has more packagings than the sheet can hold', async () => {
    const extra = { ...cola, uoms: [...cola.uoms!,
      { ...cola.uoms![1], uom_id: 3, uom: { id: 3, code: 'CTN', name: 'Carton' }, unit: 96 },
      { ...cola.uoms![1], uom_id: 4, uom: { id: 4, code: 'PAL', name: 'Pallet' }, unit: 960 }] }
    const { dropped } = await writeImportWorkbook([extra], lists)
    expect(dropped).toBe(1)
  })
})

describe('a file that is not the template', () => {
  it('is turned away when a required heading has gone', async () => {
    const { buffer } = await writeImportWorkbook([cola], lists)
    const wb = await load(buffer)
    wb.getWorksheet(SHEET_NAME)!.getCell(2, col('Cost')).value = 'Price paid'

    await expect(readImportWorkbook(await saveBack(wb))).rejects.toThrow(
      'The Cost column is missing from the Products sheet. Download the template again and keep its headings as they are.',
    )
  })

  it('is turned away when there is no Code heading at all', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Sheet1').addRow(['Item', 'Price']).commit()
    await expect(readImportWorkbook(await saveBack(wb))).rejects.toBeInstanceOf(ImportFileError)
  })

  it('is turned away when it is not a workbook', async () => {
    const junk = new TextEncoder().encode('code,name\n1,Cola').buffer as ArrayBuffer
    await expect(readImportWorkbook(junk)).rejects.toThrow(/could not be opened/)
  })
})

describe('the server\'s answer', () => {
  it('puts each problem against its row in the workbook and its packaging block', async () => {
    const rows = [
      { row: 3, packagings: [] },
      { row: 9, packagings: [{ slot: 2 }] },
    ] as never

    expect(importProblems({
      'rows.1.packagings.0.contains': ['The Contains field is required.'],
      'rows.0.cost': ['The Cost must be a number.'],
    }, rows)).toEqual([
      { row: 3, text: 'The Cost must be a number.' },
      { row: 9, text: 'Pack 2: The Contains field is required.' },
    ])
  })
})
