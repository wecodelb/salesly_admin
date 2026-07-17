// Contract from backend part 1 (see Phase-2-Planning): CustomerResource plus
// the phase-2 columns — salesman_id, latitude/longitude, credit_limit,
// balance. The backend developer is implementing that part; until it lands
// the hooks serve mock data shaped exactly like this, so flipping the switch
// in hooks/use-customers.ts is the only wiring step left.
export interface AdminCustomer {
  id: number
  code: string
  name: string
  phone1: string
  phone2: string
  email: string
  address: string
  /** Salesman this customer is assigned to; null = unassigned. */
  salesman_id: number | null
  /** Resolved name for display (mock mode resolves locally; backend part 1
   *  returns it on the resource). */
  salesman_name: string | null
  credit_limit: number | null
  /** Outstanding amount the customer owes (positive = due). */
  balance: number
  latitude?: number | null
  longitude?: number | null
  created_at?: string
  updated_at?: string
}

export interface SalesmanOption {
  id: number
  name: string
}

export function isOverLimit(c: AdminCustomer): boolean {
  return c.credit_limit !== null && c.credit_limit > 0 && c.balance > c.credit_limit
}

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatMoney(v: number): string {
  return v < 0 ? `-$${fmt.format(Math.abs(v))}` : `$${fmt.format(v)}`
}
