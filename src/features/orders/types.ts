/**
 * A sales order as the server returns it.
 *
 * Its life: SUBMITTED (waiting for the approval rules or a manager), APPROVED
 * (holding its goods in the warehouse), COMPLETED (delivered — it became an
 * invoice), REJECTED or CANCELED. Orders from before approvals existed were
 * DRAFT and were carried over as approved.
 */
export type OrderStatus = 'SUBMITTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELED' | 'DRAFT' | 'CONFIRMED'

/** Why an order waits: which rule held it, and a sentence a manager can read. */
export interface HoldReason {
  code: 'manual' | 'value' | 'credit' | 'overdue' | 'stock' | string
  message: string
}

export interface OrderLine {
  id: number
  item_id: number
  uom_id: number | null
  /** In the unit the salesman sold in: 5 boxes, not 60 pieces. */
  trs_qty: number
  /** In base units. */
  qty: number
  /** Per base unit; the line total is qty × price. */
  price: number
  total: number
  item_code: string | null
  item_name: string | null
  /** The packaging it was sold in, and how many base units it holds. */
  uom_name: string | null
  unit: number
}

export interface Order {
  id: number
  trs_number: number | string
  trs_date: string | null
  status: OrderStatus
  customer: {
    id: number
    code: string | null
    name: string | null
    phone: string | null
    balance: number
    credit_limit: number
  }
  salesman: { id: number | null; name: string | null }
  warehouse: { id: number | null; name: string | null }
  delivery_date: string | null
  /** When the salesman signed for it on his van; null while it is in the warehouse. */
  loaded_at?: string | null
  deliverer: { id: number | null; name: string | null }
  submitted_at: string | null
  decided_at: string | null
  /** Null on an APPROVED order means the rules approved it on their own. */
  decided_by: number | null
  decided_by_name: string | null
  hold_reasons: HoldReason[]
  rejected_reason: string | null
  total_qty: number
  total_price: number
  total_price_lbp: number
  currency: string
  memo: string | null
  invoice?: { id: number; trs_number: number | string; trs_date: string | null } | null
  rows?: OrderLine[]
  /** What the salesman asked for, when the office changed it on approval. */
  requested_rows?: RequestedLine[] | null
  requested_total?: number | null
}

/** One line as the salesman asked for it, before the office's edit. */
export interface RequestedLine {
  item_id: number
  item_code: string | null
  item_name: string | null
  uom_id: number | null
  uom_name: string | null
  trs_qty: number
  qty: number
  price: number
}

export interface OrdersPage {
  orders: Order[]
  total: number
  lastPage: number
  /** How many wait for approval, whatever the filters — for the badge. */
  pendingApproval: number
}

export interface OrderFilters {
  /** 'decided' is every order the office has answered. */
  status?: OrderStatus | '' | 'decided'
  salesmanId?: number | null
  search?: string
  customerId?: number | null
  /** The day it was taken, either end open. */
  dateFrom?: string
  dateTo?: string
  /** The day it is due, either end open. */
  deliveryFrom?: string
  deliveryTo?: string
  page?: number
}

/** What a manager may change as he approves: the load-request answer, for orders. */
export interface OrderApproval {
  rows?: { item_id: number; uom_id: number; qty: number }[]
  warehouse_id?: number | null
  deliverer_id?: number | null
  delivery_date?: string | null
  memo?: string
}

/** One product in the source warehouse, as the approve drawer weighs a line. */
export interface OrderStockLine {
  item_id: number
  /** In base units, after what other approved orders already hold. */
  available_qty: number
  /** Per base unit, from the shop's own price list and promotions. */
  price: number | null
}

export interface OrderRules {
  auto_approve: boolean
  max_auto_approve_total: number | null
  overdue_days: number | null
}
