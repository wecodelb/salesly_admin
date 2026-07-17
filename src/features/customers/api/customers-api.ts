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

export async function fetchCustomers(perPage = 200): Promise<AdminCustomer[]> {
  const res = await apiClient.get<Envelope<CustomersListData>>(ENDPOINTS.CUSTOMERS, {
    params: { per_page: perPage },
  })
  return res.data.data.data
}

/** PATCH /customers/{id} — manager scope. Backend part 1 adds salesman_id and
 *  credit_limit to the CustomerRequest validation rules. */
export async function updateCustomer(
  id: number,
  payload: Partial<Pick<AdminCustomer, 'salesman_id' | 'credit_limit'>>,
): Promise<void> {
  await apiClient.patch(`${ENDPOINTS.CUSTOMERS}/${id}`, payload)
}
