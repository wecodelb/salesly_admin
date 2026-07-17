// ─── DEMO DATA — design preview only ────────────────────────────────────────
// The dashboard endpoints are not part of phase 2's backend scope yet; every
// figure here is a placeholder so the layout is reviewable. Names and totals
// line up with the customers mock store and the Flutter app's demo dashboard
// (3 overdue accounts · $2,840 total).

export interface DayPoint {
  /** Short day label, e.g. "Mon 1" */
  label: string
  value: number
}

export const SALES_TREND: DayPoint[] = [
  { label: '1 Jul', value: 3120 },
  { label: '2 Jul', value: 3480 },
  { label: '3 Jul', value: 2890 },
  { label: '4 Jul', value: 3760 },
  { label: '5 Jul', value: 4210 },
  { label: '6 Jul', value: 2340 },
  { label: '7 Jul', value: 1980 },
  { label: '8 Jul', value: 3540 },
  { label: '9 Jul', value: 3910 },
  { label: '10 Jul', value: 4480 },
  { label: '11 Jul', value: 4050 },
  { label: '12 Jul', value: 4620 },
  { label: '13 Jul', value: 3380 },
  { label: '14 Jul', value: 4280 },
]

export interface SalesmanTotal {
  name: string
  orders: number
  total: number
}

export const TOP_SALESMEN: SalesmanTotal[] = [
  { name: 'Ahmad Khalil', orders: 34, total: 12400 },
  { name: 'Sara Fares', orders: 28, total: 10850 },
  { name: 'Rami Haddad', orders: 25, total: 9300 },
  { name: 'Omar Nasser', orders: 19, total: 7650 },
]

export interface RecentOrder {
  id: number
  number: string
  customer: string
  /** Id in the customers mock store — clicking navigates to /customers and
   *  opens this customer's detail drawer. */
  customerId: number
  salesman: string
  total: number
  status: 'pending' | 'confirmed' | 'delivered'
}

export const RECENT_ORDERS: RecentOrder[] = [
  { id: 1, number: 'SO-1048', customer: 'City Star Supermarket', customerId: 3, salesman: 'Omar Nasser', total: 640, status: 'pending' },
  { id: 2, number: 'SO-1047', customer: 'Al Watan Grocery', customerId: 1, salesman: 'Ahmad Khalil', total: 320, status: 'confirmed' },
  { id: 3, number: 'SO-1046', customer: 'Phoenix Wholesale', customerId: 9, salesman: 'Sara Fares', total: 1850, status: 'confirmed' },
  { id: 4, number: 'SO-1045', customer: 'Fresh Corner Mart', customerId: 2, salesman: 'Ahmad Khalil', total: 486, status: 'delivered' },
  { id: 5, number: 'SO-1044', customer: 'Green Valley Foods', customerId: 6, salesman: 'Rami Haddad', total: 925, status: 'delivered' },
  { id: 6, number: 'SO-1043', customer: 'Sunrise Bakery & Market', customerId: 7, salesman: 'Rami Haddad', total: 210, status: 'delivered' },
]

export interface OverdueAccount {
  id: number
  customer: string
  customerId: number
  amount: number
  daysOverdue: number
}

// 3 accounts · $2,840 — matches the Flutter dashboard's overdue banner.
export const OVERDUE_ACCOUNTS: OverdueAccount[] = [
  { id: 1, customer: 'Phoenix Wholesale', customerId: 9, amount: 1810, daysOverdue: 8 },
  { id: 2, customer: 'Green Valley Foods', customerId: 6, amount: 790, daysOverdue: 12 },
  { id: 3, customer: 'Fresh Corner Mart', customerId: 2, amount: 240, daysOverdue: 21 },
]

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function money(v: number): string {
  return `$${fmt.format(v)}`
}
