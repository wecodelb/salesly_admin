// Contract from backend part 1 (see Phase-2-Planning): CustomerResource plus
// the phase-2 columns — salesman_id, latitude/longitude, credit_limit,
// balance. The backend developer is implementing that part; until it lands
// the hooks serve mock data shaped exactly like this, so flipping the switch
// in hooks/use-customers.ts is the only wiring step left.
export interface CustomerAddress {
  id?: number
  label: string | null
  address: string
  /** The territory this particular place sits in — a customer's addresses are
   *  not always in the same one. The primary address's area is what the
   *  backend mirrors onto `AdminCustomer.area_id`. */
  area_id?: number | null
  area_name?: string | null
  latitude?: number | null
  longitude?: number | null
  is_primary: boolean
}

export interface CustomerAttachment {
  id: number
  name: string
  mime_type: string | null
  size_bytes: number
  url: string | null
  uploaded_by?: string | null
  created_at?: string
}

export interface AdminCustomer {
  id: number
  code: string
  name: string
  phone1: string
  phone2: string
  email: string
  /** Mirrors whichever address is flagged primary. */
  address: string
  /** Salesman this customer is assigned to; null = unassigned. */
  salesman_id: number | null
  /** Resolved name for display (mock mode resolves locally; backend part 1
   *  returns it on the resource). */
  salesman_name: string | null
  /** Whether this customer may owe money at all. Absent on rows written before
   *  the column existed, and those customers have credit. */
  allow_credit?: boolean
  credit_limit: number | null
  /** Outstanding amount the customer owes (positive = due). */
  balance: number
  latitude?: number | null
  longitude?: number | null
  /** Sales territory. */
  area_id?: number | null
  area_name?: string | null
  /** The company's own grouping (Preferences > Customer groups). Null means
   *  nobody has grouped this customer yet. Separate from `is_active`, which
   *  stays the hard on/off switch. */
  customer_group_id?: number | null
  customer_group_name?: string | null
  /** Billing currency. */
  currency_id?: number | null
  currency_code?: string | null
  /** Which of an item's three tiers this customer is billed at. The backend
   *  always sends one, defaulting to retail. */
  price_level?: PriceLevel
  /** Lifecycle. Deactivating hides a customer from day-to-day work; deleting
   *  is soft, so `deleted_at` set means "in the bin, restorable". */
  is_active: boolean
  is_verified: boolean
  verified_at?: string | null
  verified_by_name?: string | null
  deleted_at?: string | null
  addresses?: CustomerAddress[]
  attachments?: CustomerAttachment[]
  /** Price lists manually assigned to this customer (on top of the company's
   *  default list). */
  price_lists?: { id: number; name: string; is_default: boolean }[]
  created_at?: string
  updated_at?: string
}

export interface SalesmanOption {
  id: number
  name: string
}

/**
 * Which of an item's three price tiers a customer is billed at — retail reads
 * `price_1`, wholesale `price_2`, distribution `price_3`. Mirrors
 * App\Models\Customer::PRICE_LEVELS.
 *
 * Not to be confused with a price list, which overrides individual item prices
 * for one customer; the level picks the tier every other item is read at.
 */
export type PriceLevel = 'retail' | 'wholesale' | 'distribution'

export const PRICE_LEVEL_OPTIONS: { value: PriceLevel; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'distribution', label: 'Distribution' },
]

/** What a customer is billed at when nobody has said otherwise. */
export const DEFAULT_PRICE_LEVEL: PriceLevel = 'retail'

export interface CreateCustomerPayload {
  code: string
  name: string
  phone1?: string
  phone2?: string
  email?: string
  area_id?: number | null
  customer_group_id?: number | null
  currency_id?: number | null
  price_level?: PriceLevel
  salesman_id?: number | null
  allow_credit?: boolean
  credit_limit?: number | null
  addresses?: Omit<CustomerAddress, 'id'>[]
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload> & {
  is_active?: boolean
}

/** Everything one customer's attachments may occupy — mirrors the backend. */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function isOverLimit(c: AdminCustomer): boolean {
  return c.credit_limit !== null && c.credit_limit > 0 && c.balance > c.credit_limit
}

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatMoney(v: number): string {
  return v < 0 ? `-$${fmt.format(Math.abs(v))}` : `$${fmt.format(v)}`
}
