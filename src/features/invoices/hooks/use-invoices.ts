import { useQuery } from '@tanstack/react-query'
import { fetchInvoice, fetchInvoices } from '../api/invoices-api'
import type { InvoiceFilters } from '../types'

const INVOICES_KEY = ['invoices'] as const

/**
 * Every invoice matching the filters.
 *
 * The filters are part of the key, not applied after the fetch: the endpoint
 * narrows by customer and salesman itself, and two filters of one endpoint are
 * two different answers that must not overwrite each other in the cache.
 */
export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: [
      ...INVOICES_KEY,
      filters.customerId ?? null,
      filters.salesmanId ?? null,
    ],
    queryFn: () => fetchInvoices(filters),
  })
}

export function useInvoice(id: number | null) {
  return useQuery({
    queryKey: [...INVOICES_KEY, 'one', id],
    queryFn: () => fetchInvoice(id!),
    enabled: id != null,
  })
}
