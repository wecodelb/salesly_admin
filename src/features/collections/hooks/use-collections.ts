import { useQuery } from '@tanstack/react-query'
import { fetchCollections } from '../api/collections-api'
import type { CollectionFilters } from '../types'

const COLLECTIONS_KEY = ['collections'] as const

/**
 * Every collection matching the filters.
 *
 * All of them are in the key, `perPage` included. Two filters of one endpoint
 * are two different answers and must not overwrite each other in the cache —
 * and `perPage` is the one that bites, because a screen asking for a page and a
 * report asking for the whole book off a shared key would leave whichever
 * loaded second totalling the other's rows.
 */
export function useCollections(filters: CollectionFilters = {}) {
  return useQuery({
    queryKey: [
      ...COLLECTIONS_KEY,
      filters.customerId ?? null,
      filters.salesmanId ?? null,
      filters.paymentMethod ?? null,
      filters.source ?? null,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
      filters.perPage ?? null,
    ],
    queryFn: () => fetchCollections(filters),
  })
}
