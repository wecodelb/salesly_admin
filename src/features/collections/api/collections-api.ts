import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { Collection, CollectionFilters, CollectionPage } from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData {
  data: Collection[]
  pagination?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/** Guard against a malformed `last_page` spinning the read below forever. */
const MAX_PAGES = 50

/**
 * One page of collections.
 *
 * Customer, salesman, method and the date range are all narrowed server-side —
 * and a salesman calling this only ever sees what he collected himself, which
 * is enforced there rather than here.
 */
export async function fetchCollectionPage(
  filters: CollectionFilters = {},
): Promise<CollectionPage> {
  const { data } = await apiClient.get<Envelope<ListData>>(ENDPOINTS.COLLECTIONS, {
    params: {
      page: filters.page ?? 1,
      per_page: filters.perPage ?? 50,
      ...(filters.customerId ? { customer_id: filters.customerId } : {}),
      ...(filters.salesmanId ? { salesman_id: filters.salesmanId } : {}),
      ...(filters.paymentMethod ? { payment_method: filters.paymentMethod } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
      ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
    },
  })

  return {
    collections: data.data?.data ?? [],
    pagination: data.data?.pagination ?? null,
  }
}

/**
 * Every collection matching the filters, across all pages.
 *
 * Read whole because the strip above the table totals what the reader is
 * looking at, and a figure folded over one page of fifty would describe a page
 * rather than a day.
 *
 * Bounded by [MAX_PAGES]: a year of collecting is thousands of receipts, and a
 * console that tried to hold all of them would stall rather than load. When the
 * cap bites the totals describe what was read, which is why the page says so.
 */
export async function fetchCollections(
  filters: CollectionFilters = {},
): Promise<{ collections: Collection[]; truncated: boolean }> {
  const first = await fetchCollectionPage({ ...filters, page: 1 })
  const collections = [...first.collections]

  const lastPage = first.pagination?.last_page ?? 1

  const pages = Math.min(lastPage, MAX_PAGES)
  for (let page = 2; page <= pages; page++) {
    const next = await fetchCollectionPage({ ...filters, page })
    collections.push(...next.collections)
  }

  return { collections, truncated: lastPage > MAX_PAGES }
}
