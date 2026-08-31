import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { PERMISSIONS, type Permission } from '@/core/auth/permissions'
import type { AdjustmentType } from '../types'

/**
 * The screen that manages the vocabulary.
 *
 * Two rules carry it, and both are about *not offering* something. A type
 * seeded with the company can never be deleted, and a type with sheets behind
 * it can never be deleted — in both cases the way out is to switch it off. The
 * server enforces that; what this file proves is that the screen doesn't offer
 * a Delete that will come back refused, because a button that is always
 * refused teaches people to stop reading refusals.
 */

const type = (over: Partial<AdjustmentType>): AdjustmentType => ({
  id: 1,
  code: 'damaged',
  name: 'Damaged',
  direction: 'out',
  is_active: true,
  is_system: true,
  sort_order: 1,
  memo: '',
  rows_count: 0,
  ...over,
})

/** Standard, out only, and with history behind it. Undeletable twice over. */
const DAMAGED = type({ id: 1, code: 'damaged', name: 'Damaged', direction: 'out', rows_count: 7 })

/** Standard and never used — still undeletable, because it is standard. */
const ADJUST = type({
  id: 2,
  code: 'adjust',
  name: 'Adjust quantity',
  direction: 'both',
  rows_count: 0,
})

/** The company's own, never used: the one case a Delete is real. */
const THEFT = type({
  id: 3,
  code: 'theft',
  name: 'Shrinkage',
  direction: 'out',
  is_system: false,
  is_active: false,
  rows_count: 0,
})

/** Custom but written under — deletable by origin, not by history. */
const WASTE = type({
  id: 4,
  code: 'waste',
  name: 'Wastage',
  direction: 'out',
  is_system: false,
  rows_count: 3,
})

const updateAdjustmentType = vi.fn(async () => ADJUST)
const deleteAdjustmentType = vi.fn(async () => undefined)
const createAdjustmentType = vi.fn(async () => THEFT)

vi.mock('../api/adjustments-api', () => ({
  fetchAdjustmentTypes: async () => [DAMAGED, ADJUST, THEFT, WASTE],
  createAdjustmentType: (...args: unknown[]) => createAdjustmentType(...(args as [])),
  updateAdjustmentType: (...args: unknown[]) => updateAdjustmentType(...(args as [])),
  deleteAdjustmentType: (...args: unknown[]) => deleteAdjustmentType(...(args as [])),
}))

const { AdjustmentTypesPage } = await import('./AdjustmentTypesPage')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <AdjustmentTypesPage />
    </QueryClientProvider>,
  )
}

function signIn(permissions: Permission[]) {
  useAuthStore.setState({
    token: 'test-token',
    user: { id: '1', name: 'Manager', email: 'm@x.com' },
    role: 'manager',
    permissions,
  })
}

/** The table body row for a named type. */
async function rowFor(name: string) {
  await screen.findByText(name)
  const cell = screen.getByText(name)
  return cell.closest('tr') as HTMLElement
}

/** Every action this screen can put on a row. */
const ACTIONS = ['Edit', 'Switch off', 'Switch on', 'Delete'] as const

/**
 * Opens the row's action menu and returns which of [ACTIONS] it offers.
 *
 * Asked by name rather than by walking the menu: Dropdown renders plain
 * buttons through a portal on purpose — no role="menu" — so there is nothing
 * to enumerate, and "which of the four is offered" is the question anyway.
 */
async function menuFor(name: string): Promise<string[]> {
  const row = await rowFor(name)
  await userEvent.click(within(row).getByRole('button'))

  return ACTIONS.filter((label) => screen.queryByRole('button', { name: label }) !== null)
}

/**
 * The drawer that is actually open.
 *
 * SideDrawer stays mounted when closed so its slide can run, so both the
 * create and the edit drawer are always in the DOM. getByRole skips the closed
 * one because it is aria-hidden; a plain getByLabelText would not.
 */
function drawer(title: RegExp) {
  return within(screen.getByRole('dialog', { name: title }))
}

beforeEach(() => {
  updateAdjustmentType.mockClear()
  deleteAdjustmentType.mockClear()
  createAdjustmentType.mockClear()
  signIn([PERMISSIONS.ADJUSTMENTS_VIEW, PERMISSIONS.PREFERENCES_MANAGE])
})

describe('what the screen offers to do with a type', () => {
  it('never offers to delete one of the standard types, however unused', async () => {
    renderPage()

    // Adjust quantity has no history at all — the only thing stopping it is
    // that every company needs somewhere to put a recount.
    expect(await menuFor('Adjust quantity')).not.toContain('Delete')
  })

  it('never offers to delete a type with sheets written under it', async () => {
    renderPage()

    // Custom, so origin is no obstacle; three rows exist, so history is.
    expect(await menuFor('Wastage')).not.toContain('Delete')
  })

  it('offers Delete for a type of your own that nothing has been written under', async () => {
    renderPage()

    expect(await menuFor('Shrinkage')).toContain('Delete')
  })

  it('always offers the way out that does work', async () => {
    renderPage()

    // Switching off is what a reader is meant to reach for when Delete is
    // absent, so it has to be there on the rows where Delete is not.
    expect(await menuFor('Damaged')).toContain('Switch off')
  })

  it('offers to switch a disabled one back on rather than off', async () => {
    renderPage()

    expect(await menuFor('Shrinkage')).toContain('Switch on')
  })
})

describe('switching one off', () => {
  it('sends is_active false for that type and nothing else', async () => {
    renderPage()
    const row = await rowFor('Damaged')

    await userEvent.click(within(row).getByRole('button'))
    await userEvent.click(screen.getByRole('button', { name: 'Switch off' }))

    // The api layer takes them positionally; the {id, payload} shape is the
    // hook's, and this file stubs below it.
    await waitFor(() =>
      expect(updateAdjustmentType).toHaveBeenCalledWith(DAMAGED.id, { is_active: false }),
    )
  })
})

describe('what the table says', () => {
  it('reads a direction as the rule it is, not as one movement', async () => {
    renderPage()

    // "Out only" rather than "Out": the reader is being told what the type
    // permits, not what one row did.
    expect(within(await rowFor('Damaged')).getByText('Out only')).toBeInTheDocument()
    expect(within(await rowFor('Adjust quantity')).getByText('Either way')).toBeInTheDocument()
  })

  it('separates a type nothing has been written under from one with history', async () => {
    renderPage()

    expect(within(await rowFor('Adjust quantity')).getByText('Never used')).toBeInTheDocument()
    expect(within(await rowFor('Damaged')).getByText('7 rows')).toBeInTheDocument()
  })

  it('marks which types came with the company', async () => {
    renderPage()

    expect(within(await rowFor('Damaged')).getByText('Standard')).toBeInTheDocument()
    expect(within(await rowFor('Shrinkage')).queryByText('Standard')).toBeNull()
  })

  it('offers the status filter at all', async () => {
    // It was passed to FilterBar as a child once. FilterBar renders a `filters`
    // prop and nothing else, so the control silently never appeared — the page
    // looked right, every test passed, and the filter simply was not there.
    renderPage()
    await screen.findByText('Damaged')

    // By role, not by text: "Status" is also a column header, and matching
    // that would pass with no filter on the page at all.
    expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument()
  })

  it('narrows to the switched-off ones when asked', async () => {
    renderPage()
    await screen.findByText('Damaged')

    await userEvent.click(screen.getByRole('button', { name: /status/i }))
    // By role: "Switched off" is also the status pill on the Shrinkage row,
    // and clicking that would prove nothing.
    await userEvent.click(await screen.findByRole('option', { name: /switched off/i }))

    await waitFor(() => expect(screen.queryByText('Damaged')).toBeNull())
    expect(screen.getByText('Shrinkage')).toBeInTheDocument()
  })

  it('shows the switched-off ones, which is the whole point of this screen', async () => {
    renderPage()

    // The drawer that picks a type asks for active only; this one must not,
    // or a type switched off could never be switched back on.
    expect(within(await rowFor('Shrinkage')).getByText('Switched off')).toBeInTheDocument()
  })
})

describe('without permission to manage preferences', () => {
  it('offers no way to add or change one', async () => {
    signIn([PERMISSIONS.ADJUSTMENTS_VIEW])
    renderPage()
    const row = await rowFor('Damaged')

    expect(screen.queryByRole('button', { name: /new type/i })).toBeNull()
    // No actions column at all, so no menu button on the row.
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('still lets the list be read and printed', async () => {
    signIn([PERMISSIONS.ADJUSTMENTS_VIEW])
    renderPage()

    expect(await screen.findByText('Damaged')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeEnabled()
  })
})

const EDIT = /edit adjustment type/i
const NEW = /new adjustment type/i

/** Opens the edit drawer on a row and renames it. */
async function renameTo(row: string, name: string) {
  renderPage()
  await userEvent.click(await screen.findByText(row))

  const field = await screen.findByRole('dialog', { name: EDIT }).then(() => drawer(EDIT))
  const input = field.getByLabelText('Name')
  await userEvent.clear(input)
  await userEvent.type(input, name)
  await userEvent.click(field.getByRole('button', { name: /save changes/i }))

  await waitFor(() => expect(updateAdjustmentType).toHaveBeenCalled())

  const [, payload] = updateAdjustmentType.mock.calls[0] as unknown as [
    number,
    Record<string, unknown>,
  ]
  return payload
}

describe('the drawer', () => {
  it('will not let the code be changed once the type exists', async () => {
    renderPage()
    await userEvent.click(await screen.findByText('Damaged'))

    const code = drawer(EDIT).getByLabelText('Code')

    expect(code).toBeDisabled()
    expect(code).toHaveValue('damaged')
  })

  it('takes a code on a new one', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /new type/i }))

    expect(drawer(NEW).getByLabelText('Code')).toBeEnabled()
  })

  it('never sends the code on an edit, because the server prohibits it', async () => {
    const payload = await renameTo('Damaged', 'Broken')

    expect(payload).not.toHaveProperty('code')
    expect(payload.name).toBe('Broken')
  })

  it('sends only what actually moved', async () => {
    const payload = await renameTo('Damaged', 'Broken')

    // Direction and memo were not touched, so they are not in the payload —
    // an edit that resends every field can undo somebody else's change.
    expect(Object.keys(payload)).toEqual(['name'])
  })

  it('warns before the direction of a type with history is changed', async () => {
    renderPage()
    await userEvent.click(await screen.findByText('Damaged'))

    expect(drawer(EDIT).getByText(/7 rows have already been written/i)).toBeInTheDocument()
  })

  it('says nothing of the sort for one nothing has been written under', async () => {
    renderPage()
    await userEvent.click(await screen.findByText('Adjust quantity'))

    const open = drawer(EDIT)
    expect(open.getByLabelText('Name')).toHaveValue('Adjust quantity')
    expect(open.queryByText(/already been written/i)).toBeNull()
  })
})
