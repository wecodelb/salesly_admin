/**
 * Stock adjustments as the console reads them.
 *
 * An adjustment is a *sheet*, not a movement: somebody walks the aisle, finds
 * three broken crates and an expired pallet, and writes them down together. One
 * sheet, several rows, each row its own type — which is why the list shows the
 * types as badges rather than a single label.
 *
 * The rule everything here turns on: **stock follows the approved flag**.
 * Entering `approved` applies every row to the shelf; leaving it puts every row
 * back. A pending sheet is a claim about the shelf, not a fact about it, and
 * nothing on this screen should imply otherwise.
 */

/** Which way stock may move under a type. A property of the type, not a default. */
export type AdjustmentDirection = 'in' | 'out' | 'both'

/** Written down, signed off, or refused. */
export type AdjustmentStatus = 'pending' | 'approved' | 'rejected'

export interface AdjustmentType {
  id: number
  code: string
  name: string
  /**
   * `out` means there is no such thing as this arriving — damaged stock, for
   * instance. The drawer must not offer the other way, and the server refuses
   * it regardless.
   */
  direction: AdjustmentDirection
  is_active: boolean
  /** Seeded with the company: renameable, switchable, never deletable. */
  is_system: boolean
  sort_order: number
  memo: string
  /** How many rows have been written under it — what makes switching it off a decision. */
  rows_count?: number
}

export interface AdjustmentRow {
  id: number
  lno: number
  adjustment_type_id: number
  type?: { id: number; code: string; name: string; direction: AdjustmentDirection }

  item_id: number
  item_code: string
  item_name: string

  uom_id: number | null
  uom_name: string
  /** What was counted, in the packaging it was counted in — four cases. */
  trs_qty: number
  /** The factor back to base units. */
  unit: number
  /** And the same quantity in base units, which is what moves — ninety-six bottles. */
  qty: number

  direction: 'in' | 'out'

  /**
   * What the shelf held either side of this row, recorded when it was applied.
   * Null until the sheet is approved — which is exactly what tells a reader
   * whether this row has happened yet.
   */
  qty_before: number | null
  qty_after: number | null

  memo: string
}

export interface Adjustment {
  id: number
  number: number
  /** `d/m/Y H:i` — see parseApiDate in the reports formatter. */
  adjusted_at: string | null

  warehouse_id: number
  warehouse: string

  status: AdjustmentStatus
  approved_at: string | null
  approved_by?: { id: number; name: string } | null
  created_by?: { id: number; name: string } | null

  memo: string

  rows_count?: number
  /** The distinct types on the sheet, for the badges on a list row. */
  types?: { id: number; code: string; name: string }[]
  /** Net movement in base units, signed: two in and three out is minus one. */
  net_qty?: number

  /** Present on the single-sheet read; the list carries headers and badges. */
  rows?: AdjustmentRow[]
}

export interface AdjustmentPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface AdjustmentPage {
  adjustments: Adjustment[]
  pagination: AdjustmentPagination | null
}

export interface AdjustmentFilters {
  status?: string | null
  warehouseId?: number | null
  adjustmentTypeId?: number | null
  itemId?: number | null
  dateFrom?: string | null
  dateTo?: string | null
  search?: string | null
  page?: number
  perPage?: number
}

/** One row on the way to the server. */
export interface AdjustmentRowPayload {
  adjustment_type_id: number
  item_id: number
  uom_id?: number | null
  qty: number
  /** Only sent for a type that allows both — the server refuses a contradiction. */
  direction?: 'in' | 'out' | null
  memo?: string
}

export interface AdjustmentPayload {
  warehouse_id: number
  adjusted_at?: string | null
  memo?: string
  rows: AdjustmentRowPayload[]
}

// ─── Reading a sheet ────────────────────────────────────────────────────────

/** The rows on a sheet, guarded — a missing key must not take a screen down. */
export function rowsOf(adjustment: Adjustment): AdjustmentRow[] {
  return Array.isArray(adjustment.rows) ? adjustment.rows : []
}

/** The distinct types on a sheet, guarded the same way. */
export function typesOf(adjustment: Adjustment): { id: number; code: string; name: string }[] {
  return Array.isArray(adjustment.types) ? adjustment.types : []
}

/** Whether the stock on this sheet has actually moved. */
export function hasMovedStock(adjustment: Adjustment): boolean {
  return adjustment.status === 'approved'
}

/**
 * Whether this sheet can still be changed.
 *
 * Mirrors the server: an approved sheet's rows are on the shelf, so editing it
 * would move stock a second time. The way back is to reject it.
 */
export function isEditable(adjustment: Adjustment): boolean {
  return adjustment.status !== 'approved'
}

/** How a status reads, and how loudly. */
export function statusPill(adjustment: Adjustment): { status: string; label: string } {
  if (adjustment.status === 'approved') return { status: 'active', label: 'Approved' }
  if (adjustment.status === 'rejected') return { status: 'error', label: 'Rejected' }

  // Deliberately not "Draft": it has been written and is waiting on a person,
  // which is a different thing from being unfinished.
  return { status: 'pending', label: 'Awaiting approval' }
}

/** What a direction reads as on a row. */
export function directionLabel(direction: string | null | undefined): string {
  if (direction === 'out') return 'Out'
  if (direction === 'in') return 'In'
  return '—'
}

/** Which way a type lets a row go, in words, for the drawer. */
export function directionOptions(
  type: AdjustmentType | undefined,
): { value: 'in' | 'out'; label: string }[] {
  if (!type) return []
  if (type.direction === 'in') return [{ value: 'in', label: 'In' }]
  if (type.direction === 'out') return [{ value: 'out', label: 'Out' }]

  return [
    { value: 'in', label: 'In' },
    { value: 'out', label: 'Out' },
  ]
}

// ─── Totals ─────────────────────────────────────────────────────────────────

export function formatQty(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/** A signed quantity, so a reader can see at a glance which way it went. */
export function formatSigned(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const figure = formatQty(Math.abs(value))

  return value < 0 ? `−${figure}` : value > 0 ? `+${figure}` : figure
}

export interface AdjustmentTotals {
  /** Sheets on screen. */
  count: number
  /** Of those, how many have actually moved stock. */
  approved: number
  /** And how many are waiting on somebody. */
  pending: number
  /** Base units added, across every approved sheet being shown. */
  addedIn: number
  /** Base units taken away. */
  takenOut: number
}

/**
 * Totalled over the rows on screen.
 *
 * In and out are kept apart rather than netted, because a day that added a
 * thousand and lost a thousand is not the same day as one where nothing
 * happened — and a single net figure of zero would say it was.
 *
 * Only approved sheets count toward the quantities: a pending sheet has moved
 * nothing, and folding it in would make the strip describe a shelf that does
 * not exist.
 */
export function totalsOf(adjustments: Adjustment[]): AdjustmentTotals {
  let approved = 0
  let pending = 0
  let addedIn = 0
  let takenOut = 0

  for (const adjustment of adjustments) {
    if (adjustment.status === 'approved') approved += 1
    if (adjustment.status === 'pending') pending += 1
    if (adjustment.status !== 'approved') continue

    for (const row of rowsOf(adjustment)) {
      const qty = Number.isFinite(row.qty) ? row.qty : 0
      if (row.direction === 'out') takenOut += qty
      else addedIn += qty
    }
  }

  return {
    count: adjustments.length,
    approved,
    pending,
    addedIn: Math.round(addedIn * 10000) / 10000,
    takenOut: Math.round(takenOut * 10000) / 10000,
  }
}
