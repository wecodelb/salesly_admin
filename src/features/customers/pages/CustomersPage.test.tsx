import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { PERMISSIONS, type Permission } from '@/core/auth/permissions'

// Stub the network edge, not the USE_MOCK_DATA flag. The flag is a shipping
// decision that flips when the backend lands; these tests describe the page's
// behaviour and must hold either way. Fixtures come from the demo store so the
// assertions below stay meaningful.
vi.mock('../api/customers-api', async () => {
  const store = await import('../mock-data')
  return {
    fetchCustomers: () => store.mockFetchCustomers(),
    updateCustomer: (id: number, payload: Record<string, unknown>) =>
      'salesman_id' in payload
        ? store.mockAssignSalesman(id, payload.salesman_id as number | null)
        : store.mockSetCreditLimit(id, payload.credit_limit as number | null),
  }
})

vi.mock('@/features/users/api/users-api', async () => {
  const store = await import('../mock-data')
  return {
    fetchUsers: async () =>
      store.MOCK_SALESMEN.map((s) => ({
        id: s.id,
        name: s.name,
        email: `${s.id}@demo.test`,
        phone: null,
        image: null,
        role: 'salesman',
        permissions: [],
        status: 'active',
      })),
  }
})

const { CustomersPage } = await import('./CustomersPage')

function renderPage(
  ui: ReactElement = <CustomersPage />,
  { route = '/customers', state }: { route?: string; state?: unknown } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[{ pathname: route, state }]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

/** Signs in with an exact permission set. Empty = view-only. */
function signIn(permissions: Permission[]) {
  useAuthStore.setState({
    token: 'test-token',
    user: { id: '1', name: 'Manager', email: 'm@x.com' },
    role: 'manager',
    permissions,
  })
}

/** The customer rows, excluding the table's header row. */
async function customerRows() {
  const table = await screen.findByRole('table')
  const rows = within(table).getAllByRole('row')
  return rows.slice(1)
}

beforeEach(() => {
  signIn([PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.CUSTOMERS_EDIT])
})

describe('CustomersPage', () => {
  it('lists every company customer once loaded', async () => {
    renderPage()

    expect(await screen.findByText('Al Watan Grocery')).toBeInTheDocument()
    expect(await customerRows()).toHaveLength(25)
  })

  it('shows KPI counts that agree with the rows', async () => {
    renderPage()
    await screen.findByText('Al Watan Grocery')

    const rows = await customerRows()
    // The "Customers" KPI must equal what the table actually renders — a
    // mismatch means the count and the list disagree. Scoped to the KPI
    // label (a <p>), since the page <h1> carries the same word.
    const kpiLabel = screen
      .getAllByText('Customers')
      .find((el) => el.tagName === 'P')!
    const totalCard = kpiLabel.closest('div')!
    expect(within(totalCard).getByText(String(rows.length))).toBeInTheDocument()

    // The other three KPI labels exist. Matched on <p> because "Unassigned"
    // and "Over limit" are also filter <option> labels.
    for (const label of ['Assigned', 'Unassigned', 'Over limit']) {
      expect(
        screen.getAllByText(label).some((el) => el.tagName === 'P'),
      ).toBe(true)
    }
  })

  it('filters by search across name, code and address', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Al Watan Grocery')

    const search = screen.getByPlaceholderText(/search by name/i)
    await user.type(search, 'watan')

    await waitFor(async () => expect(await customerRows()).toHaveLength(1))
    expect(screen.getByText('Al Watan Grocery')).toBeInTheDocument()
  })

  it('search is case-insensitive', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Al Watan Grocery')

    await user.type(screen.getByPlaceholderText(/search by name/i), 'WATAN')

    await waitFor(async () => expect(await customerRows()).toHaveLength(1))
  })

  it('filters down to unassigned customers', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Al Watan Grocery')

    const [salesmanSelect] = screen.getAllByRole('combobox')
    await user.selectOptions(salesmanSelect, 'unassigned')

    await waitFor(async () => {
      const rows = await customerRows()
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(within(row).getByText('Unassigned')).toBeInTheDocument()
      }
    })
  })

  it('shows an empty message when nothing matches', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Al Watan Grocery')

    await user.type(screen.getByPlaceholderText(/search by name/i), 'zzzznothing')

    expect(await screen.findByText(/no customers match your filters/i)).toBeInTheDocument()
  })

  it('drops the demo-data banner now that it is wired to the backend', async () => {
    renderPage()
    await screen.findByText('Al Watan Grocery')

    // The banner is tied to USE_MOCK_DATA, which is now false.
    expect(screen.queryByText(/demo data/i)).toBeNull()
  })
})

describe('permission gating', () => {
  it('hides assign and credit actions without customers.edit', async () => {
    signIn([PERMISSIONS.CUSTOMERS_VIEW])
    renderPage()
    await screen.findByText('Al Watan Grocery')

    expect(screen.queryByTitle('Assign salesman')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Set credit limit')).not.toBeInTheDocument()
    // Viewing is still allowed.
    expect(screen.getAllByTitle('View').length).toBeGreaterThan(0)
  })

  it('shows them with customers.edit', async () => {
    renderPage()
    await screen.findByText('Al Watan Grocery')

    expect(screen.getAllByTitle('Assign salesman').length).toBeGreaterThan(0)
    expect(screen.getAllByTitle('Set credit limit').length).toBeGreaterThan(0)
  })
})

describe('deep link from the dashboard', () => {
  // The drawer stays mounted for its slide animation, but aria-hidden keeps
  // it out of the accessibility tree while closed — so a role query finds it
  // only when it is genuinely open.
  const openDrawer = () => screen.queryByRole('dialog', { name: 'Customer' })

  it('opens the detail drawer for the customer in router state', async () => {
    renderPage(<CustomersPage />, { state: { customerId: 3 } })

    await screen.findByText('Al Watan Grocery')
    await waitFor(() => expect(openDrawer()).not.toBeNull())
    expect(within(openDrawer()!).getByText('City Star Supermarket')).toBeInTheDocument()
  })

  it('stays closed after the user dismisses it, even when the list refetches',
    async () => {
      const user = userEvent.setup()
      const { client } = renderPage(<CustomersPage />, { state: { customerId: 3 } })

      await screen.findByText('Al Watan Grocery')
      await waitFor(() => expect(openDrawer()).not.toBeNull())

      await user.click(within(openDrawer()!).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(openDrawer()).toBeNull())

      // A refetch that returns identical data is harmless — React Query's
      // structural sharing keeps the same array reference. The dangerous case
      // is a refetch whose data genuinely changed, which is exactly what an
      // assign produces: a new array identity, re-running the deep-link
      // effect and yanking the drawer back open under the user.
      await user.click(screen.getAllByTitle('Assign salesman')[0])
      const modal = await screen.findByRole('dialog', { name: 'Assign salesman' })
      await user.selectOptions(within(modal).getByRole('combobox'), '12')
      await user.click(within(modal).getByRole('button', { name: /^assign$/i }))

      // Wait for the mutation and its refetch to fully settle.
      await waitFor(
        () => expect(screen.queryByRole('dialog', { name: 'Assign salesman' })).toBeNull(),
        { timeout: 3000 },
      )
      await waitFor(() => expect(client.isFetching()).toBe(0), { timeout: 3000 })

      expect(openDrawer()).toBeNull()
    })
})
