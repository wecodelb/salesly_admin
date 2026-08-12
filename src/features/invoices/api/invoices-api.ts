import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { Invoice, InvoiceFilters, InvoicePage } from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData {
  data: Invoice[]
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
 * One page of invoices.
 *
 * The endpoint narrows by customer and by salesman server-side, and a salesman
 * calling it only ever sees his own — so the console passes filters through
 * rather than fetching everything and sifting.
 */
export async function fetchInvoicePage(
  filters: InvoiceFilters = {},
): Promise<InvoicePage> {
  const { data } = await apiClient.get<Envelope<ListData>>(ENDPOINTS.INVOICES, {
    params: {
      page: filters.page ?? 1,
      per_page: filters.perPage ?? 50,
      ...(filters.customerId ? { customer_id: filters.customerId } : {}),
      ...(filters.salesmanId ? { salesman_id: filters.salesmanId } : {}),
    },
  })

  return {
    invoices: data.data?.data ?? [],
    pagination: data.data?.pagination ?? null,
  }
}

/**
 * Every invoice matching the filters, across all pages.
 *
 * Read whole because the strip above the table has to total what the reader is
 * looking at — billed, collected and still owed. Those figures folded over one
 * page of fifty would describe a page rather than a book, and somebody
 * reconciling a salesman's day would be reading a number that means nothing.
 *
 * Bounded by [MAX_PAGES]: a year of trading is thousands of documents, and a
 * console that tried to hold all of them would stall rather than load. When the
 * cap bites the totals describe what was read, which is why the page says so.
 */
export async function fetchInvoices(
  filters: InvoiceFilters = {},
): Promise<{ invoices: Invoice[]; truncated: boolean }> {
  const first = await fetchInvoicePage({ ...filters, page: 1 })
  const invoices = [...first.invoices]

  const lastPage = first.pagination?.last_page ?? 1

  const pages = Math.min(lastPage, MAX_PAGES)
  for (let page = 2; page <= pages; page++) {
    const next = await fetchInvoicePage({ ...filters, page })
    invoices.push(...next.invoices)
  }

  return { invoices, truncated: lastPage > MAX_PAGES }
}

/** One invoice with its lines. */
export async function fetchInvoice(id: number): Promise<Invoice> {
  const { data } = await apiClient.get<Envelope<{ data: Invoice }>>(
    `${ENDPOINTS.INVOICES}/${id}`,
  )

  return data.data.data
}
