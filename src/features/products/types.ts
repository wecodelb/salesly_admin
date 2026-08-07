// Contract from backend part 2 (Products & dual currency). The item endpoint
// returns the USD price, the LBP conversion, the live exchange rate, stock, and
// the active promotion block. Create/update reuse the existing ItemRequest,
// which requires uuid + uom_id + cost + price.

export interface ItemPromo {
  id: number
  type: 'percent' | 'amount'
  value: number
  price_usd: number
  price_lbp: number
}

export interface ItemCurrency {
  id: number
  code: string
  symbol: string | null
}

/**
 * A packaging variant — "1 Box = 24 Pieces". Each carries its own three price
 * tiers, because a box rarely costs exactly twenty-four times a piece.
 */
export interface AdminItemUom {
  id?: number
  uom_id: number
  uom?: { id: number; code: string; name: string }
  /** How many base units this packaging holds. */
  unit: number
  /** Which packaging the mobile app converts quantities against. Returned by
   *  the backend, which picks the first one; the admin never sets it, so the
   *  form doesn't have to carry a field nobody fills in. */
  is_base?: boolean
  cost: number
  price_1: number
  price_2: number
  price_3: number
  weight: number
  volume: number
  barcodes: string[]
}

export interface AdminItem {
  id: number
  uuid?: string
  code: string
  name: string
  name2?: string | null
  image?: string
  category: string
  category_id: number | null
  brand?: string
  brand_id?: number | null
  /** Legacy single price (USD) — kept for compatibility. */
  price: number
  price_usd: number
  price_lbp: number | null
  exchange_rate: number | null
  /** Multi-tier pricing: one currency governs all three tiers (e.g.
   *  retail/wholesale/distributor). */
  currency_id?: number | null
  currency?: ItemCurrency | null
  price_1: number
  price_2: number
  price_3: number
  /** Barcodes across the item's packaging variants (flattened). */
  barcodes?: string[]
  /** The variants themselves, each with its own tiers and barcodes. */
  uoms?: AdminItemUom[]
  weight?: number
  volume?: number
  /** On-hand quantity. */
  stock: number
  available_qty: number
  reserved_qty?: number
  cost: number
  uom?: string
  uom_id?: number | null
  promo: ItemPromo | null
}

export interface CreateItemPayload {
  uuid: string
  code: string
  name: string
  uom_id: number
  cost: number
  price: number
  price_lbp?: number | null
  category_id?: number | null
  brand_id?: number | null
  available_qty?: number
  currency_id?: number | null
  price_1?: number
  price_2?: number
  price_3?: number
  weight?: number
  volume?: number
  barcodes?: string[]
  /** Sending this replaces the whole variant set; omitting it leaves it alone. */
  uoms?: ItemUomPayload[]
}

export interface ItemUomPayload {
  id?: number
  uom_id: number
  unit: number
  is_base?: boolean
  cost?: number
  price_1?: number
  price_2?: number
  price_3?: number
  weight?: number
  volume?: number
  barcodes?: string[]
}

/**
 * The three price tiers, labelled the way the business talks about them.
 * price_1/2/3 stay the wire names the backend uses.
 */
export const PRICE_TIERS = [
  { key: 'price_1', label: 'Retail price' },
  { key: 'price_2', label: 'Wholesale price' },
  { key: 'price_3', label: 'Distribution price' },
] as const

export type UpdateItemPayload = Partial<CreateItemPayload>

export interface Category {
  id: number
  code: string
  name: string
  /** Products filed under it — sent by the list endpoint, absent on pickers. */
  items_count?: number
}

export interface Brand {
  id: number
  code: string
  name: string
  /** Products carrying it — sent by the list endpoint, absent on pickers. */
  items_count?: number
}

export interface Currency {
  id: number
  code: string
  name: string
  symbol: string | null
  /** How to render an amount: digits shown, and which side the symbol sits on. */
  decimal_places: number
  symbol_position: 'before' | 'after'
  /** The company's local currency — rates are always "1 local = X of this". */
  is_base: boolean
  is_active: boolean
}

export interface UomOption {
  id: number
  code: string
  name: string
  /** Products whose base unit this is — list endpoint only. */
  items_count?: number
  /** Packaging variants measured in it — list endpoint only. */
  packagings_count?: number
}

const usdFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const lbpFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatUsd(v: number): string {
  return v < 0 ? `-$${usdFmt.format(Math.abs(v))}` : `$${usdFmt.format(v)}`
}

export function formatLbp(v: number): string {
  return `${lbpFmt.format(v)} LL`
}

/** The USD price actually charged — the promo price when one is active. */
export function effectiveUsd(item: AdminItem): number {
  return item.promo?.price_usd ?? item.price_usd
}

// ─── Where the stock is ─────────────────────────────────────────────────────

/**
 * The place a quantity sits in. `is_depot` is the whole distinction: a depot is
 * a salesman's own stock, riding with him, while a fixed warehouse is a shelf
 * anybody can pick from.
 */
export interface DistributionWarehouse {
  id: number
  code: string
  name: string
  is_depot: boolean
  /** What the location may carry, null where nobody has measured it. */
  max_weight: number | null
  max_volume: number | null
  /** The salesman a depot belongs to. Fixed warehouses have no single owner,
   *  and the endpoint doesn't name one on every payload, so the panel treats
   *  his name as a bonus rather than something to lay out around. */
  salesman?: { id: number | null; name: string | null } | null
}

/**
 * One product's stock in one location.
 *
 * The three figures are not interchangeable. `qty` is what is physically there;
 * `reserved_qty` is the part of it a draft order or a drafted load has already
 * claimed — still on the shelf, no longer sellable; `available_qty` is what is
 * left to promise. A location can be holding cartons and have nothing to sell.
 */
export interface ItemDistribution {
  /** Rendered by the API only when the relation is loaded, so a payload from an
   *  older build can arrive with quantities and nowhere to put them. */
  warehouse?: DistributionWarehouse | null
  qty: number
  available_qty: number
  reserved_qty: number
}

/** A figure the API left out, or sent as text, reads as nothing rather than
 *  turning every total downstream into NaN. */
function qtyOf(value: number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export interface DistributionTotals {
  qty: number
  available_qty: number
  reserved_qty: number
  /** The share riding in depots — visible, countable, and not on any shelf the
   *  warehouse can pick from. */
  depot_qty: number
  locations: number
  depots: number
}

/**
 * The item's position across every location it is stocked in.
 *
 * Each figure is summed in its own right rather than derived from the others:
 * available is what the locations themselves report, so a backend that nets a
 * reservation differently is reflected instead of contradicted.
 */
export function distributionTotals(rows: ItemDistribution[]): DistributionTotals {
  const totals: DistributionTotals = {
    qty: 0,
    available_qty: 0,
    reserved_qty: 0,
    depot_qty: 0,
    locations: 0,
    depots: 0,
  }

  for (const row of rows) {
    const qty = qtyOf(row.qty)
    totals.qty += qty
    totals.available_qty += qtyOf(row.available_qty)
    totals.reserved_qty += qtyOf(row.reserved_qty)
    totals.locations++

    if (row.warehouse?.is_depot) {
      totals.depots++
      totals.depot_qty += qty
    }
  }

  return totals
}

/**
 * How one location reads at a glance.
 *
 * Nothing free is not the same as nothing there. A location whose stock is
 * entirely spoken for still holds every carton it holds, and calling that out
 * of stock would either hide it from a manager chasing supply or, worse, let a
 * salesman promise cartons another order has already claimed.
 */
export function distributionPill(row: ItemDistribution): { status: string; label: string } {
  const qty = qtyOf(row.qty)
  const available = qtyOf(row.available_qty)

  if (qty <= 0) return { status: 'error', label: 'Out of stock' }
  if (available <= 0) return { status: 'warning', label: 'Fully committed' }
  if (available < qty) return { status: 'active', label: `${formatQty(available)} free` }
  return { status: 'active', label: 'Available' }
}

/**
 * The most useful sentence on the panel — "Ahmad Khalil is carrying 12".
 *
 * Only a depot has somebody standing behind its stock, and only when the API
 * names him: falling back to the depot's own name would just repeat the line
 * above it, which the Depot pill has already explained.
 */
export function carrierLine(row: ItemDistribution): string | null {
  const name = row.warehouse?.is_depot ? row.warehouse.salesman?.name : null
  return name ? `${name} is carrying ${formatQty(qtyOf(row.qty))}` : null
}

const qtyFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** Quantities are doubles on the wire — cases split into halves — but read as
 *  whole cartons nearly always, so trailing zeros are dropped. */
export function formatQty(value: number): string {
  return qtyFmt.format(value)
}
