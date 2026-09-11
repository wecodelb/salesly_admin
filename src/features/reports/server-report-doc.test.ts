import { describe, expect, it } from 'vitest'

import type { Movements, SalesAnalysis, SalesRow } from './api/reports-api'
import { toQuery } from './api/reports-api'
import { findView } from './catalog'
import { sheetModel } from './excel-export'
import { rangeLabel } from './report-format'
import { columnsFor, groupRows, pct, serverReportDoc, type ReportResult } from './server-report-doc'

/**
 * A server report, laid out.
 *
 * The screen, the PDF and the workbook all take their columns from here, so
 * these are the checks that keep the three telling the same story.
 */

function row(salesman: string, sid: number, item: string, iid: number, net: number, over: Partial<SalesRow> = {}): SalesRow {
  return {
    keys: [
      { dim: 'salesman', id: sid, label: salesman },
      { dim: 'item', id: iid, label: item },
    ],
    invoice_count: 1,
    lines_count: 1,
    qty: 10,
    returns_qty: 0,
    sales_value: net,
    returns_value: 0,
    net_sales: net,
    cost_value: net / 2,
    gross_margin: net / 2,
    margin_pct: 50,
    share_pct: 25,
    prior_net_sales: net,
    growth_pct: 0,
    rank: 1,
    ...over,
  }
}

const sales: SalesAnalysis = {
  currency: 'USD',
  period: { from: '2026-09-01', to: '2026-09-16', prior_from: '2026-08-16', prior_to: '2026-08-31' },
  group_by: ['salesman', 'item'],
  include_returns: true,
  compare: 'previous_period',
  kpis: {
    net_sales: 400, sales_value: 420, returns_value: 20, qty: 40, returns_qty: 2, invoice_count: 4, lines_count: 4,
    cost_value: 200, gross_margin: 200, margin_pct: 50, prior_net_sales: 320, growth_pct: 25, active_skus: 3, billed_customers: 2,
  },
  rows: [
    row('Ahmad', 1, 'IT-COLA — Cola', 1, 150),
    row('Ahmad', 1, 'IT-WATER — Water', 2, 50, { growth_pct: null, prior_net_sales: 0 }),
    row('Sara', 2, 'IT-COLA — Cola', 1, 200),
  ],
}

const result: ReportResult = { engine: 'sales', data: sales }
const view = findView('salesman-by-item')

describe('grouping the rows', () => {
  it('cuts by the first level, keeping the server’s order', () => {
    const groups = groupRows(sales.rows, sales.group_by)
    expect(groups.map((g) => g.label)).toEqual(['Ahmad', 'Sara'])
    expect(groups[0].rows).toHaveLength(2)
  })

  it('leaves a one-level report as one flat run', () => {
    const groups = groupRows(sales.rows, ['item'])
    expect(groups).toHaveLength(1)
    expect(groups[0].rows).toHaveLength(3)
  })

  it('keeps rows with no value for the first level together, not scattered', () => {
    const orphan = row('— None —', 0, 'X', 9, 5)
    orphan.keys[0].id = null
    const groups = groupRows([orphan, { ...orphan }], ['salesman', 'item'])
    expect(groups).toHaveLength(1)
  })
})

describe('the columns', () => {
  it('shows comparison columns only when comparing', () => {
    const comparing = columnsFor(result, view).measures.map((c) => c.header)
    expect(comparing).toContain('Prior period')
    expect(comparing).toContain('Growth')

    const flat = columnsFor({ engine: 'sales', data: { ...sales, compare: 'none' } }, view).measures.map((c) => c.header)
    expect(flat).not.toContain('Growth')
  })

  it('calls last year last year', () => {
    const headers = columnsFor({ engine: 'sales', data: { ...sales, compare: 'previous_year' } }, view).measures.map((c) => c.header)
    expect(headers).toContain('Last year')
  })

  it('leads the unload-ratio view with the ratio', () => {
    const moves: Movements = {
      currency: 'USD',
      group_by: ['salesman'],
      kpis: { documents: 1, lines: 1, qty: 6, cost_value: 12, sale_value: 30, loaded_qty: 90, unload_ratio_pct: 6.7 },
      rows: [{ keys: [{ dim: 'salesman', id: 1, label: 'Ahmad' }], documents: 1, lines: 1, qty: 6, cost_value: 12, sale_value: 30, loaded_qty: 90, unload_ratio_pct: 6.7 }],
    }
    const { measures } = columnsFor({ engine: 'unloads', data: moves }, findView('unload-ratio'))
    expect(measures[0].header).toBe('Loaded qty')
    expect(measures[1].header).toBe('Unload ratio')
    expect(measures[1].value(moves.rows[0])).toBe('6.7%')
  })

  it('writes a missing percentage as a dash, never as NaN%', () => {
    expect(pct(null)).toBe('—')
    expect(pct(Number.NaN)).toBe('—')
  })
})

describe('the exported document', () => {
  const doc = serverReportDoc(result, { view, filters: ['Region: Beirut'] })

  it('is headed with the report and what was asked', () => {
    expect(doc.title).toBe('Salesman by item')
    // Built with rangeLabel itself: the month's short name is the locale's
    // to choose ("Sep" in one ICU build, "Sept" in another).
    expect(doc.subtitle).toContain(rangeLabel('2026-09-01', '2026-09-16'))
    expect(doc.subtitle).toContain(`against ${rangeLabel('2026-08-16', '2026-08-31')}`)
    expect(doc.subtitle).toContain('By salesman › item')
    expect(doc.subtitle).toContain('Region: Beirut')
  })

  it('prints a table per salesman, with the item as the first column', () => {
    expect(doc.groups.map((g) => g.title)).toEqual(['Ahmad', 'Sara'])
    expect(doc.columns[0].header).toBe('Item')
  })

  it('carries the key figures into the summary strip', () => {
    const labels = doc.summary!.map((s) => s.label)
    expect(labels).toEqual(expect.arrayContaining(['Net sales', 'Gross margin', 'Growth', 'Active SKUs', 'Billed customers']))
    expect(doc.summary!.find((s) => s.label === 'Growth')!.value).toBe('+25.0%')
  })

  it('becomes a workbook of real numbers', () => {
    const model = sheetModel(doc, { company: 'Nestle', generatedAt: new Date() })
    const net = doc.columns.findIndex((c) => c.header === 'Net sales')
    expect(model.groups[0].rows[0][net]).toBe(150)
    expect(model.groups[0].totals![net]).toBe(200)
    // A growth nobody can compute stays empty rather than becoming zero.
    const growth = doc.columns.findIndex((c) => c.header === 'Growth')
    expect(model.groups[0].rows[1][growth]).toBeNull()
  })
})

describe('the query string', () => {
  it('sends lists comma-separated and leaves out what was not asked', () => {
    expect(
      toQuery({ group_by: ['salesman', 'item'], salesman_id: [3], area_id: [], top: null, include_returns: false, from: '' }),
    ).toEqual({ group_by: 'salesman,item', salesman_id: '3', include_returns: '0' })
  })
})
