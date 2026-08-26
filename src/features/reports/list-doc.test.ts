import { describe, expect, it } from 'vitest'

import { areasExportDoc } from '@/features/areas/areas-export'
import { brandsExportDoc } from '@/features/brands/brands-export'
import { categoriesExportDoc } from '@/features/categories/categories-export'
import { currenciesExportDoc } from '@/features/currencies/currencies-export'
import { customerGroupsExportDoc } from '@/features/customer-groups/customer-groups-export'
import { depotExportDoc } from '@/features/my-depot/depot-export'
import { priceListsExportDoc } from '@/features/price-lists/price-lists-export'
import { promotionsExportDoc } from '@/features/promotions/promotions-export'
import { uomsExportDoc } from '@/features/uoms/uoms-export'
import { warehousesExportDoc } from '@/features/warehouses/warehouses-export'
import { listDoc, searchNote } from './list-doc'
import type { Area } from '@/features/areas/types'
import type { Currency } from '@/features/products/types'
import type { CustomerGroup } from '@/features/customer-groups/types'
import type { DepotTransfer } from '@/features/my-depot/types'
import type { PriceList } from '@/features/price-lists/types'
import type { Promotion } from '@/features/promotions/types'
import type { Uom } from '@/features/uoms/types'
import type { Warehouse } from '@/features/warehouses/types'

/**
 * The exports the reference and operations screens print.
 *
 * These are thin by design — one table, a search box, and a count. What is
 * worth testing is the part that is the same everywhere and easy to get subtly
 * wrong: the subtitle that says how narrow the page is, and the handful of
 * cells where a screen has its own vocabulary the print must not invent a
 * second version of.
 */

describe('listDoc', () => {
  const doc = (over = {}) =>
    listDoc<{ name: string }>({
      title: 'Things',
      noun: 'things',
      rows: [{ name: 'A' }],
      total: 10,
      columns: [{ header: 'Name', value: (r) => r.name, width: '100%' }],
      ...over,
    })

  it('says how much of the whole the page is', () => {
    expect(doc().subtitle).toBe('1 of 10 things')
  })

  it('drops the "of" when nothing was filtered away', () => {
    expect(doc({ total: 1 }).subtitle).toBe('1 things')
  })

  it('prints one flat unheaded run of rows by default', () => {
    // A single group carrying a heading that says nothing is worse than none.
    const groups = doc().groups
    expect(groups).toHaveLength(1)
    expect(groups[0].title).toBe('')
  })

  it('takes groups when a screen has a real breakdown', () => {
    const groups = [{ key: 'a', title: 'A', rows: [{ name: 'A' }] }]
    expect(doc({ groups }).groups).toBe(groups)
  })

  it('writes an empty message naming the thing, not a bare sentence', () => {
    expect(doc({ rows: [] }).emptyMessage).toBe('No things match these filters.')
  })

  it('lets a screen override the empty message for a list nobody filters', () => {
    expect(doc({ emptyMessage: 'No things yet.' }).emptyMessage).toBe('No things yet.')
  })
})

describe('searchNote', () => {
  it('quotes what was typed so the page explains its own rows', () => {
    expect(searchNote('cola')).toBe('Search “cola”')
  })

  it('is nothing at all when the box is empty or only spaces', () => {
    expect(searchNote('')).toBe(false)
    expect(searchNote('   ')).toBe(false)
  })
})

const area = (over: Partial<Area> = {}) =>
  ({ id: 1, code: 'A1', name: 'Beirut', customers_count: 12, ...over }) as Area

describe('areas', () => {
  it('totals the customers covered', () => {
    const doc = areasExportDoc([area(), area({ id: 2, customers_count: 8 })], 2, '')

    expect(doc.summary).toContainEqual({ label: 'Customers covered', value: '20' })
  })

  it('counts the areas nobody delivers to', () => {
    // Either a gap in the round or a row that should be deleted — both are
    // worth seeing, and neither is visible from a column of names.
    const doc = areasExportDoc([area(), area({ id: 2, customers_count: 0 })], 2, '')

    expect(doc.summary).toContainEqual({ label: 'Empty areas', value: '1' })
  })

  it('carries the search into the subtitle', () => {
    expect(areasExportDoc([area()], 9, 'bei').subtitle).toBe(
      '1 of 9 areas · Search “bei”',
    )
  })
})

describe('brands and categories', () => {
  it('write an absent count as a dash rather than zero', () => {
    // items_count is absent on the picker payload and zero on a real empty
    // brand. A printed page cannot be asked which one it meant.
    const col = brandsExportDoc([], 0, '').columns.find((c) => c.header === 'Products')!

    expect(col.value({ id: 1, code: 'B', name: 'B' })).toBe('—')
    expect(col.value({ id: 1, code: 'B', name: 'B', items_count: 0 })).toBe('0')
  })

  it('count the empty ones on the same rule', () => {
    const doc = categoriesExportDoc(
      [
        { id: 1, code: 'C1', name: 'Drinks', items_count: 4 },
        { id: 2, code: 'C2', name: 'Empty', items_count: 0 },
      ],
      2,
      '',
    )

    expect(doc.summary).toContainEqual({ label: 'Empty', value: '1' })
  })
})

describe('customer groups', () => {
  const group = (over: Partial<CustomerGroup> = {}) =>
    ({
      id: 1,
      company_id: 1,
      name: 'Retail',
      sort_order: 1,
      customers_count: 5,
      ...over,
    }) as CustomerGroup

  it('leads with the sort order, which is the company vocabulary', () => {
    // Re-sorting alphabetically would lose the meaning the order carries.
    const doc = customerGroupsExportDoc([group()], 1, '')

    expect(doc.columns[0].header).toBe('Order')
  })
})

describe('units of measure', () => {
  const uom = (over: Partial<Uom> = {}) =>
    ({ id: 1, code: 'PC', name: 'Piece', items_count: 3, packagings_count: 2, ...over }) as Uom

  it('counts a unit as unused only when nothing at all references it', () => {
    // Safe to delete versus not is the whole reason this page is printed.
    const doc = uomsExportDoc(
      [
        uom(),
        uom({ id: 2, items_count: 0, packagings_count: 0 }),
        uom({ id: 3, items_count: 0, packagings_count: 4 }),
      ],
      3,
      '',
    )

    expect(doc.summary).toContainEqual({ label: 'Unused', value: '1' })
  })
})

describe('currencies', () => {
  const currency = (over: Partial<Currency> = {}) =>
    ({
      id: 1,
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimal_places: 2,
      symbol_position: 'before',
      is_base: true,
      is_active: true,
      ...over,
    }) as Currency

  it('renders a sample on the side the symbol actually sits', () => {
    const col = currenciesExportDoc([], 0).columns.find(
      (c) => c.header === 'Renders as',
    )!

    expect(col.value(currency())).toBe('$1.00')
    expect(col.value(currency({ symbol: 'ل.ل', symbol_position: 'after' }))).toBe(
      '1.00ل.ل',
    )
  })

  it('drops the decimals for a currency that has none', () => {
    const col = currenciesExportDoc([], 0).columns.find(
      (c) => c.header === 'Renders as',
    )!

    expect(col.value(currency({ code: 'LBP', symbol: 'L', decimal_places: 0 }))).toBe('L1')
  })

  it('names the base on the page, because every rate is quoted against it', () => {
    const doc = currenciesExportDoc(
      [currency(), currency({ id: 2, code: 'EUR', is_base: false })],
      2,
    )

    expect(doc.summary).toContainEqual({ label: 'Base', value: 'USD' })
  })

  it('says so rather than printing a blank when no base is set', () => {
    const doc = currenciesExportDoc([currency({ is_base: false })], 1)

    expect(doc.summary).toContainEqual({ label: 'Base', value: '—' })
  })
})

describe('promotions', () => {
  const promo = (over: Partial<Promotion> = {}) =>
    ({
      id: 1,
      name: 'Summer',
      type: 'percent',
      value: 10,
      item_id: 1,
      item: 'Cola',
      category_id: null,
      category: null,
      starts_at: '2026-06-01',
      ends_at: '2026-08-31',
      is_active: true,
      ...over,
    }) as Promotion

  it('writes a percentage as a percentage and an amount as money', () => {
    const col = promotionsExportDoc([], 0).columns.find(
      (c) => c.header === 'Discount',
    )!

    expect(col.value(promo())).toBe('10%')
    expect(col.value(promo({ type: 'amount', value: 2.5 }))).toBe('$2.50')
  })

  it('says what it applies to, falling back from item to category', () => {
    const col = promotionsExportDoc([], 0).columns.find(
      (c) => c.header === 'Applies to',
    )!

    expect(col.value(promo())).toBe('Cola')
    expect(col.value(promo({ item: null, category: 'Drinks' }))).toBe('Drinks')
    expect(col.value(promo({ item: null, category: null }))).toBe('—')
  })

  it('writes an open-ended window as a dash, not as today', () => {
    const col = promotionsExportDoc([], 0).columns.find((c) => c.header === 'To')!

    expect(col.value(promo({ ends_at: null }))).toBe('—')
  })
})

describe('price lists', () => {
  const list = (over: Partial<PriceList> = {}) =>
    ({
      id: 1,
      name: 'Wholesale',
      is_default: false,
      is_active: true,
      items_count: 12,
      customers: [{ id: 1, name: 'A' }],
      ...over,
    }) as PriceList

  it('counts customers off the embedded list, not a count field it may not have', () => {
    const doc = priceListsExportDoc([list(), list({ id: 2, customers: [] })], 2)

    expect(doc.summary).toContainEqual({ label: 'Customers priced', value: '1' })
  })

  it('survives a payload with no customers array at all', () => {
    const col = priceListsExportDoc([], 0).columns.find(
      (c) => c.header === 'Customers',
    )!

    expect(col.value(list({ customers: undefined }))).toBe('0')
  })
})

describe('warehouses', () => {
  const warehouse = (over: Partial<Warehouse> = {}) =>
    ({
      id: 1,
      code: 'W1',
      name: 'Main store',
      location: 'Beirut',
      area_name: 'Beirut',
      is_depot: false,
      is_main: true,
      salesman: null,
      ...over,
    }) as unknown as Warehouse

  it('separates depots from warehouses in the summary', () => {
    const doc = warehousesExportDoc(
      [warehouse(), warehouse({ id: 2, is_depot: true, salesman: { id: 1, name: 'Ahmad' } })],
      2,
      '',
      '',
    )

    expect(doc.summary).toContainEqual({ label: 'Warehouses', value: '1' })
    expect(doc.summary).toContainEqual({ label: 'Depots', value: '1' })
  })

  it('counts a depot with nobody on it, because it cannot be loaded', () => {
    const doc = warehousesExportDoc(
      [warehouse({ id: 2, is_depot: true, salesman: null })],
      1,
      '',
      '',
    )

    expect(doc.summary).toContainEqual({ label: 'Depots unmanned', value: '1' })
  })

  it('names the kind filter on the page', () => {
    expect(warehousesExportDoc([warehouse()], 5, '', 'depot').subtitle).toContain(
      'Depots only',
    )
  })
})

describe('depot paperwork', () => {
  const transfer = (over: Partial<DepotTransfer> = {}) =>
    ({
      id: 1,
      trs_type: 'LR',
      trs_number: 'LR-1',
      trs_date: '15/03/2026 09:30',
      status: 'DRAFT',
      source: { id: 1, name: 'Main store' },
      destination: { id: 2, name: 'Van 3' },
      salesman: { id: 1, name: 'Ahmad' },
      total_qty: 40,
      ...over,
    }) as unknown as DepotTransfer

  it('reads the d/m/Y the depot endpoints send, not month-first', () => {
    // 15/03 read month-first is not a date at all; 03/11 read month-first is
    // the wrong month and nothing looks broken.
    const col = depotExportDoc([], 0, '', false, 'requests').columns.find(
      (c) => c.header === 'Date',
    )!

    expect(col.value(transfer())).toBe('15 Mar 2026')
    expect(col.value(transfer({ trs_date: '03/11/2026 08:00' }))).toBe('03 Nov 2026')
  })

  it('uses the screen’s own three words for status', () => {
    // The console, the page and the phone have to say the same thing about the
    // same document, so it borrows transferPill rather than inventing labels.
    const col = depotExportDoc([], 0, '', false, 'requests').columns.find(
      (c) => c.header === 'Status',
    )!

    expect(col.value(transfer({ trs_type: 'LR', status: 'DRAFT' }))).toBe('Requested')
    expect(col.value(transfer({ trs_type: 'LR', status: 'CONFIRMED' }))).toBe(
      'Load issued',
    )
    expect(col.value(transfer({ trs_type: 'TRI' }))).toBe('Received')
  })

  it('shows where a request came from and where a load went', () => {
    const from = depotExportDoc([], 0, '', false, 'requests').columns[3]
    const to = depotExportDoc([], 0, '', false, 'issues').columns[3]

    expect(from.header).toBe('From')
    expect(from.value(transfer())).toBe('Main store')
    expect(to.header).toBe('To')
    expect(to.value(transfer())).toBe('Van 3')
  })

  it('titles itself for the end it is read from', () => {
    expect(depotExportDoc([], 0, '', false, 'requests').title).toBe('Load requests')
    expect(depotExportDoc([], 0, '', false, 'issues').title).toBe('Load issues')
  })

  it('totals the units, which is what the warehouse reconciles', () => {
    const doc = depotExportDoc(
      [transfer(), transfer({ id: 2, total_qty: 60 })],
      2,
      '',
      false,
      'issues',
    )

    expect(doc.summary).toContainEqual({ label: 'Units', value: '100' })
  })
})
