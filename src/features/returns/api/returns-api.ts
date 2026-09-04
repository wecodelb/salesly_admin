import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { SalesReturn, SalesReturnFilters } from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData {
  data: SalesReturn[]
  pagination?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/** Guard against a malformed `last_page` spinning the read below forever. */
const MAX_PAGES = 50

async function fetchPage(filters: SalesReturnFilters = {}) {
  const { data } = await apiClient.get<Envelope<ListData>>(ENDPOINTS.SALES_RETURNS, {
    params: {
      page: filters.page ?? 1,
      per_page: filters.perPage ?? 50,
      ...(filters.customerId ? { customer_id: filters.customerId } : {}),
      ...(filters.salesmanId ? { salesman_id: filters.salesmanId } : {}),
      ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
      ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
      ...(filters.search ? { search: filters.search } : {}),
    },
  })

  return {
    returns: data.data?.data ?? [],
    lastPage: data.data?.pagination?.last_page ?? 1,
  }
}

/**
 * Every return matching the filters, across all pages.
 *
 * Read whole because the strip above the table totals what the reader is
 * looking at, and a figure folded over one page of fifty would describe a page
 * rather than a month. Bounded by [MAX_PAGES]; when the cap bites the page says
 * so rather than quietly under-reporting.
 */
export async function fetchReturns(
  filters: SalesReturnFilters = {},
): Promise<{ returns: SalesReturn[]; truncated: boolean }> {
  const first = await fetchPage({ ...filters, page: 1 })
  const returns = [...first.returns]

  const pages = Math.min(first.lastPage, MAX_PAGES)
  for (let page = 2; page <= pages; page++) {
    const next = await fetchPage({ ...filters, page })
    returns.push(...next.returns)
  }

  return { returns, truncated: first.lastPage > MAX_PAGES }
}

/** One return with its lines and the invoice each came off. */
export async function fetchReturn(id: number): Promise<SalesReturn> {
  const { data } = await apiClient.get<Envelope<{ data: SalesReturn }>>(
    `${ENDPOINTS.SALES_RETURNS}/${id}`,
  )

  return data.data.data
}
