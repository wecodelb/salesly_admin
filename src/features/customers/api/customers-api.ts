import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { AdminCustomer } from '../types'

// ─── READY, NOT WIRED YET ───────────────────────────────────────────────────
// These call the real backend contract (GET/PATCH /customers). Backend part 1
// (salesman_id, credit_limit, balance columns + CustomerRequest rules) is with
// the backend developer — until it lands, hooks/use-customers.ts keeps
// USE_MOCK_DATA=true and never calls these. Flip that flag to wire the page;
// no other change is needed.

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

// GET /customers — paginated list nested as data.data + data.pagination.
interface CustomersListData {
  data: AdminCustomer[]
  pagination: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/** Guard against a malformed `last_page` spinning this forever. */
const MAX_PAGES = 50

/**
 * Every customer in the company, across all pages.
 *
 * The manager scope is "all customers", so stopping at page 1 would silently
 * hide the tail of the book — the KPI counts and the unassigned filter would
 * both be quietly wrong for any company past `perPage` customers.
 */
export async function fetchCustomers(perPage = 200): Promise<AdminCustomer[]> {
  const all: AdminCustomer[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiClient.get<Envelope<CustomersListData>>(ENDPOINTS.CUSTOMERS, {
      params: { per_page: perPage, page },
    })

    const body = res.data.data
    const rows = body?.data ?? []
    all.push(...rows)

    const lastPage = body?.pagination?.last_page ?? page
    if (rows.length === 0 || page >= lastPage) break
  }

  return all
}

/** PATCH /customers/{id} — manager scope. Backend part 1 adds salesman_id and
 *  credit_limit to the CustomerRequest validation rules. */
export async function updateCustomer(
  id: number,
  payload: Partial<Pick<AdminCustomer, 'salesman_id' | 'credit_limit'>>,
): Promise<void> {
  await apiClient.patch(`${ENDPOINTS.CUSTOMERS}/${id}`, payload)
}
