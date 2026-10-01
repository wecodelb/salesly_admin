import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'

/**
 * Searching a list by its document number, with the numbers the server really
 * sends.
 *
 * `trs_number` is a bigint column and arrives as a JSON number — 1002, not
 * "SI-1002". Five screens called `.toLowerCase()` on it, which a number does not
 * have, so the first key typed into their search box threw and took the page
 * down. The export tests never saw it because their fixtures spelled the
 * numbers as strings.
 */

const FIXTURES: Record<string, unknown[]> = {
  '/deliveries/invoices': [
    { id: 1, trs_number: 1001, trs_date: '15/03/2026 10:00', customer: 'Corner Shop', customer_id: 1, salesman: { id: 1, name: 'Ahmad' }, total_qty: 12, total_price: 100, paid_amount: 100, due_amount: 0, is_van_sale: false, rows: [] },
    { id: 2, trs_number: 1002, trs_date: '20/06/2026 11:00', customer: 'Bakery Nour', customer_id: 2, salesman: { id: 2, name: 'Sara' }, total_qty: 8, total_price: 250, paid_amount: 0, due_amount: 250, is_van_sale: true, rows: [] },
  ],
  '/collections': [
    { id: 1, trs_number: 501, trs_date: '15/03/2026 10:30', notes: null, customer: 'Corner Shop', customer_id: 1, amount: 100, payment_method: 'cash', source: 'balance', currency: 'USD', exchange_rate: 89500, payments: [], allocations: [], balance_before: 300, balance_after: 200, salesman: { id: 1, name: 'Ahmad' } },
    { id: 2, trs_number: 502, trs_date: '16/03/2026 09:00', notes: null, customer: 'Bakery Nour', customer_id: 2, amount: 60, payment_method: 'cash', source: 'invoice', currency: 'USD', exchange_rate: 89500, payments: [], allocations: [], balance_before: 60, balance_after: 0, salesman: { id: 2, name: 'Sara' } },
  ],
  '/depot-transfers': [
    { id: 1, company_id: 1, uuid: null, trs_type: 'LR', trs_number: 301, trs_date: '15/03/2026 09:30', status: 'DRAFT', is_in_transit: false, src_id: 1, source: { id: 1, name: 'Main store' }, destination: { id: 2, name: 'Van 3' }, salesman: { id: 1, name: 'Ahmad' }, created_by: 1, created_by_name: 'Admin', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 40, total_cost: 0, total_weight: 0 },
    { id: 4, company_id: 1, uuid: null, trs_type: 'LR', trs_number: 302, trs_date: '18/03/2026 09:00', status: 'CONFIRMED', is_in_transit: false, src_id: 1, source: { id: 1, name: 'Main store' }, destination: { id: 3, name: 'Van 7' }, salesman: { id: 2, name: 'Sara' }, created_by: 1, created_by_name: 'Admin', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 20, total_cost: 0, total_weight: 0 },
    { id: 2, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 401, trs_date: '16/03/2026 08:00', status: 'CONFIRMED', is_in_transit: true, src_id: 1, source: { id: 1, name: 'Main store' }, destination: { id: 2, name: 'Van 3' }, salesman: { id: 1, name: 'Ahmad' }, created_by: 1, created_by_name: 'Admin', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 60, total_cost: 0, total_weight: 0 },
    { id: 5, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 402, trs_date: '19/03/2026 08:30', status: 'DRAFT', is_in_transit: false, src_id: 1, source: { id: 1, name: 'Main store' }, destination: { id: 3, name: 'Van 7' }, salesman: { id: 2, name: 'Sara' }, created_by: 1, created_by_name: 'Admin', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 30, total_cost: 0, total_weight: 0 },
  ],
  '/depot-transfers?flow=unload': [
    { id: 11, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 701, trs_date: '20/03/2026 19:10', status: 'DRAFT', is_in_transit: false, src_id: null, source: { id: 2, name: 'Van 3', is_depot: true }, destination: { id: 1, name: 'Main store', is_depot: false }, salesman: { id: 1, name: 'Ahmad' }, created_by: 1, created_by_name: 'Ahmad', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 25, total_cost: 0, total_weight: 0 },
    { id: 12, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 702, trs_date: '19/03/2026 18:40', status: 'COMPLETED', is_in_transit: false, src_id: null, source: { id: 3, name: 'Van 7', is_depot: true }, destination: { id: 1, name: 'Main store', is_depot: false }, salesman: { id: 2, name: 'Sara' }, created_by: 2, created_by_name: 'Sara', confirmed_at: '19/03/2026 19:00', confirmed_by: 1, confirmed_by_name: 'Admin', total_qty: 40, total_cost: 0, total_weight: 0 },
  ],
  '/warehouses': [],
  '/depot-stock': [],
  '/users': [],
}

vi.mock('@/core/api/client', () => ({
  apiClient: {
    get: async (url: string, config?: { params?: Record<string, unknown> }) => {
      const key =
        config?.params?.flow === 'unload'
          ? '/depot-transfers?flow=unload'
          : Object.keys(FIXTURES).find((k) => url === k || url.startsWith(`${k}?`))

      if (!key || !FIXTURES[key]) throw new Error(`No fixture for GET ${url}`)
      return { data: { status: 'success', message: null, data: { data: FIXTURES[key] } } }
    },
    post: async () => ({ data: { status: 'success', message: null, data: { data: {} } } }),
    delete: async () => ({ data: { status: 'success', message: null, data: { data: {} } } }),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
  },
}))

interface Case {
  name: string
  load: () => Promise<ComponentType>
  /** Matched against the search box's placeholder. */
  box: RegExp
  /** A document number, typed the way someone reads it off the paper. */
  query: string
  /** In the row that survives, and not in the one that goes. */
  keeps: string
  drops: string
}

const CASES: Case[] = [
  {
    name: 'Invoices',
    load: async () => (await import('@/features/invoices/pages/InvoicesPage')).InvoicesPage,
    box: /invoice number/,
    query: '1002',
    keeps: 'Bakery Nour',
    drops: 'Corner Shop',
  },
  {
    name: 'Collections',
    load: async () => (await import('@/features/collections/pages/CollectionsPage')).CollectionsPage,
    box: /receipt number/,
    query: '502',
    keeps: 'Bakery Nour',
    drops: 'Corner Shop',
  },
  {
    name: 'Load requests',
    load: async () => (await import('@/features/my-depot/pages/LoadRequestsPage')).LoadRequestsPage,
    box: /request number/,
    query: '302',
    keeps: 'Sara',
    drops: 'Ahmad',
  },
  {
    name: 'Load issues',
    load: async () => (await import('@/features/my-depot/pages/LoadIssuesPage')).LoadIssuesPage,
    box: /load number/,
    query: '402',
    keeps: 'Sara',
    drops: 'Ahmad',
  },
  {
    name: 'Unloads',
    load: async () => (await import('@/features/my-depot/pages/UnloadsPage')).UnloadsPage,
    box: /unload number/,
    query: '702',
    keeps: 'Van 7',
    drops: 'Van 3',
  },
]

beforeEach(() => {
  useAuthStore.setState({
    role: 'admin',
    permissions: [],
    token: 'test',
    user: { id: '1', name: 'Admin', email: 'a@b.c', company: 'Acme' },
  })
})

afterEach(() => {
  useAuthStore.setState({ role: null, permissions: [], token: null, user: null })
})

const tableBody = () => document.querySelector('table tbody') as HTMLElement

describe.each(CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
  it('finds a document by its number without falling over', async () => {
    const Page = await c.load()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(tableBody()).not.toBeNull()
      expect(within(tableBody()).getAllByText(c.drops, { exact: false }).length).toBeGreaterThan(0)
    })

    await userEvent.type(screen.getByPlaceholderText(c.box), c.query)

    await waitFor(() => {
      expect(within(tableBody()).queryByText(c.drops, { exact: false })).toBeNull()
    })
    expect(within(tableBody()).getAllByText(c.keeps, { exact: false }).length).toBeGreaterThan(0)
  })
})
