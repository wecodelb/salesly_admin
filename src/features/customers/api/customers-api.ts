import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type {
  AdminCustomer,
  CreateCustomerPayload,
  CustomerAttachment,
  UpdateCustomerPayload,
} from '../types'

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

/** GET /customers/{id} — one customer with addresses, attachments and labels. */
export async function fetchCustomer(id: number): Promise<AdminCustomer> {
  const res = await apiClient.get<Envelope<{ data: AdminCustomer }>>(
    `${ENDPOINTS.CUSTOMERS}/${id}`,
  )
  return res.data.data.data
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<AdminCustomer> {
  const res = await apiClient.post<Envelope<{ data: AdminCustomer }>>(
    ENDPOINTS.CUSTOMERS,
    payload,
  )
  return res.data.data.data
}

/** PATCH /customers/{id} — partial, so send only what changed. */
export async function updateCustomer(
  id: number,
  payload: UpdateCustomerPayload,
): Promise<void> {
  await apiClient.post(`${ENDPOINTS.CUSTOMERS}/${id}`, payload)
}

/** DELETE /customers/{id} — a soft delete; the row is restorable. */
export async function deleteCustomer(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.CUSTOMERS}/${id}`)
}

export async function restoreCustomer(id: number): Promise<void> {
  await apiClient.post(`${ENDPOINTS.CUSTOMERS}/${id}/restore`)
}

export async function setCustomerActive(id: number, active: boolean): Promise<void> {
  await apiClient.post(`${ENDPOINTS.CUSTOMERS}/${id}/${active ? 'activate' : 'deactivate'}`)
}

/** POST /customers/{id}/verify — needs customers.verify. */
export async function verifyCustomer(id: number): Promise<void> {
  await apiClient.post(`${ENDPOINTS.CUSTOMERS}/${id}/verify`)
}

/**
 * POST /customers/{id}/attachments — multipart. The backend caps the total at
 * 2 MB per customer and answers 422 with a message naming the headroom left.
 */
export async function uploadAttachments(
  customerId: number,
  files: File[],
): Promise<CustomerAttachment[]> {
  const form = new FormData()
  files.forEach((f) => form.append('files[]', f))

  const res = await apiClient.post<Envelope<{ data: CustomerAttachment[] }>>(
    `${ENDPOINTS.CUSTOMERS}/${customerId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data.data.data
}

export async function deleteAttachment(customerId: number, attachmentId: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.CUSTOMERS}/${customerId}/attachments/${attachmentId}`)
}

/** POST /customers/{id}/price-lists — idempotent attach. */
export async function assignPriceList(customerId: number, priceListId: number): Promise<void> {
  await apiClient.post(`${ENDPOINTS.CUSTOMERS}/${customerId}/price-lists`, {
    price_list_id: priceListId,
  })
}

/** DELETE /customers/{id}/price-lists/{priceListId}. */
export async function unassignPriceList(customerId: number, priceListId: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.CUSTOMERS}/${customerId}/price-lists/${priceListId}`)
}
