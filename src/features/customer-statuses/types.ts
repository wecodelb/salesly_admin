// Contract from GET/POST/PATCH/DELETE /customer-statuses — the company's own
// vocabulary for classifying customers (New, VIP, Blocked…), maintained under
// Preferences and picked on the customer form.
//
// `sort_order` is the position the company put the status in; every list — here,
// the customer form's picker, the customers filter — is sorted by it, ties
// broken by name. The list always carries `customers_count`, which is also what
// blocks a delete (409) while customers still carry the status.
//
// Distinct from `Customer.is_active`, which stays the hard on/off switch.

export interface CustomerStatus {
  id: number
  company_id: number
  name: string
  sort_order: number
  customers_count: number
}

export interface CreateCustomerStatusPayload {
  name: string
  /** Omitted means "put it last", which the backend works out. */
  sort_order?: number
}

export type UpdateCustomerStatusPayload = Partial<CreateCustomerStatusPayload>
