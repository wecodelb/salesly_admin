import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type {
  Adjustment,
  AdjustmentFilters,
  AdjustmentPage,
  AdjustmentPayload,
  AdjustmentType,
} from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData {
  data: Adjustment[]
  pagination?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/** Guard against a malformed `last_page` spinning the read below forever. */
const MAX_PAGES = 50

/** One page of adjustment sheets. */
export async function fetchAdjustmentPage(
  filters: AdjustmentFilters = {},
): Promise<AdjustmentPage> {
  const { data } = await apiClient.get<Envelope<ListData>>(ENDPOINTS.ADJUSTMENTS, {
    params: {
      page: filters.page ?? 1,
      per_page: filters.perPage ?? 50,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.warehouseId ? { warehouse_id: filters.warehouseId } : {}),
      ...(filters.adjustmentTypeId ? { adjustment_type_id: filters.adjustmentTypeId } : {}),
      ...(filters.itemId ? { item_id: filters.itemId } : {}),
      ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
      ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
      ...(filters.search ? { search: filters.search } : {}),
    },
  })

  return {
    adjustments: data.data?.data ?? [],
    pagination: data.data?.pagination ?? null,
  }
}

/**
 * Every sheet matching the filters, across all pages.
 *
 * Read whole because the strip above the table totals what the reader is
 * looking at, and a figure folded over one page of fifty would describe a page
 * rather than a month. Bounded by [MAX_PAGES]; when the cap bites the page
 * says so rather than quietly under-reporting.
 */
export async function fetchAdjustments(
  filters: AdjustmentFilters = {},
): Promise<{ adjustments: Adjustment[]; truncated: boolean }> {
  const first = await fetchAdjustmentPage({ ...filters, page: 1 })
  const adjustments = [...first.adjustments]

  const lastPage = first.pagination?.last_page ?? 1
  const pages = Math.min(lastPage, MAX_PAGES)

  for (let page = 2; page <= pages; page++) {
    const next = await fetchAdjustmentPage({ ...filters, page })
    adjustments.push(...next.adjustments)
  }

  return { adjustments, truncated: lastPage > MAX_PAGES }
}

/** One sheet with its rows. */
export async function fetchAdjustment(id: number): Promise<Adjustment> {
  const { data } = await apiClient.get<Envelope<{ data: Adjustment }>>(
    `${ENDPOINTS.ADJUSTMENTS}/${id}`,
  )

  return data.data.data
}

export async function createAdjustment(payload: AdjustmentPayload): Promise<Adjustment> {
  const { data } = await apiClient.post<Envelope<{ data: Adjustment }>>(
    ENDPOINTS.ADJUSTMENTS,
    payload,
  )

  return data.data.data
}

export async function updateAdjustment(
  id: number,
  payload: Partial<AdjustmentPayload>,
): Promise<Adjustment> {
  const { data } = await apiClient.post<Envelope<{ data: Adjustment }>>(
    `${ENDPOINTS.ADJUSTMENTS}/${id}`,
    payload,
  )

  return data.data.data
}

/**
 * Sign a sheet off, or refuse it.
 *
 * The only two calls in this file that move stock. Approving applies every row
 * to the shelf; rejecting an approved sheet puts every row back.
 */
export async function approveAdjustment(id: number): Promise<Adjustment> {
  const { data } = await apiClient.post<Envelope<{ data: Adjustment }>>(
    `${ENDPOINTS.ADJUSTMENTS}/${id}/approve`,
  )

  return data.data.data
}

export async function rejectAdjustment(id: number): Promise<Adjustment> {
  const { data } = await apiClient.post<Envelope<{ data: Adjustment }>>(
    `${ENDPOINTS.ADJUSTMENTS}/${id}/reject`,
  )

  return data.data.data
}

export async function deleteAdjustment(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.ADJUSTMENTS}/${id}`)
}

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * The kinds of adjustment this company recognises.
 *
 * `active` is deliberately optional: a screen managing them has to see the ones
 * switched off, and a drawer picking one must not.
 */
export async function fetchAdjustmentTypes(active?: boolean): Promise<AdjustmentType[]> {
  const { data } = await apiClient.get<Envelope<{ data: AdjustmentType[] }>>(
    ENDPOINTS.ADJUSTMENT_TYPES,
    { params: active === undefined ? {} : { active: active ? 1 : 0 } },
  )

  return data.data?.data ?? []
}

export async function createAdjustmentType(
  payload: Partial<AdjustmentType>,
): Promise<AdjustmentType> {
  const { data } = await apiClient.post<Envelope<{ data: AdjustmentType }>>(
    ENDPOINTS.ADJUSTMENT_TYPES,
    payload,
  )

  return data.data.data
}

export async function updateAdjustmentType(
  id: number,
  payload: Partial<AdjustmentType>,
): Promise<AdjustmentType> {
  const { data } = await apiClient.post<Envelope<{ data: AdjustmentType }>>(
    `${ENDPOINTS.ADJUSTMENT_TYPES}/${id}`,
    payload,
  )

  return data.data.data
}

export async function deleteAdjustmentType(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.ADJUSTMENT_TYPES}/${id}`)
}
