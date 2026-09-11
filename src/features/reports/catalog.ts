import type { InventoryGroup, MovementGroup, SalesDimension } from './api/reports-api'

/**
 * The reports the office asks for, by name.
 *
 * Most of them are the same question asked along a different axis — sales by
 * item, by brand, by salesman, by salesman by item — so they are not twelve
 * reports but saved views over one engine, each pre-set with its grouping.
 * Picking one is a shortcut, not a different screen: the grouping stays
 * editable, and "Sales by salesman" with a second level added is simply the
 * next question.
 */

export type Engine = 'sales' | 'inventory' | 'loads' | 'unloads'

export type SectionKey = 'sales' | 'advanced' | 'inventory' | 'loads' | 'unloads'

export interface ReportView {
  id: string
  name: string
  description: string
  section: SectionKey
  engine: Engine
  /** The grouping it opens with. Sales take up to three levels; the others one. */
  levels: string[]
  /** Whether a date window narrows it — false for stock as it stands now. */
  dated: boolean
  /** The unload-ratio view: the same figures, with the ratio leading. */
  ratio?: boolean
}

export const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'sales', label: 'Sales statistics' },
  { key: 'advanced', label: 'Advanced statistics' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'loads', label: 'Loads' },
  { key: 'unloads', label: 'Unloads' },
]

const sales = (
  id: string,
  name: string,
  levels: SalesDimension[],
  description: string,
  section: SectionKey = 'sales',
): ReportView => ({ id, name, description, section, engine: 'sales', levels, dated: true })

export const VIEWS: ReportView[] = [
  sales('sales-by-item', 'Sales by item', ['item'], 'What sold, ranked by net sales'),
  sales('sales-by-category', 'Sales by category', ['category'], 'Net sales and margin per category'),
  sales('sales-by-brand', 'Sales by brand', ['brand'], 'How each brand is moving'),
  sales('sales-by-customer', 'Sales by customer', ['customer'], 'Who is buying, and how much'),
  sales('sales-by-salesman', 'Sales by salesman', ['salesman'], 'Each salesman against the period before'),
  sales('sales-by-date', 'Sales by date', ['day'], 'Day by day through the period'),

  sales('customer-by-item', 'Customer by item', ['customer', 'item'], 'What each customer bought', 'advanced'),
  sales('salesman-by-item', 'Salesman by item', ['salesman', 'item'], 'What each salesman sold', 'advanced'),
  sales('salesman-by-category', 'Salesman by category', ['salesman', 'category'], 'Each salesman’s mix of categories', 'advanced'),
  sales('salesman-by-brand', 'Salesman by brand', ['salesman', 'brand'], 'Each salesman’s mix of brands', 'advanced'),
  sales('salesman-by-date', 'Salesman by date', ['salesman', 'day'], 'Each salesman, day by day', 'advanced'),
  sales('item-by-date', 'Item by date', ['item', 'day'], 'Each item, day by day', 'advanced'),
  sales('sales-analysis', 'Custom analysis', ['region', 'salesman', 'item'], 'Any grouping, up to three levels deep', 'advanced'),

  { id: 'inventory', name: 'Inventory', description: 'Stock on hand per item, everywhere', section: 'inventory', engine: 'inventory', levels: ['item'], dated: false },
  { id: 'inventory-by-warehouse', name: 'Inventory by warehouse', description: 'What each warehouse and van holds', section: 'inventory', engine: 'inventory', levels: ['warehouse'], dated: false },
  { id: 'inventory-by-salesman', name: 'Inventory by salesman', description: 'Stock riding with each salesman', section: 'inventory', engine: 'inventory', levels: ['salesman'], dated: false },

  { id: 'loads-by-item', name: 'Loads by item', description: 'What went out on the vans', section: 'loads', engine: 'loads', levels: ['item'], dated: true },
  { id: 'loads-by-salesman', name: 'Loads by salesman', description: 'How much each van was loaded with', section: 'loads', engine: 'loads', levels: ['salesman'], dated: true },
  { id: 'loads-by-date', name: 'Loads by date', description: 'Loading, day by day', section: 'loads', engine: 'loads', levels: ['day'], dated: true },

  { id: 'unloads-by-item', name: 'Unloads by item', description: 'What came back unsold', section: 'unloads', engine: 'unloads', levels: ['item'], dated: true },
  { id: 'unloads-by-salesman', name: 'Unloads by salesman', description: 'What each van brought back', section: 'unloads', engine: 'unloads', levels: ['salesman'], dated: true },
  { id: 'unloads-by-date', name: 'Unloads by date', description: 'Unloading, day by day', section: 'unloads', engine: 'unloads', levels: ['day'], dated: true },
  { id: 'unload-ratio', name: 'Unload ratio', description: 'Share of each load that came back', section: 'unloads', engine: 'unloads', levels: ['salesman'], dated: true, ratio: true },
]

export const DEFAULT_VIEW = VIEWS[0]

export function findView(id: string | null | undefined): ReportView {
  return VIEWS.find((v) => v.id === id) ?? DEFAULT_VIEW
}

/** What each grouping is called on screen and on paper. */
export const DIMENSION_LABELS: Record<string, string> = {
  item: 'Item',
  category: 'Category',
  brand: 'Brand',
  supplier: 'Supplier',
  customer: 'Customer',
  channel: 'Channel',
  region: 'Region',
  salesman: 'Salesman',
  warehouse: 'Warehouse',
  day: 'Day',
  week: 'Week',
  month: 'Month',
}

export const SALES_DIMENSIONS: SalesDimension[] = [
  'item', 'category', 'brand', 'supplier', 'customer', 'channel', 'region', 'salesman', 'warehouse', 'day', 'week', 'month',
]
export const INVENTORY_GROUPS: InventoryGroup[] = ['item', 'warehouse', 'salesman']
export const MOVEMENT_GROUPS: MovementGroup[] = ['salesman', 'item', 'day']

/** The groupings a view's engine can take, in the order the picker offers them. */
export function groupingsFor(engine: Engine): string[] {
  if (engine === 'sales') return SALES_DIMENSIONS
  if (engine === 'inventory') return INVENTORY_GROUPS
  return MOVEMENT_GROUPS
}

export function isDateDimension(dim: string): boolean {
  return dim === 'day' || dim === 'week' || dim === 'month'
}

// ── The window ──────────────────────────────────────────────────────────────

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30'
  | 'this_quarter'
  | 'this_year'
  | 'custom'

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'This month',
  last_month: 'Last month',
  last_30: 'Last 30 days',
  this_quarter: 'This quarter',
  this_year: 'This year',
  custom: 'Custom range',
}

/** `YYYY-MM-DD` in local time — the calendar day the office is living in. */
export function isoDay(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * The dates a preset stands for, as of `now`.
 *
 * Weeks start on Monday — the working week the office plans in, not the
 * calendar grid a US locale would draw.
 */
export function presetRange(preset: PeriodPreset, now: Date = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const shift = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
  const monday = shift(today, -((today.getDay() + 6) % 7))

  switch (preset) {
    case 'today':
      return { from: isoDay(today), to: isoDay(today) }
    case 'yesterday': {
      const y = shift(today, -1)
      return { from: isoDay(y), to: isoDay(y) }
    }
    case 'this_week':
      return { from: isoDay(monday), to: isoDay(today) }
    case 'last_week':
      return { from: isoDay(shift(monday, -7)), to: isoDay(shift(monday, -1)) }
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: isoDay(first), to: isoDay(last) }
    }
    case 'last_30':
      return { from: isoDay(shift(today, -29)), to: isoDay(today) }
    case 'this_quarter': {
      const first = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
      return { from: isoDay(first), to: isoDay(today) }
    }
    case 'this_year':
      return { from: isoDay(new Date(today.getFullYear(), 0, 1)), to: isoDay(today) }
    case 'this_month':
    case 'custom':
    default:
      return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDay(today) }
  }
}
