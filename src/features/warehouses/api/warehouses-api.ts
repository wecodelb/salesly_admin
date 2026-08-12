import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { CreateWarehousePayload, UpdateWarehousePayload, Warehouse } from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
  pagination?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/** Guard against a malformed `last_page` spinning this forever. */
const MAX_PAGES = 50

/**
 * Every warehouse the caller may see, across all pages.
 *
 * The order is the backend's and is kept: the main warehouse leads, then the
 * rest by name. Re-sorting here would throw away the one row an admin reaches
 * for most and the only one a document falls back to.
 *
 * Scoped server-side — a salesman is answered with the warehouses he is
 * assigned to, everyone above him with the company's.
 */
export async function fetchWarehouses(perPage = 200): Promise<Warehouse[]> {
  const all: Warehouse[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiClient.get<Envelope<ListData<Warehouse>>>(ENDPOINTS.WAREHOUSES, {
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

/** The uuid is minted server-side — the console creates its rows online and has
 *  nothing to reconcile an offline identity against. */
export async function createWarehouse(payload: CreateWarehousePayload): Promise<Warehouse> {
  const res = await apiClient.post<Envelope<{ data: Warehouse }>>(ENDPOINTS.WAREHOUSES, payload)
  return res.data.data.data
}

/** Update is a POST like the rest of this API, not a PATCH. A key left out
 *  leaves that column alone, which is what lets a depot's capacity be saved
 *  without resending the code and name it refuses to change. */
export async function updateWarehouse(
  id: number,
  payload: UpdateWarehousePayload,
): Promise<Warehouse> {
  const res = await apiClient.post<Envelope<{ data: Warehouse }>>(
    `${ENDPOINTS.WAREHOUSES}/${id}`,
    payload,
  )
  return res.data.data.data
}

/** Refused with a 422 on the main warehouse, and on a depot somebody still
 *  drives. */
export async function deleteWarehouse(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.WAREHOUSES}/${id}`)
}
