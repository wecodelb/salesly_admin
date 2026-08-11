import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { PERMISSIONS, type Permission } from '@/core/auth/permissions'
import type { DepotTransfer, DepotTransferStatus, DepotTransferType } from '../types'

const MAIN = { id: 1, code: 'WH-1', name: 'Main Warehouse', is_depot: false }
const DEPOT = { id: 2, code: 'DEP-3', name: 'Depot 3', is_depot: true }
const KARIM = { id: 5, name: 'Karim' }

function transfer(
  id: number,
  trs_type: DepotTransferType,
  status: DepotTransferStatus,
  overrides: Partial<DepotTransfer> = {},
): DepotTransfer {
  return {
    id,
    company_id: 1,
    uuid: null,
    trs_type,
    trs_number: `${trs_type}-${id}`,
    trs_date: '03/11/2026 09:00',
    status,
    is_in_transit: trs_type === 'TRO' && status === 'CONFIRMED',
    source: MAIN,
    destination: DEPOT,
    salesman: KARIM,
    created_by: 1,
    created_by_name: 'Manager',
    confirmed_at: null,
    confirmed_by: null,
    confirmed_by_name: null,
    total_qty: 96,
    total_cost: 0,
    total_weight: 0,
    total_volume: 0,
    discrepancy_qty: null,
    src_type: null,
    src_id: null,
    memo: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

// The whole flow in four documents: a request nobody has answered, a draft the
// warehouse is still picking, a load already on the road, and the signature
// that closed an earlier one.
const FIXTURES: DepotTransfer[] = [
  transfer(1, 'LR', 'DRAFT'),
  transfer(2, 'TRO', 'DRAFT'),
  transfer(3, 'TRO', 'CONFIRMED'),
  transfer(4, 'TRI', 'CONFIRMED', { source: MAIN, destination: DEPOT }),
]

// Stubbed at the network edge, like the customers page tests: the assertions
// are about what the screen does with a feed, not about how it fetches one.
vi.mock('../api/my-depot-api', () => ({
  fetchDepotTransfers: async () => FIXTURES,
  fetchDepotTransfer: async (id: number) => FIXTURES.find((t) => t.id === id)!,
  // The badge asks for its own filtered count rather than reading the feed, so
  // it needs answering separately — one request nobody has approved.
  fetchPendingLoadRequestCount: async () => 1,
  fetchWarehouses: async () => [{ id: 1, code: 'WH-1', name: 'Main Warehouse' }],
  fetchDepotStock: async () => ({
    warehouse: MAIN,
    salesman: null,
    total_qty: 0,
    total_available_qty: 0,
    total_reserved_qty: 0,
    items: [],
  }),
  createDepotTransfer: async () => FIXTURES[1],
  updateDepotTransfer: async () => FIXTURES[1],
  deleteDepotTransfer: async () => undefined,
  issueDepotTransfer: async () => FIXTURES[2],
  cancelDepotTransfer: async () => FIXTURES[1],
  acceptDepotTransfer: async () => ({}),
  createLoadRequest: async () => FIXTURES[0],
  approveLoadRequest: async () => FIXTURES[0],
  rejectLoadRequest: async () => FIXTURES[0],
}))

// The salesman filter reads the company's users; left unmocked it reaches for a
// real backend and the failed query settles mid-test.
vi.mock('@/features/users/api/users-api', () => ({
  fetchUsers: async () => [
    {
      id: 5,
      name: 'Karim',
      email: 'karim@demo.test',
      phone: null,
      image: null,
      role: 'salesman',
      permissions: [],
      status: 'active',
    },
  ],
}))

const { DepotTransfersPage } = await import('./DepotTransfersPage')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/depot-transfers']}>
        <DepotTransfersPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Surfaces the current path so navigation can be asserted on. */
function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

/** Signs in with an exact permission set. Role stays manager so `can()` does
 *  not short-circuit the way it does for an admin. */
function signIn(permissions: Permission[]) {
  useAuthStore.setState({
    token: 'test-token',
    user: { id: '1', name: 'Manager', email: 'm@x.com' },
    role: 'manager',
    permissions,
  })
}

/** The table renders five placeholder rows while the feed is in flight, so
 *  every test has to wait for a real document before counting anything. */
async function loadedFeed() {
  const table = await screen.findByRole('table')
  await within(table).findByText('TRO-2')
  return transferRows()
}

function transferRows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

/** The requests panel above the feed. Scoped, because a request appears both
 *  in the inbox and in the feed below it and its number is in two places. */
function loadRequestInbox(): HTMLElement {
  const panel = screen.getByText('Load requests').closest('section')
  if (!panel) throw new Error('The load inbox is not on the page.')
  return panel
}

// Row actions live behind a three-dots Dropdown that only renders its items
// while open. fireEvent rather than userEvent on purpose: userEvent also
// dispatches mousedown, which the Dropdown's own outside-click listener races
// against, making the menu open or not depending on scheduling.
async function openRowActions(documentNumber: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${documentNumber}` }))
}

beforeEach(() => {
  signIn([PERMISSIONS.DEPOT_VIEW])
})

describe('DepotTransfersPage', () => {
  it('lists all three documents in one feed', async () => {
    renderPage()

    const rows = await loadedFeed()
    expect(rows).toHaveLength(4)
  })

  it('counts the flow across the whole feed, not the filtered rows', async () => {
    renderPage()
    await loadedFeed()

    // One request nobody has answered, one load on the road, one depot that has
    // actually been signed into.
    for (const [label, value] of [
      ['Requests waiting', '1'],
      ['Loads on the road', '1'],
      ['Depots stocked', '1'],
    ]) {
      const stat = screen.getByText(label).closest('div')!
      expect(within(stat).getByText(value)).toBeInTheDocument()
    }
  })

  it('narrows the feed to one document type', async () => {
    const user = userEvent.setup()
    renderPage()
    await loadedFeed()

    await user.click(screen.getByRole('button', { name: /^type:/i }))
    await user.click(await screen.findByRole('option', { name: /load out/i }))

    await waitFor(() => expect(transferRows()).toHaveLength(2))
  })

  it('searches by document number', async () => {
    const user = userEvent.setup()
    renderPage()
    await loadedFeed()

    await user.type(screen.getByPlaceholderText(/search by document/i), 'TRI-4')

    await waitFor(() => expect(transferRows()).toHaveLength(1))
  })

  it('opens the document a row points at', async () => {
    const user = userEvent.setup()
    renderPage()
    await loadedFeed()

    await user.click(screen.getByText('TRO-2'))

    expect(await screen.findByTestId('location')).toHaveTextContent('/depot-transfers/2')
  })
})

describe('draft-only actions', () => {
  it('offers edit, issue, cancel and delete on a draft load', async () => {
    signIn([PERMISSIONS.DEPOT_VIEW, PERMISSIONS.DEPOT_ISSUE])
    renderPage()
    await loadedFeed()

    await openRowActions('TRO-2')

    for (const action of ['Edit', 'Issue', 'Cancel', 'Delete draft']) {
      expect(screen.getByRole('button', { name: action })).toBeInTheDocument()
    }
  })

  it('offers none of them once the load has gone out', async () => {
    signIn([PERMISSIONS.DEPOT_VIEW, PERMISSIONS.DEPOT_ISSUE])
    renderPage()
    await loadedFeed()

    // TRO-3 is in transit: the goods have left the shelf, so editing or
    // deleting it would release a reservation that is already spent.
    await openRowActions('TRO-3')

    for (const action of ['Edit', 'Issue', 'Cancel', 'Delete draft']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument()
  })

  it('hides them entirely without depot.issue', async () => {
    renderPage()
    await loadedFeed()

    await openRowActions('TRO-2')

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument()
  })
})

describe('accepting', () => {
  it('offers accept on an issued load, to a holder of depot.accept', async () => {
    signIn([PERMISSIONS.DEPOT_VIEW, PERMISSIONS.DEPOT_ACCEPT])
    renderPage()
    await loadedFeed()

    await openRowActions('TRO-3')

    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  it('never offers it on a draft — there is nothing in transit to receive', async () => {
    signIn([PERMISSIONS.DEPOT_VIEW, PERMISSIONS.DEPOT_ACCEPT])
    renderPage()
    await loadedFeed()

    await openRowActions('TRO-2')

    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
  })

  it('hides it without depot.accept', async () => {
    renderPage()
    await loadedFeed()

    await openRowActions('TRO-3')

    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
  })
})

describe('load requests', () => {
  it('answers a pending request only with depot.issue', async () => {
    // Two answers, and saying yes is spelled "create load": the approval happens
    // inside the drawer that builds it, so there is no separate approve step to
    // press and then forget about.
    signIn([PERMISSIONS.DEPOT_VIEW, PERMISSIONS.DEPOT_ISSUE])
    renderPage()
    await loadedFeed()

    expect(screen.getByRole('button', { name: /create load/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument()
  })

  it('shows the inbox read-only without it', async () => {
    renderPage()
    await loadedFeed()

    expect(screen.getByText('Load requests')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create load/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
  })

  it('opens the request from the inbox row', async () => {
    // Approving off a quantity total alone is signing for a load nobody has
    // read; the lines are on the document, so the row has to reach it.
    const user = userEvent.setup()
    signIn([PERMISSIONS.DEPOT_VIEW, PERMISSIONS.DEPOT_ISSUE])
    renderPage()
    await loadedFeed()

    await user.click(within(loadRequestInbox()).getByText('LR-1'))

    expect(await screen.findByTestId('location')).toHaveTextContent('/depot-transfers/1')
  })

  it('still opens it for a reviewer who cannot answer it', async () => {
    const user = userEvent.setup()
    renderPage()
    await loadedFeed()

    await user.click(within(loadRequestInbox()).getByText('LR-1'))

    expect(await screen.findByTestId('location')).toHaveTextContent('/depot-transfers/1')
  })
})
