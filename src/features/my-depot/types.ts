// Contract from App\Http\Resources\V1\Inventory\DepotTransferResource,
// DepotTransferRowResource and DepotStockResource, plus the three request
// classes behind /depot-transfers.
//
// One shape covers all three documents — the load request (LR), the load issue
// (LI) and the acceptance (TRI) — because the backend renders them through one
// resource: the type is a field, not a shape. Nothing here names a direction
// either. The evening's return of unsold stock is a load out of the salesman's
// own depot into the warehouse, so `source` and `destination` are the only
// things that say which way the goods are travelling.

/** LR asks, LI loads out, TRI signs for what turned up. */
export type DepotTransferType = 'LR' | 'LI' | 'TRI'

export type DepotTransferStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED'

/** Either end of a movement. `is_depot` is what tells a depot from a warehouse. */
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
  /** Per base unit, copied off the item when the line was written, so a line's
   *  own weight is this times `qty` — the arithmetic the header's totals are
   *  the sum of. Absent on a document raised before the item was weighed. */
  weight?: number | null
  volume?: number | null
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

export interface LoadRequestPayload {
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
  /** Per base unit, the way an item declares it — `weight` is what one of these
   *  weighs, not what the shelf holds. `total_weight` is the product already
   *  taken, sent when the endpoint has done the multiplication itself. */
  weight?: number | null
  volume?: number | null
  total_weight?: number | null
  total_volume?: number | null
}

/**
 * What a depot may physically carry and what is already against that.
 *
 * Both caps are nullable and every fixed warehouse leaves them so: a cap
 * describes a vehicle, and a building that has never run out of floor has
 * nothing to declare. Goods still on the road count against the cap because
 * they are already this depot's — they land on it whether or not somebody
 * loads it again first, and a projection that ignored them would wave through
 * a second load the first one has already taken the room for.
 */
export interface DepotCapacity {
  max_weight: number | null
  max_volume: number | null
  used_weight: number
  used_volume: number
  in_transit_weight: number
  in_transit_volume: number
  /** What the server calls the same two figures. Both spellings are declared
   *  because the endpoint sends these and older readers here expect the pair
   *  above; the helpers fall back between them rather than trusting one. */
  total_weight?: number
  total_volume?: number
  /** Already worked out server-side, contents plus what is on the road against
   *  the ceiling. Null where nothing has been measured — which is not 0%. */
  weight_pct?: number | null
  volume_pct?: number | null
  over_capacity?: boolean
}

export interface DepotStock {
  warehouse: DepotWarehouseRef
  salesman: DepotSalesmanRef | null
  total_qty: number
  total_available_qty: number
  total_reserved_qty: number
  /** Absent on a warehouse nobody has measured, which reads as uncapped. */
  capacity?: DepotCapacity | null
  items: DepotStockLine[]
}

/**
 * GET /depot-stock — one line per depot, the fleet at a glance.
 *
 * Deliberately without `items`: the point of the row is whether a depot is
 * worth opening, and loading every product of every vehicle to answer that
 * would fetch a few hundred rows to render six.
 */
export interface DepotSummary {
  warehouse: DepotWarehouseRef
  salesman: DepotSalesmanRef | null
  /** Distinct products, not cartons. */
  line_count: number
  total_qty: number
  total_available_qty: number
  total_reserved_qty: number
  capacity?: DepotCapacity | null
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
  return t.trs_type === 'LI' && t.status === 'DRAFT'
}

/** A load can only be signed for between leaving the warehouse and being signed
 *  for — which is exactly the window `is_in_transit` describes. */
export function isAcceptable(t: Pick<DepotTransfer, 'trs_type' | 'status'>): boolean {
  return t.trs_type === 'LI' && t.status === 'CONFIRMED'
}

/** An answered request is answered; a rejection is not overturned into an
 *  approval. */
export function isPendingRequest(t: Pick<DepotTransfer, 'trs_type' | 'status'>): boolean {
  return t.trs_type === 'LR' && t.status === 'DRAFT'
}

/** Approved, so a load may be raised against it. */
export function isApprovedRequest(t: Pick<DepotTransfer, 'trs_type' | 'status'>): boolean {
  return t.trs_type === 'LR' && t.status === 'CONFIRMED'
}

/**
 * Whether the source still has to find these goods.
 *
 * Only worth asking of a document nobody has issued yet: once a load has gone
 * out the stock has already moved, and a line the source could not cover today
 * says nothing about the morning it actually left. A cancelled document asks
 * for nothing at all.
 */
export function awaitsSourceStock(t: Pick<DepotTransfer, 'trs_type' | 'status'>): boolean {
  return isEditableDraft(t) || isPendingRequest(t) || isApprovedRequest(t)
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

// ─── Capacity ───────────────────────────────────────────────────────────────
// A depot's capacity is what the man can physically carry out in the morning,
// so every figure below is about the load leaving rather than about the shelf
// it came off. Stock mostly leaves a depot by being sold, not by coming back,
// which is why nothing here nets a return off against the room it frees.

/** Nonsense — a negative weight, a cap of zero, a figure the API left out —
 *  read as nothing rather than as a bar drawn backwards or a division by zero. */
function nonNegative(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * One bar's worth of arithmetic: what is in there, what is on its way, and how
 * both sit against the cap.
 *
 * The percentages are uncapped so an overload can be spelled out — 118% is the
 * whole point of the figure, and clamping it to 100 would hide exactly the case
 * worth showing. The widths are the clamped pair the bar is actually drawn
 * with, the second segment taking only the room the first left.
 */
export interface CapacityUsage {
  used: number
  incoming: number
  total: number
  /** Null when nobody declared one, which is every fixed warehouse. */
  max: number | null
  uncapped: boolean
  usedPct: number
  incomingPct: number
  totalPct: number
  usedWidth: number
  incomingWidth: number
  /** Strictly past the cap: filling it exactly is not an overload. */
  over: boolean
}

export function capacityUsage(
  used: number | null | undefined,
  incoming: number | null | undefined,
  max: number | null | undefined,
): CapacityUsage {
  const inside = nonNegative(used)
  const travelling = nonNegative(incoming)
  const cap = nonNegative(max)
  const total = inside + travelling
  const uncapped = cap === 0

  const usedPct = uncapped ? 0 : (inside / cap) * 100
  const incomingPct = uncapped ? 0 : (travelling / cap) * 100
  const usedWidth = Math.min(usedPct, 100)

  return {
    used: inside,
    incoming: travelling,
    total,
    max: uncapped ? null : cap,
    uncapped,
    usedPct,
    incomingPct,
    totalPct: usedPct + incomingPct,
    usedWidth,
    incomingWidth: Math.min(incomingPct, 100 - usedWidth),
    over: !uncapped && total > cap,
  }
}

/** The same depot with one more load on it — what a form asks while the load is
 *  still being keyed. It rides in the in-transit segment because that is what it
 *  becomes the moment somebody presses Issue. */
export function withLoad(usage: CapacityUsage, added: number): CapacityUsage {
  return capacityUsage(usage.used, usage.incoming + nonNegative(added), usage.max)
}

/** What a line comes to: the ready-made total when the endpoint sent one, else
 *  the per-base-unit figure times what is on the line. Null when the item has
 *  never been weighed — which is a different fact from weighing nothing. */
export function lineTotal(
  qty: number,
  perUnit?: number | null,
  total?: number | null,
): number | null {
  if (typeof total === 'number' && Number.isFinite(total)) return total
  if (typeof perUnit === 'number' && Number.isFinite(perUnit)) return perUnit * qty
  return null
}

export function stockLineWeight(line: DepotStockLine): number | null {
  return lineTotal(line.qty, line.weight, line.total_weight)
}

export function stockLineVolume(line: DepotStockLine): number | null {
  return lineTotal(line.qty, line.volume, line.total_volume)
}

/** A load being drafted, one line per row: base units and the item's own
 *  per-unit figures, which is exactly how the server totals the document. */
export interface LoadLine {
  qty: number
  weight?: number | null
  volume?: number | null
}

export function loadTotals(lines: LoadLine[]): { weight: number; volume: number } {
  let weight = 0
  let volume = 0

  for (const line of lines) {
    weight += lineTotal(line.qty, line.weight) ?? 0
    volume += lineTotal(line.qty, line.volume) ?? 0
  }

  return { weight, volume }
}

/**
 * What is on the road toward a warehouse: issued, signed for by nobody, and
 * therefore in neither building. Read off the feed rather than asked for,
 * because those documents carry their own totals and the feed is already open
 * on every screen that needs this.
 */
export function inTransitToward(
  transfers: DepotTransfer[],
  warehouseId: number | null | undefined,
): { weight: number; volume: number; count: number } {
  if (!warehouseId) return { weight: 0, volume: 0, count: 0 }

  let weight = 0
  let volume = 0
  let count = 0

  for (const transfer of transfers) {
    if (!transfer.is_in_transit || transfer.destination?.id !== warehouseId) continue
    weight += nonNegative(transfer.total_weight)
    volume += nonNegative(transfer.total_volume)
    count++
  }

  return { weight, volume, count }
}

/**
 * Both bars for one depot.
 *
 * The endpoint's own figures win wherever it has any, since it totals from the
 * same item weights and can see stock this console never fetched. Where it is
 * silent the lines and the movements feed answer instead, so a depot still
 * reports what it is carrying rather than an empty bar.
 */
export function depotUtilisation(
  stock: DepotStock | null | undefined,
  transfers: DepotTransfer[] = [],
): { weight: CapacityUsage; volume: CapacityUsage } {
  const capacity = stock?.capacity
  const lines = stock?.items ?? []

  let contentsWeight = 0
  let contentsVolume = 0
  for (const line of lines) {
    contentsWeight += stockLineWeight(line) ?? 0
    contentsVolume += stockLineVolume(line) ?? 0
  }

  const travelling = inTransitToward(transfers, stock?.warehouse?.id)
  const prefer = (server: number | null | undefined, derived: number) =>
    nonNegative(server) > 0 ? nonNegative(server) : derived

  return {
    weight: capacityUsage(
      prefer(capacity?.used_weight, contentsWeight),
      prefer(capacity?.in_transit_weight, travelling.weight),
      capacity?.max_weight,
    ),
    volume: capacityUsage(
      prefer(capacity?.used_volume, contentsVolume),
      prefer(capacity?.in_transit_volume, travelling.volume),
      capacity?.max_volume,
    ),
  }
}

// ─── Presentation ───────────────────────────────────────────────────────────

/**
 * The `status` and `label` a StatusPill takes, read off both type and status:
 * a confirmed request is approved, a confirmed load is still on the road.
 *
 * The only place any document's status is put into words — the table, the
 * detail page and the modals all render what this returns, so a wording nobody
 * agreed on cannot appear on one screen and not another. The wire values are
 * untouched: DRAFT is still DRAFT everywhere it is sent, filtered or stored.
 */
export function transferPill(
  t: Pick<DepotTransfer, 'trs_type' | 'status'>,
): { status: string; label: string } {
  if (t.trs_type === 'LR') {
    if (t.status === 'DRAFT') return { status: 'pending', label: 'Requested' }
    // Deliberately not "Approved" and deliberately not "Load created". Answering
    // a request means building the load in the same drawer, so by the time anyone
    // reads this a load exists and is on its way — which is what the salesman's
    // phone says too. One vocabulary for one document.
    if (t.status === 'CONFIRMED') return { status: 'warning', label: 'Load issued' }
    return { status: 'error', label: 'Rejected' }
  }

  if (t.trs_type === 'TRI') return { status: 'success', label: 'Received' }

  // Three words carry the whole flow: requested, load issued, received. Whether a
  // load has physically left the building is a distinction the warehouse can see
  // for itself and nobody acts on differently, so a draft and an issued load read
  // the same here rather than inventing a fourth state.
  if (t.status === 'DRAFT') return { status: 'warning', label: 'Load issued' }
  if (t.status === 'CONFIRMED') return { status: 'warning', label: 'Load issued' }
  if (t.status === 'COMPLETED') return { status: 'success', label: 'Received' }
  return { status: 'inactive', label: 'Cancelled' }
}

export const TYPE_LABELS: Record<DepotTransferType, string> = {
  LR: 'Load request',
  LI: 'Load issue',
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

/** The units both caps are declared in. */
export const WEIGHT_UNIT = 'kg'
export const VOLUME_UNIT = 'm³'

// Bare figures, unit-free: a pair reads "1,040 / 1,200 kg", with the unit
// written once at the end rather than against each half of a comparison.
const weightFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
// Three places, because a case of biscuits is a few thousandths of a cubic
// metre and rounding it away would make every small line read as nothing.
const volumeFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

export function formatWeight(value: number): string {
  return weightFmt.format(value)
}

export function formatVolume(value: number): string {
  return volumeFmt.format(value)
}

/** Whole percent — nobody loads a truck to a tenth of one. */
export function formatPercent(pct: number): string {
  return `${Math.round(pct)}%`
}
