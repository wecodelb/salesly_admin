// Contract from GET/POST/PATCH/DELETE /customer-groups — the company's own
// vocabulary for classifying customers (New, VIP, Blocked…), maintained under
// Preferences and picked on the customer form.
//
// `sort_order` is the position the company put the group in; every list — here,
// the customer form's picker, the customers filter — is sorted by it, ties
// broken by name. The list always carries `customers_count`, which is also what
// blocks a delete (409) while customers are still in the group.
//
// Distinct from `Customer.is_active`, which stays the hard on/off switch.

export interface CustomerGroup {
  id: number
  company_id: number
  name: string
  sort_order: number
  customers_count: number
}

export interface CreateCustomerGroupPayload {
  name: string
  /** Omitted means "put it last", which the backend works out. */
  sort_order?: number
}

export type UpdateCustomerGroupPayload = Partial<CreateCustomerGroupPayload>
