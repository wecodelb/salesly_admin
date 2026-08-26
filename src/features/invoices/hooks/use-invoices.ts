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
 *
 * `perPage` belongs in the key for the same reason, and it is the one that
 * bites: the list asks for a page and Reports asks for the whole book, so off
 * one shared key whichever loaded first wins. Reports would then total a single
 * page of invoices and print a figure that looks perfectly reasonable.
 */
export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: [
      ...INVOICES_KEY,
      filters.customerId ?? null,
      filters.salesmanId ?? null,
      filters.perPage ?? null,
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
