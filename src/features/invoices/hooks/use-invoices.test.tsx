import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useInvoices } from './use-invoices'
import type { InvoiceFilters } from '../types'

/**
 * What the invoices cache is allowed to reuse.
 *
 * Two calls that would get different answers from the server must not share a
 * key. That is obvious for the filters and easy to forget for `perPage`, which
 * is why it gets a test: the list asks for a page, Reports asks for the whole
 * book, and a collision there prints a total that looks perfectly reasonable.
 */

const fetchInvoices = vi.fn(async (filters: InvoiceFilters) => ({
  invoices: Array.from({ length: filters.perPage ?? 50 }, (_, i) => ({ id: i })),
  meta: { per_page: filters.perPage ?? 50 },
}))

vi.mock('../api/invoices-api', () => ({
  fetchInvoices: (f: InvoiceFilters) => fetchInvoices(f),
  fetchInvoice: vi.fn(),
}))

/**
 * One client across both hooks — the point is that they share a cache.
 *
 * staleTime is infinite so that a second fetch can only mean a second key.
 * At the default of 0 every new observer refetches anyway, and the test would
 * pass whether or not the keys were distinct.
 */
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  fetchInvoices.mockClear()
})

describe('useInvoices', () => {
  it('does not serve a page of invoices to a caller that asked for the book', async () => {
    const wrapper = harness()

    const list = renderHook(() => useInvoices({ perPage: 50 }), { wrapper })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))

    const report = renderHook(() => useInvoices({ perPage: 500 }), { wrapper })
    await waitFor(() => expect(report.result.current.isSuccess).toBe(true))

    // Off one shared key the second is handed the first's 50 without ever
    // calling the server, and Reports totals a page.
    expect(report.result.current.data?.invoices).toHaveLength(500)
    expect(fetchInvoices).toHaveBeenCalledTimes(2)
    // And the traffic must not run the other way either: the list keeps its
    // page rather than being overwritten with the book.
    expect(list.result.current.data?.invoices).toHaveLength(50)
  })

  it('still reuses the cache when the filters really are the same', async () => {
    // The fix must not turn every mount into a fresh fetch.
    const wrapper = harness()

    const a = renderHook(() => useInvoices({ perPage: 500 }), { wrapper })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))

    const b = renderHook(() => useInvoices({ perPage: 500 }), { wrapper })
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true))

    expect(fetchInvoices).toHaveBeenCalledTimes(1)
  })

  it('keeps two customers apart, which was already true', async () => {
    const wrapper = harness()

    const one = renderHook(() => useInvoices({ customerId: 1 }), { wrapper })
    await waitFor(() => expect(one.result.current.isSuccess).toBe(true))

    const two = renderHook(() => useInvoices({ customerId: 2 }), { wrapper })
    await waitFor(() => expect(two.result.current.isSuccess).toBe(true))

    expect(fetchInvoices).toHaveBeenCalledTimes(2)
  })
})
