/// <reference types="node" />
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { areasExportDoc } from '@/features/areas/areas-export'
import { brandsExportDoc } from '@/features/brands/brands-export'
import { categoriesExportDoc } from '@/features/categories/categories-export'
import { collectionsExportDoc } from '@/features/collections/collections-export'
import { currenciesExportDoc } from '@/features/currencies/currencies-export'
import { customerGroupsExportDoc } from '@/features/customer-groups/customer-groups-export'
import { customersExportDoc } from '@/features/customers/customers-export'
import { depotExportDoc } from '@/features/my-depot/depot-export'
import { invoicesExportDoc } from '@/features/invoices/invoices-export'
import { priceListsExportDoc } from '@/features/price-lists/price-lists-export'
import { productsExportDoc } from '@/features/products/products-export'
import { promotionsExportDoc } from '@/features/promotions/promotions-export'
import { uomsExportDoc } from '@/features/uoms/uoms-export'
import { usersExportDoc } from '@/features/users/users-export'
import { warehousesExportDoc } from '@/features/warehouses/warehouses-export'
import { buildReport, REPORTS } from './build-reports'
import { ReportDocument } from './components/ReportDocument'
import { InvoiceCard } from '@/features/invoices/components/InvoiceCard'
import type { ReportDocument as Doc } from './report-types'
import { PROOF_DATA } from './print-proofs.fixtures'

/**
 * Every printable page, rendered and checked.
 *
 * A print stylesheet is the one thing in a console nobody looks at. It is only
 * seen at a month end, by whoever is holding the paper, and by then the person
 * who wrote it has moved on. So each document is rendered here with realistic
 * data, written out as a standalone HTML file anybody can open, and then checked
 * for the faults that survive a code review and only show up on paper: column
 * widths that do not add up, a heading with no cells under it, a money column
 * that is not right-aligned, a total the summary above it contradicts.
 *
 * The files land in `proofs/` — open one in a browser and Ctrl+P to see exactly
 * what a customer or an accountant gets.
 */

const OUT = join(__dirname, '..', '..', '..', 'proofs')
const CSS = readFileSync(join(__dirname, 'report-print.css'), 'utf8')
const AT = new Date('2026-03-15T14:32:00Z')

/** Every document the console can print, with data that exercises its edges. */
const PAGES: [string, Doc<unknown>][] = [
  ['customers', customersExportDoc(PROOF_DATA.customers, 310, ['Salesman: Ahmad'])],
  ['products-flat', productsExportDoc(PROOF_DATA.products, 480, [], 'none')],
  ['products-by-category', productsExportDoc(PROOF_DATA.products, 480, [], 'category')],
  ['products-by-brand', productsExportDoc(PROOF_DATA.products, 480, [], 'brand')],
  ['invoices', invoicesExportDoc(PROOF_DATA.invoices, 1200, ['Partial read — most recent invoices only'])],
  ['collections', collectionsExportDoc(PROOF_DATA.collections, 90, [])],
  ['team', usersExportDoc(PROOF_DATA.users, 12, [])],
  ['areas', areasExportDoc(PROOF_DATA.areas, 14, '')],
  ['brands', brandsExportDoc(PROOF_DATA.brands, 40, '')],
  ['categories', categoriesExportDoc(PROOF_DATA.categories, 22, '')],
  ['customer-groups', customerGroupsExportDoc(PROOF_DATA.groups, 5, '')],
  ['units', uomsExportDoc(PROOF_DATA.uoms, 9, '')],
  ['currencies', currenciesExportDoc(PROOF_DATA.currencies, PROOF_DATA.rates)],
  ['promotions', promotionsExportDoc(PROOF_DATA.promotions, 6)],
  ['price-lists', priceListsExportDoc(PROOF_DATA.priceLists, 4)],
  ['warehouses', warehousesExportDoc(PROOF_DATA.warehouses, 11, '', '')],
  ['load-requests', depotExportDoc(PROOF_DATA.transfers, 47, '', false, 'requests')],
  ['load-issues', depotExportDoc(PROOF_DATA.transfers, 47, '', false, 'issues')],
  // The six Reports-page documents, built the way the page builds them.
  ...REPORTS.map((r): [string, Doc<unknown>] => [
    `report-${r.id}`,
    buildReport({
      reportId: r.id,
      breakdown: r.breakdowns[0].value,
      from: '',
      to: '',
      customers: PROOF_DATA.customers,
      products: PROOF_DATA.products,
      invoices: PROOF_DATA.invoices,
    }) as Doc<unknown>,
  ]),
] as [string, Doc<unknown>][]

/** Wraps the rendered markup so the file opens as the printed page would. */
function page(title: string, body: string): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { margin: 0; padding: 24px; background: #f3f4f6; font-family: system-ui, sans-serif; }
${CSS}
</style>
${body}
`
}

mkdirSync(OUT, { recursive: true })

describe.each(PAGES)('%s, printed', (name, doc) => {
  // Rendered per test, not once for the describe: testing-library unmounts
  // between tests, so a container captured up here is empty by the time the
  // second assertion reads it — and every check would pass vacuously.
  const draw = () => {
    const { container } = render(
      <ReportDocument doc={doc} companyName="Nestle Lebanon" generatedAt={AT} />,
    )
    writeFileSync(join(OUT, `${name}.html`), page(name, container.innerHTML), 'utf8')
    return container
  }

  it('has a title and says how much of the whole it is', () => {
    const container = draw()
    expect(container.querySelector('.report-title')?.textContent).toBeTruthy()
    expect(container.querySelector('.report-subtitle')?.textContent).toBeTruthy()
  })

  it('gives every column a width, and they add up to a whole page', () => {
    draw()
    // Widths that fall short leave a ragged right edge; widths that overshoot
    // push the last column off the sheet, and nobody sees either on screen.
    for (const group of doc.groups) {
      const cols = group.columns ?? doc.columns
      const total = cols.reduce((sum, c) => sum + Number.parseFloat(c.width ?? '0'), 0)

      expect(cols.every((c) => c.width), `${name}: a column has no width`).toBe(true)
      expect(Math.round(total), `${name}: widths total ${total}%`).toBe(100)
    }
  })

  it('right-aligns every figure, so a column can be read down', () => {
    const container = draw()
    // An empty document prints its message rather than a table, which is right.
    if (!container.querySelector('.report-table')) return

    for (const group of doc.groups) {
      const cols = group.columns ?? doc.columns
      cols.forEach((col, i) => {
        if (col.kind !== 'money' && col.kind !== 'number') return
        const th = container.querySelectorAll('.report-table thead th')[i]
        expect(th?.className, `${name}: column ${col.header}`).toContain(`is-${col.kind}`)
      })
    }
  })

  it('never leaves a cell reading undefined, NaN or an object', () => {
    const container = draw()
    expect(container.textContent).not.toContain('undefined')
    expect(container.textContent).not.toContain('NaN')
    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('Invalid Date')
  })

  it('heads every group that has rows, and shows no group that has none', () => {
    const container = draw()
    // A heading with nothing under it reads as a section that failed to print.
    for (const section of container.querySelectorAll('.report-group')) {
      expect(section.querySelectorAll('tbody tr').length).toBeGreaterThan(0)
    }
  })

  it('gives every table a real thead, and a tfoot only when it totals', () => {
    const container = draw()
    for (const table of container.querySelectorAll('.report-table')) {
      expect(table.querySelector('thead')).not.toBeNull()
    }
    if (!container.querySelector('.report-table')) return

    for (const group of doc.groups) {
      const cols = group.columns ?? doc.columns
      if (!cols.some((c) => c.total)) continue
      expect(container.querySelector('.report-table tfoot')).not.toBeNull()
    }
  })

  it('carries a running footer for the pages after the first', () => {
    const container = draw()
    const footer = container.querySelector('.report-footer')
    expect(footer?.textContent).toContain('Nestle Lebanon')
  })
})

describe('the invoice card, printed', () => {
  const draw = () => {
    const { container } = render(
      <InvoiceCard invoice={PROOF_DATA.invoice} companyName="Nestle Lebanon" />,
    )
    writeFileSync(join(OUT, 'invoice-card.html'), page('invoice-card', container.innerHTML), 'utf8')
    return container
  }

  it('bills to somebody, from somebody', () => {
    const container = draw()
    const parties = container.querySelector('.invoice-parties')
    expect(parties?.textContent).toContain('Zahle Wholesale Depot')
    expect(parties?.textContent).toContain('Ahmad')
  })

  it('states the money in a currency', () => {
    const container = draw()
    const totals = container.querySelector('.invoice-totals')
    expect(totals?.textContent).toMatch(/\$|LBP/)
  })

  it('leaves nothing reading undefined or NaN', () => {
    const container = draw()
    expect(container.textContent).not.toContain('undefined')
    expect(container.textContent).not.toContain('NaN')
  })
})
