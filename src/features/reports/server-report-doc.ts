import type {
  Compare,
  Inventory,
  InventoryRow,
  Movements,
  MovementRow,
  ReportKey,
  SalesAnalysis,
  SalesRow,
} from './api/reports-api'
import { DIMENSION_LABELS, type Engine, type ReportView } from './catalog'
import { money, qty, rangeLabel } from './report-format'
import type { ReportColumn, ReportDocument, ReportGroup } from './report-types'

/**
 * A server report as columns and a document.
 *
 * The on-screen table and the exported PDF / workbook are all built from the
 * columns defined here, so the three can never disagree about what a column
 * is called, how it is formatted or whether it is totalled.
 */

export type ReportResult =
  | { engine: 'sales'; data: SalesAnalysis }
  | { engine: 'inventory'; data: Inventory }
  | { engine: 'loads'; data: Movements }
  | { engine: 'unloads'; data: Movements }

export type AnyRow = SalesRow | InventoryRow | MovementRow

/** A column, plus what the screen needs to draw it better than paper can. */
export interface ScreenColumn<Row> extends ReportColumn<Row> {
  id: string
  /** Drawn as a bar behind the figure, or as a coloured change. */
  display?: 'share' | 'growth' | 'ratio'
  /** The number the screen sorts by. */
  sortValue?: (row: Row) => number | string | null
}

export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}

function signedPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function keyColumn<Row extends { keys: ReportKey[] }>(dim: string, level: number): ScreenColumn<Row> {
  return {
    id: `key-${level}`,
    header: DIMENSION_LABELS[dim] ?? dim,
    value: (row) => row.keys[level]?.label ?? '—',
    sortValue: (row) => row.keys[level]?.label ?? '',
  }
}

function moneyCol<Row>(id: string, header: string, pick: (r: Row) => number | null, total = true): ScreenColumn<Row> {
  return {
    id,
    header,
    kind: 'money',
    value: (r) => money(pick(r)),
    raw: (r) => pick(r),
    ...(total ? { total: (r: Row) => n(pick(r)) } : {}),
    sortValue: (r) => pick(r),
  }
}

function numberCol<Row>(id: string, header: string, pick: (r: Row) => number | null, total = true): ScreenColumn<Row> {
  return {
    id,
    header,
    kind: 'number',
    value: (r) => qty(pick(r)),
    raw: (r) => pick(r),
    ...(total ? { total: (r: Row) => n(pick(r)) } : {}),
    sortValue: (r) => pick(r),
  }
}

function pctCol<Row>(id: string, header: string, pick: (r: Row) => number | null | undefined, display?: ScreenColumn<Row>['display']): ScreenColumn<Row> {
  return {
    id,
    header,
    kind: 'number',
    value: (r) => (display === 'growth' ? signedPct(pick(r)) : pct(pick(r))),
    raw: (r) => pick(r) ?? null,
    sortValue: (r) => pick(r) ?? null,
    display,
  }
}

// ── Columns per engine ──────────────────────────────────────────────────────

export function salesMeasures(compare: Compare, withReturns: boolean): ScreenColumn<SalesRow>[] {
  return [
    numberCol<SalesRow>('invoices', 'Invoices', (r) => r.invoice_count),
    numberCol<SalesRow>('qty', 'Qty', (r) => r.qty),
    ...(withReturns ? [moneyCol<SalesRow>('returns', 'Returns', (r) => r.returns_value)] : []),
    moneyCol<SalesRow>('net', 'Net sales', (r) => r.net_sales),
    moneyCol<SalesRow>('cost', 'Cost', (r) => r.cost_value),
    moneyCol<SalesRow>('margin', 'Margin', (r) => r.gross_margin),
    pctCol<SalesRow>('margin-pct', 'Margin %', (r) => r.margin_pct),
    pctCol<SalesRow>('share', 'Share', (r) => r.share_pct, 'share'),
    ...(compare !== 'none'
      ? [
          moneyCol<SalesRow>('prior', compare === 'previous_year' ? 'Last year' : 'Prior period', (r) => r.prior_net_sales),
          pctCol<SalesRow>('growth', 'Growth', (r) => r.growth_pct, 'growth'),
        ]
      : []),
    numberCol<SalesRow>('rank', 'Rank', (r) => r.rank, false),
  ]
}

export function inventoryMeasures(group: string): ScreenColumn<InventoryRow>[] {
  return [
    numberCol<InventoryRow>('available', 'Available', (r) => r.available_qty),
    numberCol<InventoryRow>('reserved', 'Reserved', (r) => r.reserved_qty),
    numberCol<InventoryRow>('on-hand', 'On hand', (r) => r.on_hand),
    moneyCol<InventoryRow>('cost', 'Value at cost', (r) => r.cost_value),
    moneyCol<InventoryRow>('sale', 'Value at price', (r) => r.sale_value),
    ...(group === 'item' ? [numberCol<InventoryRow>('locations', 'Locations', (r) => r.locations, false)] : []),
  ]
}

export function movementMeasures(engine: Engine, group: string, ratioFirst = false): ScreenColumn<MovementRow>[] {
  const ratio =
    engine === 'unloads' && group !== 'day'
      ? [
          numberCol<MovementRow>('loaded', 'Loaded qty', (r) => r.loaded_qty ?? null),
          pctCol<MovementRow>('ratio', 'Unload ratio', (r) => r.unload_ratio_pct, 'ratio'),
        ]
      : []

  const figures = [
    numberCol<MovementRow>('documents', 'Documents', (r) => r.documents),
    numberCol<MovementRow>('lines', 'Lines', (r) => r.lines),
    numberCol<MovementRow>('qty', engine === 'unloads' ? 'Qty back' : 'Qty loaded', (r) => r.qty),
    moneyCol<MovementRow>('cost', 'Value at cost', (r) => r.cost_value),
    moneyCol<MovementRow>('sale', 'Value at price', (r) => r.sale_value),
  ]

  return ratioFirst ? [...ratio, ...figures] : [...figures, ...ratio]
}

/**
 * Every column the result is laid out in: one per grouping level after the
 * first when the table is grouped, then the figures.
 */
export function columnsFor(result: ReportResult, view: ReportView): { levels: string[]; keyColumns: ScreenColumn<AnyRow>[]; measures: ScreenColumn<AnyRow>[] } {
  const levels = result.data.group_by as string[]
  const keyColumns = levels.map((dim, i) => keyColumn<AnyRow>(dim, i))

  let measures: ScreenColumn<AnyRow>[]
  if (result.engine === 'sales') {
    measures = salesMeasures(result.data.compare, result.data.include_returns) as ScreenColumn<AnyRow>[]
  } else if (result.engine === 'inventory') {
    measures = inventoryMeasures(levels[0]) as ScreenColumn<AnyRow>[]
  } else {
    measures = movementMeasures(result.engine, levels[0], view.ratio) as ScreenColumn<AnyRow>[]
  }

  return { levels, keyColumns, measures }
}

export interface GroupedRows {
  key: string
  label: string
  rows: AnyRow[]
}

/**
 * The rows, cut by their first level when there is more than one.
 *
 * One level is a flat ranked list. Two or three read as a tree — each
 * salesman, then what he sold — so the first level becomes the heading of a
 * run of rows rather than a column repeating the same name down the page.
 */
export function groupRows(rows: AnyRow[], levels: string[]): GroupedRows[] {
  if (levels.length < 2) return [{ key: 'all', label: '', rows }]

  const groups = new Map<string, GroupedRows>()
  for (const row of rows) {
    const k = row.keys[0]
    const key = `${k?.id ?? 'none'}`
    if (!groups.has(key)) groups.set(key, { key, label: k?.label ?? '—', rows: [] })
    groups.get(key)!.rows.push(row)
  }
  return [...groups.values()]
}

// ── The document ────────────────────────────────────────────────────────────

export interface DocContext {
  view: ReportView
  /** The active filters, already in words. */
  filters?: string[]
}

function kpiSummary(result: ReportResult): { label: string; value: string }[] {
  if (result.engine === 'sales') {
    const k = result.data.kpis
    return [
      { label: 'Net sales', value: money(k.net_sales) },
      { label: 'Qty sold', value: qty(k.qty) },
      { label: 'Gross margin', value: pct(k.margin_pct) },
      ...(result.data.compare !== 'none' ? [{ label: 'Growth', value: signedPct(k.growth_pct) }] : []),
      { label: 'Returns', value: money(k.returns_value) },
      { label: 'Active SKUs', value: qty(k.active_skus) },
      { label: 'Billed customers', value: qty(k.billed_customers) },
    ]
  }
  if (result.engine === 'inventory') {
    const k = result.data.kpis
    return [
      { label: 'SKUs', value: qty(k.skus) },
      { label: 'Units', value: qty(k.units) },
      { label: 'Value at cost', value: money(k.cost_value) },
      { label: 'Value at price', value: money(k.sale_value) },
      { label: 'Locations', value: qty(k.locations) },
    ]
  }
  const k = result.data.kpis
  return [
    { label: 'Documents', value: qty(k.documents) },
    { label: result.engine === 'unloads' ? 'Qty back' : 'Qty loaded', value: qty(k.qty) },
    { label: 'Value at cost', value: money(k.cost_value) },
    { label: 'Value at price', value: money(k.sale_value) },
    ...(result.engine === 'unloads' && k.unload_ratio_pct !== undefined
      ? [{ label: 'Unload ratio', value: pct(k.unload_ratio_pct) }]
      : []),
  ]
}

function periodLine(result: ReportResult, view: ReportView): string | null {
  if (result.engine === 'sales') {
    const p = result.data.period
    const main = rangeLabel(p.from, p.to)
    return p.prior_from && p.prior_to ? `${main} · against ${rangeLabel(p.prior_from, p.prior_to)}` : main
  }
  if (!view.dated) return 'Stock as it stands now'
  return null
}

export function serverReportDoc(
  result: ReportResult,
  { view, filters = [] }: DocContext,
  period?: { from: string; to: string },
): ReportDocument<AnyRow> {
  const { levels, keyColumns, measures } = columnsFor(result, view)
  const grouped = levels.length > 1
  const columns = [...(grouped ? keyColumns.slice(1) : keyColumns), ...measures]

  const groups: ReportGroup<AnyRow>[] = groupRows(result.data.rows, levels).map((g) => ({
    key: g.key,
    title: g.label,
    caption: grouped
      ? `${DIMENSION_LABELS[levels[0]] ?? levels[0]} · ${g.rows.length} row${g.rows.length === 1 ? '' : 's'}`
      : undefined,
    rows: g.rows,
  }))

  const dates = periodLine(result, view) ?? (period ? rangeLabel(period.from, period.to) : null)
  const grouping = `By ${levels.map((d) => (DIMENSION_LABELS[d] ?? d).toLowerCase()).join(' › ')}`

  return {
    title: view.name,
    subtitle: [dates, grouping, ...filters].filter(Boolean).join(' · '),
    columns,
    groups,
    summary: kpiSummary(result),
    emptyMessage: 'Nothing was recorded for this period and these filters.',
  }
}
