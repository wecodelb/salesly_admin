import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'

/**
 * Exporting the Customers screen, end to end.
 *
 * The builder is unit-tested elsewhere; what this covers is the wiring, which
 * is where the mistakes actually are — passing the unfiltered list to a
 * document whose subtitle claims it is filtered, describing a filter the rows
 * do not reflect, or printing a table nobody can reconcile against the screen
 * they ran it from. All of that typechecks perfectly.
 */

const CUSTOMERS = [
  {
    id: 1,
    code: 'C1',
    name: 'Corner Shop',
    phone1: '01 234 567',
    phone2: '',
    address: 'Hamra',
    salesman_id: 1,
    salesman_name: 'Ahmad',
    customer_group_id: 1,
    customer_group_name: 'Retail',
    balance: 400,
    credit_limit: 300,
    is_active: true,
    is_verified: true,
  },
  {
    id: 2,
    code: 'C2',
    name: 'Bakery Nour',
    phone1: '03 111 222',
    phone2: '',
    address: 'Tripoli',
    salesman_id: 2,
    salesman_name: 'Sara',
    customer_group_id: 2,
    customer_group_name: 'Wholesale',
    balance: 0,
    credit_limit: null,
    is_active: true,
    is_verified: true,
  },
  {
    id: 3,
    code: 'C3',
    name: 'Zahle Depot',
    phone1: '',
    phone2: '',
    address: 'Zahle',
    salesman_id: 1,
    salesman_name: 'Ahmad',
    customer_group_id: 1,
    customer_group_name: 'Retail',
    balance: 150,
    credit_limit: null,
    is_active: true,
    is_verified: true,
  },
]

vi.mock('@/features/customers/api/customers-api', () => ({
  fetchCustomers: async () => CUSTOMERS,
}))
vi.mock('@/features/users/api/users-api', () => ({
  fetchUsers: async () => [
    { id: 1, name: 'Ahmad', role: 'salesman' },
    { id: 2, name: 'Sara', role: 'salesman' },
  ],
}))
vi.mock('@/features/customer-groups/api/customer-groups-api', () => ({
  fetchCustomerGroups: async () => [
    { id: 1, name: 'Retail', sort_order: 1, customers_count: 2 },
    { id: 2, name: 'Wholesale', sort_order: 2, customers_count: 1 },
  ],
}))

let print: ReturnType<typeof vi.fn>

beforeEach(() => {
  print = vi.fn()
  vi.stubGlobal('print', print)
  // Admin bypasses every permission check, so the header renders in full.
  useAuthStore.setState({
    role: 'admin',
    permissions: [],
    user: { id: '1', name: 'Admin', email: 'a@b.c', company: 'Nestle Lebanon' },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  useAuthStore.setState({ role: null, permissions: [], user: null })
})

async function renderCustomers() {
  const { CustomersPage } = await import('./CustomersPage')
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  await screen.findByText('Corner Shop')
}

const exportButton = () => screen.getByRole('button', { name: /export pdf/i })
const doc = () => document.querySelector('.report-doc.is-print-only') as HTMLElement

describe('exporting Customers', () => {
  it('prints a document at all, and prints it once', async () => {
    await renderCustomers()
    await userEvent.click(exportButton())

    expect(print).toHaveBeenCalledOnce()
    expect(doc()).not.toBeNull()
  })

  it('prints every customer on screen when nothing is filtered', async () => {
    await renderCustomers()
    await userEvent.click(exportButton())

    const table = within(doc())
    expect(table.getByText('Corner Shop')).toBeInTheDocument()
    expect(table.getByText('Bakery Nour')).toBeInTheDocument()
    expect(table.getByText('Zahle Depot')).toBeInTheDocument()
    expect(doc().textContent).toContain('3 customers')
  })

  it('prints only what the search left on screen, and says so', async () => {
    // The wiring mistake this catches is passing the full list to a document
    // whose subtitle claims it is filtered — which typechecks perfectly and
    // produces a page that lies about itself.
    await renderCustomers()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'bakery')
    await waitFor(() => expect(screen.queryByText('Corner Shop')).toBeNull())

    await userEvent.click(exportButton())

    const table = within(doc())
    expect(table.getByText('Bakery Nour')).toBeInTheDocument()
    expect(table.queryByText('Corner Shop')).toBeNull()
    // Both halves matter: the count, and the reason it is not 3.
    expect(doc().textContent).toContain('1 of 3 customers')
    expect(doc().textContent).toContain('Search “bakery”')
  })

  it('totals only the balances it printed', async () => {
    // A total folded over the whole list under a filtered table is the single
    // worst thing this feature could do, because it looks right.
    await renderCustomers()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'bakery')
    await waitFor(() => expect(screen.queryByText('Corner Shop')).toBeNull())

    await userEvent.click(exportButton())

    // Bakery Nour owes nothing; the other two owe $550 between them.
    expect(doc().textContent).toContain('$0.00')
    expect(doc().textContent).not.toContain('$550.00')
  })

  it('heads the page with the company, not with Salesly', async () => {
    await renderCustomers()
    await userEvent.click(exportButton())

    expect(doc().textContent).toContain('Nestle Lebanon')
  })

  it('never prints NaN in the footer', async () => {
    // credit_limit is null on two of these three rows, which is exactly the
    // shape that used to total to NaN.
    await renderCustomers()
    await userEvent.click(exportButton())

    const foot = doc().querySelector('.report-table tfoot')
    expect(foot).not.toBeNull()
    expect(foot!.textContent).not.toContain('NaN')
    expect(foot!.textContent).toContain('$550.00')
  })

  it('leaves nothing behind on screen once the dialog closes', async () => {
    await renderCustomers()
    await userEvent.click(exportButton())
    expect(doc()).not.toBeNull()

    window.dispatchEvent(new Event('afterprint'))

    await waitFor(() =>
      expect(document.querySelector('.report-doc.is-print-only')).toBeNull(),
    )
  })
})
