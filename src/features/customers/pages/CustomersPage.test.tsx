import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
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
    // use-customers imports these too; omitting them leaves the hook module
    // holding undefined bindings and the page blows up on first render.
    assignPriceList: async () => undefined,
    unassignPriceList: async () => undefined,
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

// The page and its form drawer both read the company's status vocabulary.
// Stubbed at the same network edge as the rest — left unmocked it reaches for a
// real backend, and the failed query settles mid-test.
vi.mock('@/features/customer-groups/hooks/use-customer-groups', () => ({
  useCustomerGroups: () => ({
    data: [
      { id: 1, company_id: 1, name: 'New', sort_order: 1, customers_count: 0 },
      { id: 2, company_id: 1, name: 'VIP', sort_order: 2, customers_count: 0 },
    ],
  }),
}))

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
        <MemoryRouter initialEntries={[{ pathname: route, state }]}>
          {ui}
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

/** Surfaces the current path so navigation can be asserted on. */
function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>
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

    // The filter pills are custom listboxes, not native selects: open the
    // salesman one and pick its option the way a user would.
    await user.click(screen.getByRole('button', { name: /^salesman:/i }))
    await user.click(await screen.findByRole('option', { name: /unassigned/i }))

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

// Row actions live behind a three-dots Dropdown that only renders its items
// while open, so every assertion about them has to open a row's menu first.
// fireEvent rather than userEvent on purpose: userEvent also dispatches
// mousedown, which the Dropdown's own outside-click listener races against,
// making the menu open or not depending on scheduling.
async function openRowActions(customerName: string) {
  const trigger = await screen.findByRole('button', { name: `Actions for ${customerName}` })
  fireEvent.click(trigger)
}

describe('permission gating', () => {
  it('hides assign and credit actions without customers.edit', async () => {
    signIn([PERMISSIONS.CUSTOMERS_VIEW])
    renderPage()
    await screen.findByText('Al Watan Grocery')

    await openRowActions('Al Watan Grocery')

    expect(screen.queryByRole('button', { name: 'Assign salesman' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set credit limit' })).not.toBeInTheDocument()
    // Viewing is still allowed.
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument()
  })

  it('shows them with customers.edit', async () => {
    renderPage()
    await screen.findByText('Al Watan Grocery')

    await openRowActions('Al Watan Grocery')

    expect(screen.getByRole('button', { name: 'Assign salesman' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set credit limit' })).toBeInTheDocument()
  })
})

// A customer's details used to open in a drawer here AND on their own page,
// which meant two ways to see the same thing. The drawer is gone; everything
// routes to /customers/:id.
describe('opening a customer', () => {
  it('sends the row menu straight to that customer’s page', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Al Watan Grocery')

    await openRowActions('Al Watan Grocery')
    await user.click(await screen.findByRole('button', { name: 'View details' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/customers/1')
  })

  it('does the same on a row click', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('Al Watan Grocery'))

    expect(await screen.findByTestId('location')).toHaveTextContent('/customers/1')
  })
})
