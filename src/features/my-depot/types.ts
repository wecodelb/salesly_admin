// Contract from App\Http\Resources\V1\Inventory\DepotTransferResource,
// DepotTransferRowResource and DepotStockResource, plus the three request
// classes behind /depot-transfers.
//
// One shape covers all three documents — the refill request (TRR), the issue
// (TRO) and the acceptance (TRI) — because the backend renders them through one
// resource: the type is a field, not a shape. Nothing here names a direction
// either. The evening's return of unsold stock is a load out of the salesman's
// own depot into the warehouse, so `source` and `destination` are the only
// things that say which way the goods are travelling.

/** TRR asks, TRO loads out, TRI signs for what turned up. */
export type DepotTransferType = 'TRR' | 'TRO' | 'TRI'

export type DepotTransferStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED'

/** Either end of a movement. `is_depot` is what tells a warehouse from a van. */
export interface DepotWarehouseRef {
  id: number | null
  code: string | null
  name: string | null
  is_depot: boolean
}

export interface DepotSalesmanRef {
  id: number | null
  name: string | null
}

export interface DepotTransferRow {
  id: number
  lno: number
  item_id: number
  item_code: string
  item_name: string
  /** The packaging the quantity was keyed in, and how many base units it holds. */
  uom_id: number
  uom_name: string
  unit: number
  /** In the packaging above; `qty` is the same line in base units. */
  trs_qty: number
  qty: number
  /** The source on an issue, the destination on an acceptance. */
  warehouse_id: number | null
  /** All three in base units, and written only by an acceptance — null on a
   *  request or an issue. */
  issued_qty: number | null
  accepted_qty: number | null
  shortfall_qty: number | null
  line_memo: string | null
}

/** The document this one came from: the request behind an issue, the issue
 *  behind an acceptance. */
export interface DepotSourceDocument {
  id: number
  trs_type: DepotTransferType
  trs_number: string
  trs_date: string | null
  status: DepotTransferStatus | null
}

/** The acceptance raised against an issue — the proof it landed. */
export interface DepotAcceptanceRef {
  id: number
  trs_number: string
  trs_date: string | null
  total_qty: number
  discrepancy_qty: number
}

export interface DepotTransfer {
  id: number
  company_id: number
  uuid: string | null
  trs_type: DepotTransferType
  trs_number: string
  /** `d/m/Y H:i` — see parseApiDate below. */
  trs_date: string | null
  status: DepotTransferStatus | null
  /** Issued and not yet signed for: gone from the source, not yet in the depot. */
  is_in_transit: boolean
  source: DepotWarehouseRef
  destination: DepotWarehouseRef
  /** Whose depot the load is for, kept apart from who keyed it. */
  salesman: DepotSalesmanRef
  created_by: number | null
  created_by_name: string | null
  confirmed_at: string | null
  confirmed_by: number | null
  confirmed_by_name: string | null
  total_qty: number
  total_cost: number
  total_weight: number
  total_volume: number
  /** How far an acceptance fell short, in base units. Null on the other two. */
  discrepancy_qty: number | null
  src_type: string | null
  src_id: number | null
  source_document?: DepotSourceDocument | null
  acceptance?: DepotAcceptanceRef | null
  memo: string | null
  created_at: string | null
  updated_at: string | null
  /** Detail only — a page of transfers is a page of headers. */
  rows?: DepotTransferRow[]
}

export interface DepotTransferRowPayload {
  item_id: number
  uom_id: number
  /** In the packaging named by uom_id; the server resolves the multiplier. */
  qty: number
  line_memo?: string
}

export interface CreateDepotTransferPayload {
  /** The approved request this load answers. Naming it makes the other three
   *  keys optional — both ends and the lines come off the request. */
  from_request_id?: number | null
  warehouse_id?: number | null
  /** Omitted when `salesman_id` is sent: the server resolves his depot. */
  des_warehouse_id?: number | null
  salesman_id?: number | null
  trs_date?: string
  memo?: string
  /** Sending the key replaces the whole row set; omitting it on an edit leaves
   *  the lines — and their reservation — alone. */
  rows?: DepotTransferRowPayload[]
}

export type UpdateDepotTransferPayload = CreateDepotTransferPayload

export interface RefillRequestPayload {
  salesman_id?: number | null
  warehouse_id?: number | null
  trs_date?: string
  memo?: string
  rows: DepotTransferRowPayload[]
}

export interface AcceptTransferRowPayload {
  row_id: number
  /** In the same packaging the line was issued in, and never above it. */
  qty: number
  note?: string
}

export interface AcceptTransferPayload {
  /** Omitting the key signs for the load exactly as issued; omitting one line
   *  accepts that line in full. Only disputed lines need saying. */
  rows?: AcceptTransferRowPayload[]
  trs_date?: string
  memo?: string
}

/** One line of what a warehouse is holding, all three figures in base units. */
export interface DepotStockLine {
  item_id: number
  item_code: string
  item_name: string
  uom_id: number | null
  uom_name: string
  qty: number
  available_qty: number
  reserved_qty: number
}

export interface DepotStock {
  warehouse: DepotWarehouseRef
  salesman: DepotSalesmanRef | null
  total_qty: number
  total_available_qty: number
  total_reserved_qty: number
  items: DepotStockLine[]
}

/** GET /warehouses — id, code and name are all WarehouseResource carries. */
export interface WarehouseOption {
  id: number
  code: string
  name: string
}

/**
 * A depot the console has learned about, and the salesman who holds it.
 *
 * There is no endpoint that lists depots: GET /warehouses is scoped to the
 * warehouses the caller is assigned to and its resource carries no `is_depot`,
 * so the only place a depot names itself is on a transfer that moved through
 * one. The directory is therefore read back off the movements feed.
 */
export interface DepotDirectoryEntry {
  warehouse: DepotWarehouseRef
  salesman: DepotSalesmanRef
}

// ─── Document state ─────────────────────────────────────────────────────────
// Which button a document's status allows. The backend refuses the rest with a
// 422, so these only decide what is worth offering — but offering an action
// that cannot succeed is how a screen teaches the wrong model of the flow.

/** Only a draft load can still be edited, deleted, issued or cancelled: once it
 *  has gone out the goods have left the shelf. */
export function isEditableDraft(t: Pick<DepotTransfer, 'trs_type' | 'status'>): boolean {
  return t.trs_type === 'TRO' && t.status === 'DRAFT'
}

/** A load can only be signed for between leaving the warehouse and being signed
 *  for — which is exactly the window `is_in_transit` describes. */
export function isAcceptable(t: Pick<DepotTransfer, 'trs_type' | 'status'>): boolean {
  return t.trs_type === 'TRO' && t.status === 'CONFIRMED'
}

/** An answered request is answered; a rejection is not overturned into an
 *  approval. */
export function isPendingRequest(t: Pick<DepotTransfer, 'trs_type' | 'status'>): boolean {
  return t.trs_type === 'TRR' && t.status === 'DRAFT'
}

/** Approved, so a load may be raised against it. */
export function isApprovedRequest(t: Pick<DepotTransfer, 'trs_type' | 'status'>): boolean {
  return t.trs_type === 'TRR' && t.status === 'CONFIRMED'
}

// ─── Acceptance arithmetic ──────────────────────────────────────────────────

/**
 * What the receiver may sign for on one line: never more than left the
 * warehouse, never less than nothing.
 *
 * The ceiling is the whole point — the backend answers "Accepted quantity
 * exceeds the quantity issued for item X" and refuses the document, so a
 * counter that lets the figure past the issued quantity only fails later.
 * A blank or unparseable box counts as zero rather than as the issued figure:
 * clearing the field is how someone says nothing arrived.
 */
export function clampAccepted(entered: number, issued: number): number {
  if (!Number.isFinite(entered) || entered < 0) return 0
  return Math.min(entered, issued)
}

/** What did not turn up, in whatever unit the two figures are in. Never
 *  negative: an over-count is clamped away before it reaches here. */
export function shortfallOf(issued: number, accepted: number): number {
  return Math.max(0, issued - accepted)
}

/**
 * How much of each item, in base units, a load being drafted may draw on at its
 * source — item_id → base units.
 *
 * `available_qty` is what the source can still promise, and a draft has already
 * taken its own lines out of that figure. Editing one therefore has to hand its
 * claim back first, exactly as the backend does before re-checking: without
 * this, lowering a line on a load that swept the shelf clean would be refused
 * by a check run against stock that very load is holding.
 */
export function sourceAvailability(
  stock: DepotStockLine[],
  heldByDraft: DepotTransferRow[] = [],
): Map<number, number> {
  const available = new Map<number, number>()

  for (const line of stock) available.set(line.item_id, line.available_qty)

  for (const row of heldByDraft) {
    if (!row.item_id) continue
    available.set(row.item_id, (available.get(row.item_id) ?? 0) + row.qty)
  }

  return available
}

// ─── Presentation ───────────────────────────────────────────────────────────

/** The `status` and `label` a StatusPill takes, read off both type and status:
 *  a confirmed request is approved, a confirmed load is still on the road. */
export function transferPill(
  t: Pick<DepotTransfer, 'trs_type' | 'status'>,
): { status: string; label: string } {
  if (t.trs_type === 'TRR') {
    if (t.status === 'DRAFT') return { status: 'pending', label: 'Awaiting approval' }
    if (t.status === 'CONFIRMED') return { status: 'success', label: 'Approved' }
    return { status: 'error', label: 'Rejected' }
  }

  if (t.trs_type === 'TRI') return { status: 'success', label: 'Received' }

  if (t.status === 'DRAFT') return { status: 'draft', label: 'Draft' }
  if (t.status === 'CONFIRMED') return { status: 'warning', label: 'In transit' }
  if (t.status === 'COMPLETED') return { status: 'success', label: 'Delivered' }
  return { status: 'inactive', label: 'Cancelled' }
}

export const TYPE_LABELS: Record<DepotTransferType, string> = {
  TRR: 'Refill request',
  TRO: 'Load out',
  TRI: 'Acceptance',
}

/**
 * The API formats every timestamp as `d/m/Y H:i` (DateTimeHelper), which
 * `new Date()` reads as month-first and silently mangles — 03/11 becomes March
 * rather than the 3rd of November. Parsed by hand so the date filters and the
 * "accepted today" count are counting the right days.
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null

  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/.exec(value.trim())
  if (!match) return null

  const [, day, month, year, hour, minute] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
  )

  // A rolled-over month means the day never existed — 31/02 arriving as the 3rd
  // of March would quietly file the document under the wrong day.
  return date.getMonth() === Number(month) - 1 ? date : null
}

/** `yyyy-mm-dd`, the shape both the date inputs and the endpoint's
 *  date_from/date_to speak. */
export function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Whether a document's date falls inside a `yyyy-mm-dd` range, either end of
 *  which may be blank. Compared as whole days, like the backend's whereDate. */
export function withinDateRange(value: string | null, from: string, to: string): boolean {
  if (!from && !to) return true

  const date = parseApiDate(value)
  if (!date) return false

  const day = toDateInput(date)
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

const qtyFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatQty(value: number): string {
  return qtyFmt.format(value)
}
