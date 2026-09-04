import { useQuery } from '@tanstack/react-query'
import { fetchReturn, fetchReturns } from '../api/returns-api'
import type { SalesReturnFilters } from '../types'

const RETURNS_KEY = ['sales-returns'] as const

/**
 * Every return matching the filters.
 *
 * All of them are in the key, `perPage` included. Two filters of one endpoint
 * are two different answers and must not overwrite each other in the cache —
 * and `perPage` is the one that bites, because a screen asking for a page and
 * a report asking for the whole book off a shared key would leave whichever
 * loaded second totalling the other's rows.
 */
export function useReturns(filters: SalesReturnFilters = {}) {
  return useQuery({
    queryKey: [
      ...RETURNS_KEY,
      filters.customerId ?? null,
      filters.salesmanId ?? null,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
      filters.search ?? null,
      filters.perPage ?? null,
    ],
    queryFn: () => fetchReturns(filters),
  })
}

export function useReturn(id: number | null) {
  return useQuery({
    queryKey: [...RETURNS_KEY, 'one', id],
    queryFn: () => fetchReturn(id!),
    enabled: id != null,
  })
}
