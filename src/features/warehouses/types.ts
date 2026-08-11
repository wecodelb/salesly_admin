// Contract from App\Http\Resources\V1\Inventory\WarehouseResource and the rules
// in App\Http\Requests\V1\Inventory\WarehouseRequest.
//
// One shape covers both kinds of location, because the backend stores them in
// one table: a fixed warehouse is a building a whole team picks from, a depot is
// the stock one salesman is driving around with. `is_depot` is the only thing
// that tells them apart, and almost every rule below hangs off it.

export interface WarehouseSalesman {
  id: number | null
  name: string | null
}

export interface Warehouse {
  id: number
  uuid: string | null
  code: string
  name: string
  /** Empty string rather than null on a warehouse nobody has placed — the
   *  column is NOT NULL with a blank default. */
  location: string
  /** The company territory it sits in, picked rather than typed so places can
   *  be grouped. Null on a warehouse nobody has placed in one. */
  area_id: number | null
  area_name?: string | null
  is_depot: boolean
  /** The one a document is filled from when it names no source. Exactly one per
   *  company, which the backend keeps true by turning the previous one off. */
  is_main: boolean
  /** Whose depot this is. Null on every fixed warehouse, and also on a depot
   *  nobody is currently assigned to. */
  salesman: WarehouseSalesman | null
  /** What may be carried out, null where nobody has measured it — which is a
   *  different fact from a ceiling of zero. */
  max_weight: number | null
  max_volume: number | null
}

/**
 * `is_depot` is deliberately absent: a depot exists because a salesman does.
 * The backend raises one inside the same transaction that creates his account
 * and names it after him, so a console that could mint one would only produce
 * vehicles with nobody driving them.
 */
export interface CreateWarehousePayload {
  code: string
  name: string
  location?: string
  area_id?: number | null
  is_main?: boolean
  max_weight?: number | null
  max_volume?: number | null
}

export type UpdateWarehousePayload = Partial<CreateWarehousePayload>

// ─── What may be edited ─────────────────────────────────────────────────────

/**
 * A depot's code and name belong to the system.
 *
 * They were written when the salesman's account was opened and they say who he
 * is — every load screen and every filtered list reads that name back. The
 * backend refuses a genuine change to either with a 422, so the form renders
 * them read-only rather than letting somebody type into a field that cannot be
 * saved.
 */
export function hasSystemOwnedIdentity(warehouse: Pick<Warehouse, 'is_depot'>): boolean {
  return warehouse.is_depot
}

/**
 * Why the backend would refuse to delete this one, or null where it would allow
 * it.
 *
 * Both refusals are 422s and both are worth pre-empting: the delete is simply
 * not offered where one applies, since an action that can only fail teaches the
 * wrong model of what a warehouse is.
 */
export function deleteBlockedReason(warehouse: Warehouse): string | null {
  if (warehouse.is_main) {
    return 'This is the main warehouse — every document that names no source comes out of it. Make another warehouse the main one first.'
  }

  // The ledger rows cascade with the warehouse, so deleting a depot somebody is
  // still driving would take his stock down with it while the goods are on the
  // vehicle.
  if (warehouse.is_depot && warehouse.salesman?.name) {
    return `${warehouse.salesman.name} is still driving this depot. Unassign it from him before deleting it.`
  }

  return null
}

// ─── Presentation ───────────────────────────────────────────────────────────

/** The units both ceilings are declared in. */
export const WEIGHT_UNIT = 'kg'
export const VOLUME_UNIT = 'm³'

const weightFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
// Three places, because a case of biscuits is a few thousandths of a cubic
// metre and rounding it away would make every small figure read as nothing.
const volumeFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

export function formatWeight(value: number): string {
  return weightFmt.format(value)
}

export function formatVolume(value: number): string {
  return volumeFmt.format(value)
}

/**
 * The two ceilings as one line, or null where neither was ever measured.
 *
 * A missing figure is left out rather than printed as a zero: an uncapped
 * warehouse holds as much as fits, and "0 kg" would read as one that can hold
 * nothing at all.
 */
export function capacityLine(warehouse: Warehouse): string | null {
  const parts: string[] = []

  if (warehouse.max_weight != null) parts.push(`${formatWeight(warehouse.max_weight)} ${WEIGHT_UNIT}`)
  if (warehouse.max_volume != null) parts.push(`${formatVolume(warehouse.max_volume)} ${VOLUME_UNIT}`)

  return parts.length > 0 ? parts.join(' · ') : null
}
