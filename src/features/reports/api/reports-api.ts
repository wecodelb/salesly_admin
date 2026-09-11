import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'

/**
 * The server-side reports: aggregated over the whole book, not over a page.
 *
 * Every report answers with the same frame — `kpis` for the whole filtered
 * window and `rows`, each row carrying one key per grouping level — so the
 * screen can lay any of them out with one table and one KPI band.
 */

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

export interface ReportKey {
  dim: string
  /** Null where the row has no value for this level, e.g. a customer with no area. */
  id: number | string | null
  label: string
}

export type SalesDimension =
  | 'item'
  | 'category'
  | 'brand'
  | 'supplier'
  | 'customer'
  | 'channel'
  | 'region'
  | 'salesman'
  | 'warehouse'
  | 'day'
  | 'week'
  | 'month'

export type Compare = 'none' | 'previous_period' | 'previous_year'

export interface SalesRow {
  keys: ReportKey[]
  invoice_count: number
  lines_count: number
  qty: number
  returns_qty: number
  sales_value: number
  returns_value: number
  net_sales: number
  cost_value: number
  gross_margin: number
  margin_pct: number | null
  share_pct: number | null
  prior_net_sales: number | null
  growth_pct: number | null
  rank: number
}

export interface SalesKpis {
  net_sales: number
  sales_value: number
  returns_value: number
  qty: number
  returns_qty: number
  invoice_count: number
  lines_count: number
  cost_value: number
  gross_margin: number
  margin_pct: number | null
  prior_net_sales: number | null
  growth_pct: number | null
  active_skus: number
  billed_customers: number
}

export interface SalesAnalysis {
  currency: string
  period: { from: string; to: string; prior_from: string | null; prior_to: string | null }
  group_by: SalesDimension[]
  include_returns: boolean
  compare: Compare
  kpis: SalesKpis
  rows: SalesRow[]
}

export type InventoryGroup = 'item' | 'warehouse' | 'salesman'

export interface InventoryRow {
  keys: ReportKey[]
  available_qty: number
  reserved_qty: number
  on_hand: number
  cost_value: number
  sale_value: number
  locations: number
}

export interface Inventory {
  currency: string
  group_by: InventoryGroup[]
  kpis: { skus: number; units: number; cost_value: number; sale_value: number; locations: number }
  rows: InventoryRow[]
}

export type MovementGroup = 'salesman' | 'item' | 'day'

export interface MovementRow {
  keys: ReportKey[]
  documents: number
  lines: number
  qty: number
  cost_value: number
  sale_value: number
  /** Unloads by salesman or item only: what went out on the van, and how much of it came back. */
  loaded_qty?: number
  unload_ratio_pct?: number | null
}

export interface Movements {
  currency: string
  group_by: MovementGroup[]
  kpis: {
    documents: number
    lines: number
    qty: number
    cost_value: number
    sale_value: number
    loaded_qty?: number
    unload_ratio_pct?: number | null
  }
  rows: MovementRow[]
}

/** What any report can be narrowed by. Each list is sent comma-separated. */
export interface ReportFilters {
  salesman_id?: number[]
  customer_id?: number[]
  item_id?: number[]
  category_id?: number[]
  brand_id?: number[]
  supplier_id?: number[]
  area_id?: number[]
  customer_group_id?: number[]
  warehouse_id?: number[]
}

export interface SalesParams extends ReportFilters {
  from?: string
  to?: string
  group_by: SalesDimension[]
  include_returns?: boolean
  compare?: Compare
  top?: number | null
}

export interface InventoryParams extends ReportFilters {
  group_by: InventoryGroup
  only_in_stock?: boolean
}

export interface MovementParams extends ReportFilters {
  from?: string
  to?: string
  group_by: MovementGroup
}

/**
 * The query string for a report.
 *
 * Empty values are left off rather than sent blank: to the server a missing
 * filter means "everything", and an empty one is a different question.
 */
export function toQuery(params: object): Record<string, string> {
  const query: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      query[key] = value.join(',')
    } else if (typeof value === 'boolean') {
      query[key] = value ? '1' : '0'
    } else {
      query[key] = String(value)
    }
  }

  return query
}

async function get<T>(url: string, params: object): Promise<T> {
  const res = await apiClient.get<Envelope<T>>(url, { params: toQuery(params) })
  return res.data.data
}

export function fetchSalesAnalysis(params: SalesParams): Promise<SalesAnalysis> {
  return get(ENDPOINTS.REPORTS.SALES_ANALYSIS, params)
}

export function fetchInventory(params: InventoryParams): Promise<Inventory> {
  return get(ENDPOINTS.REPORTS.INVENTORY, params)
}

export function fetchLoads(params: MovementParams): Promise<Movements> {
  return get(ENDPOINTS.REPORTS.LOADS, params)
}

export function fetchUnloads(params: MovementParams): Promise<Movements> {
  return get(ENDPOINTS.REPORTS.UNLOADS, params)
}
