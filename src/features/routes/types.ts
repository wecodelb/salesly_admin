/**
 * When a customer is visited: which weekdays, every how many weeks, counted
 * from the week of `starts_on`. One plan per customer — a shop is on one
 * salesman's round.
 */
export interface VisitPlan {
  id: number
  customer: { id: number; code: string | null; name: string | null }
  salesman: { id: number | null; name: string | null }
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  weekdays: number[]
  every_weeks: number
  starts_on: string | null
  is_active: boolean
  /** The next visit after today, Y-m-d; also the delivery day a new order gets. */
  next_visit: string | null
}

export interface VisitPlanInput {
  customer_id: number
  salesman_id?: number | null
  weekdays: number[]
  every_weeks: number
  starts_on?: string | null
  is_active?: boolean
}

/** A salesman's day: the shops due a visit, and the approved orders he carries. */
export interface RouteDay {
  date: string
  salesman_id: number
  visits: {
    plan_id: number
    customer: { id: number; code: string | null; name: string | null; phone: string | null; address: string | null }
    visited: boolean
  }[]
  deliveries: {
    order_id: number
    trs_number: number | string
    customer: { id: number; code: string | null; name: string | null }
    total_price: number
    status: string
  }[]
}
