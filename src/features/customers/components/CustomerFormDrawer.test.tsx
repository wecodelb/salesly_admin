import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdminCustomer } from '../types'
import { ActionProgressDialog } from '@/shared/components/ActionProgress/ActionProgressDialog'
import { useActionProgressStore } from '@/shared/hooks/use-action-progress'
import { useToastStore } from '@/shared/hooks/use-toast'

// ─── THE NETWORK EDGE ───────────────────────────────────────────────────────
// Stub the api module, not the hooks that wrap it: the drawer's whole job is
// choosing *which* call to make with *what* payload, and that decision lives in
// the hooks. Mocking the hooks would test the mock.
//
// Every function `hooks/use-customers.ts` imports has to appear here. A factory
// that returns only the two the drawer happens to call leaves the hook module
// holding undefined bindings for the rest, and the component dies on first
// render with "createCustomer is not a function" — which reads like a drawer
// bug and isn't one.
const api = vi.hoisted(() => ({
  fetchCustomers: vi.fn(),
  fetchCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  restoreCustomer: vi.fn(),
  setCustomerActive: vi.fn(),
  verifyCustomer: vi.fn(),
  uploadAttachments: vi.fn(),
  deleteAttachment: vi.fn(),
  assignPriceList: vi.fn(),
  unassignPriceList: vi.fn(),
}))

vi.mock('../api/customers-api', () => api)

// ─── REFERENCE DATA ─────────────────────────────────────────────────────────
// Fixed options so the pickers are deterministic and an assertion on a picked
// value means something.
const ref = vi.hoisted(() => ({
  areas: [
    { id: 7, company_id: 1, code: 'BEY', name: 'Beirut', customers_count: 3 },
    { id: 8, company_id: 1, code: 'TRI', name: 'Tripoli', customers_count: 1 },
  ],
  currencies: [
    {
      id: 1,
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimal_places: 2,
      symbol_position: 'before',
      is_base: true,
      is_active: true,
    },
  ],
  priceLists: [{ id: 4, name: 'Wholesale', is_default: false, is_active: true }],
  customerGroups: [
    { id: 21, company_id: 1, name: 'New', sort_order: 1, customers_count: 0 },
    { id: 22, company_id: 1, name: 'VIP', sort_order: 2, customers_count: 5 },
  ],
  salesmen: [
    { id: 12, name: 'Karim Haddad' },
    { id: 13, name: 'Rana Aoun' },
  ],
}))

vi.mock('@/features/areas/hooks/use-areas', () => ({
  useAreas: () => ({ data: ref.areas }),
}))

vi.mock('@/features/currencies/hooks/use-currencies', () => ({
  useCurrencies: () => ({ data: ref.currencies }),
}))

vi.mock('@/features/customer-groups/hooks/use-customer-groups', () => ({
  useCustomerGroups: () => ({ data: ref.customerGroups }),
}))

vi.mock('@/features/price-lists/hooks/use-price-lists', () => ({
  usePriceLists: () => ({ data: ref.priceLists }),
}))

// `useSalesmen` shares a module with every mutation hook under test, so this
// one is a partial mock: the real module loads, and only the salesman lookup
// (which would otherwise go out to GET /users) is swapped out.
vi.mock('../hooks/use-customers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/use-customers')>()),
  useSalesmen: () => ({ data: ref.salesmen }),
}))

const { CustomerFormDrawer } = await import('./CustomerFormDrawer')

// ─── HARNESS ────────────────────────────────────────────────────────────────
// The drawer starts closed and a button opens it, so every test walks the same
// path a user does: click "New customer", then work inside the panel.
function Harness({ customer }: { customer?: AdminCustomer }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>New customer</button>
      <CustomerFormDrawer open={open} onClose={() => setOpen(false)} customer={customer} />
    </>
  )
}

function renderDrawer(customer?: AdminCustomer) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <Harness customer={customer} />
    </QueryClientProvider>,
  )
}

/** Opens the drawer and hands back the userEvent session that did it. */
async function openDrawer(customer?: AdminCustomer) {
  const user = userEvent.setup()
  renderDrawer(customer)
  await user.click(screen.getByRole('button', { name: 'New customer' }))
  return user
}

const addressBoxes = () => screen.getAllByPlaceholderText('Street, building, floor')

/** The real <input type="file"> the styled "Add files" button drives. */
const filePicker = () => document.querySelector('input[type="file"]') as HTMLInputElement

const EXISTING: AdminCustomer = {
  id: 42,
  code: 'CUST-042',
  name: 'Al Watan Grocery',
  phone1: '03 111 222',
  phone2: '',
  email: 'watan@shop.test',
  address: 'Hamra Street 12',
  salesman_id: 12,
  salesman_name: 'Karim Haddad',
  credit_limit: 5000,
  balance: 1200,
  area_id: 7,
  currency_id: 1,
  is_active: true,
  is_verified: true,
  addresses: [
    { id: 1, label: 'Shop', address: 'Hamra Street 12', latitude: 33.89, longitude: 35.5, is_primary: true },
  ],
}

beforeEach(() => {
  // vi.fn()s are module-level, so without this every "was it called?" assertion
  // sees the previous test's calls too.
  vi.clearAllMocks()
  api.createCustomer.mockResolvedValue({ id: 501 })
  api.updateCustomer.mockResolvedValue(undefined)
  api.uploadAttachments.mockResolvedValue([])
  api.assignPriceList.mockResolvedValue(undefined)
  api.deleteAttachment.mockResolvedValue(undefined)
  // Edit mode fetches the detail for addresses/attachments the list omits.
  api.fetchCustomer.mockResolvedValue(EXISTING)
})

describe('failed validation', () => {
  it('says so and jumps to the first flagged field rather than failing silently', async () => {
    useToastStore.setState({ toasts: [] })
    const user = await openDrawer()

    // Nothing typed: Code and Name are both required.
    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(screen.getByLabelText('Code')).toHaveFocus())
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'warning' })
    expect(api.createCustomer).not.toHaveBeenCalled()
  })
})

describe('financial section', () => {
  it('sends retail as the price level unless another is picked', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-910')
    await user.type(screen.getByLabelText('Name'), 'Corner Shop')
    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))
    expect(api.createCustomer.mock.calls[0][0]).toMatchObject({ price_level: 'retail' })
  })

  it('sends the picked level, and the group under its own key', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-911')
    await user.type(screen.getByLabelText('Name'), 'Bulk Buyer')
    await user.selectOptions(screen.getByLabelText('Price level'), 'wholesale')

    // The group picker is a custom listbox, not a native select.
    await user.click(screen.getByRole('button', { name: /customer group/i }))
    await user.click(await screen.findByRole('button', { name: 'VIP' }))

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))
    expect(api.createCustomer.mock.calls[0][0]).toMatchObject({
      price_level: 'wholesale',
      customer_group_id: 22,
    })
  })
})

describe('allow credit', () => {
  const limitField = () => screen.queryByLabelText('Credit limit (optional)')

  it('starts allowed, with the limit field on show', async () => {
    await openDrawer()

    expect(screen.getByLabelText('Allow credit')).toBeChecked()
    expect(limitField()).toBeInTheDocument()
  })

  it('hides the limit when credit is turned off, and sends no cap', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-912')
    await user.type(screen.getByLabelText('Name'), 'Cash Only Shop')
    await user.type(limitField()!, '750')

    // Cleared after a number was typed: the field goes, and so does the number.
    // Leaving it behind would put a cap on a customer who cannot draw against it
    // at all, ready to spring back the day credit is switched on again.
    await user.click(screen.getByLabelText('Allow credit'))
    expect(limitField()).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))
    expect(api.createCustomer.mock.calls[0][0]).toMatchObject({
      allow_credit: false,
      credit_limit: null,
    })
  })

  it('sends the limit alongside the flag when credit is allowed', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-913')
    await user.type(screen.getByLabelText('Name'), 'Trusted Shop')
    await user.type(limitField()!, '2500')
    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))
    expect(api.createCustomer.mock.calls[0][0]).toMatchObject({
      allow_credit: true,
      credit_limit: 2500,
    })
  })

  it('reads a cash-only customer back as cash-only', async () => {
    await openDrawer({ ...EXISTING, allow_credit: false, credit_limit: null })

    expect(screen.getByLabelText('Allow credit')).not.toBeChecked()
    expect(limitField()).not.toBeInTheDocument()
  })
})

describe('progress dialog', () => {
  it('covers the create with the centre-screen dialog: spinner, then success', async () => {
    // The dialog lives in AppShell in the real app; mounted here so the
    // drawer's half of the contract — actually calling run() — is what's tested.
    useActionProgressStore.setState({ action: null })

    let resolveCreate!: (value: { id: number }) => void
    api.createCustomer.mockImplementation(
      () => new Promise<{ id: number }>((res) => { resolveCreate = res }),
    )

    const user = userEvent.setup()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <Harness />
        <ActionProgressDialog />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'New customer' }))
    await user.type(screen.getByLabelText('Code'), 'CUST-902')
    await user.type(screen.getByLabelText('Name'), 'Hanna Supermarket')
    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Creating customer…')).toBeInTheDocument()

    resolveCreate({ id: 501 })

    expect(await screen.findByText('Hanna Supermarket has been saved.')).toBeInTheDocument()
  })
})

describe('create flow', () => {
  it('sends the typed code, name and address, with that address primary', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-900')
    await user.type(screen.getByLabelText('Name'), 'Hanna Supermarket')
    await user.type(addressBoxes()[0], 'Hamra Street 12')

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))

    const payload = api.createCustomer.mock.calls[0][0]
    expect(payload).toMatchObject({ code: 'CUST-900', name: 'Hanna Supermarket' })
    expect(payload.addresses).toHaveLength(1)
    expect(payload.addresses[0]).toMatchObject({
      address: 'Hamra Street 12',
      is_primary: true,
    })
    expect(api.updateCustomer).not.toHaveBeenCalled()
  })

  it('drops the untouched blank address row instead of failing on it', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-901')
    await user.type(screen.getByLabelText('Name'), 'Corner Shop')

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))
    expect(api.createCustomer.mock.calls[0][0].addresses).toEqual([])
    expect(screen.queryByText('Address is required')).not.toBeInTheDocument()
  })

  it('carries the area picked on an address through to that address', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-902')
    await user.type(screen.getByLabelText('Name'), 'Tripoli Mart')
    await user.type(addressBoxes()[0], 'Mina Road 4')

    // The area belongs to the place, not the customer: it is picked inside the
    // address box, and the backend mirrors the primary one onto the customer.
    await user.click(screen.getByRole('button', { name: /^Area/ }))
    await user.click(await screen.findByRole('button', { name: 'Tripoli (TRI)' }))

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))

    const payload = api.createCustomer.mock.calls[0][0]
    expect(payload.addresses[0]).toMatchObject({ address: 'Mina Road 4', area_id: 8 })
    // No customer-level area is sent — sending one would fight the mirroring.
    expect(payload).not.toHaveProperty('area_id')
  })
})

describe('validation', () => {
  it('shows the required-field errors and calls nothing when submitted empty', async () => {
    const user = await openDrawer()

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    expect(await screen.findByText('Code is required')).toBeInTheDocument()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(api.createCustomer).not.toHaveBeenCalled()
    expect(api.updateCustomer).not.toHaveBeenCalled()
  })

  it('rejects a malformed email', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-903')
    await user.type(screen.getByLabelText('Name'), 'Bad Email Shop')
    await user.type(screen.getByLabelText(/^Email/), 'not-an-email')

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(api.createCustomer).not.toHaveBeenCalled()
  })
})

describe('primary address', () => {
  it('leaves only the last-marked row primary', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-904')
    await user.type(screen.getByLabelText('Name'), 'Two Door Grocery')

    await user.type(addressBoxes()[0], 'Warehouse Road 1')
    await user.click(screen.getByRole('button', { name: /add address/i }))
    await user.type(addressBoxes()[1], 'Shop Front 2')

    // The first row is primary by default until another one is chosen.
    const radios = screen.getAllByRole('radio')
    expect(radios[0]).toBeChecked()

    await user.click(radios[1])
    expect(screen.getAllByRole('radio')[0]).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))

    const { addresses } = api.createCustomer.mock.calls[0][0]
    expect(addresses).toHaveLength(2)
    expect(addresses[0]).toMatchObject({ address: 'Warehouse Road 1', is_primary: false })
    expect(addresses[1]).toMatchObject({ address: 'Shop Front 2', is_primary: true })
  })
})

describe('attachment ceiling', () => {
  it('flags a file over the 2 MB cap and blocks the save', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-905')
    await user.type(screen.getByLabelText('Name'), 'Heavy Files Ltd')
    await user.type(addressBoxes()[0], 'Dock 9')

    const big = new File([new ArrayBuffer(3 * 1024 * 1024)], 'big.pdf')
    await user.upload(filePicker(), big)

    expect(await screen.findByText('big.pdf')).toBeInTheDocument()
    expect(screen.getByText(/3\.00 MB of 2\.00 MB used/)).toBeInTheDocument()
    expect(
      screen.getByText(/1\.00 MB over the 2\.00 MB a customer may hold/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    // Nothing is created, and no upload is attempted either.
    expect(api.createCustomer).not.toHaveBeenCalled()
    expect(api.uploadAttachments).not.toHaveBeenCalled()
  })

  it('saves once the over-cap file is removed again', async () => {
    const user = await openDrawer()

    await user.type(screen.getByLabelText('Code'), 'CUST-906')
    await user.type(screen.getByLabelText('Name'), 'Lighter Ltd')

    await user.upload(filePicker(), new File([new ArrayBuffer(3 * 1024 * 1024)], 'big.pdf'))
    await screen.findByText('big.pdf')

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(screen.queryByText('big.pdf')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1))
  })
})

describe('edit mode', () => {
  it('pre-fills the customer and updates instead of creating', async () => {
    const user = await openDrawer(EXISTING)

    expect(screen.getByLabelText('Code')).toHaveValue('CUST-042')
    expect(screen.getByLabelText('Name')).toHaveValue('Al Watan Grocery')
    // Labelled "Phone 1 (optional)"; a number stored without a dialling code
    // stays exactly as it was until someone edits it.
    expect(screen.getByLabelText(/^Phone 1/)).toHaveValue('03 111 222')
    expect(screen.getByLabelText(/^Email/)).toHaveValue('watan@shop.test')
    expect(screen.getByLabelText(/^Credit limit/)).toHaveValue(5000)
    // The stored address comes back as a row, already flagged primary.
    expect(addressBoxes()[0]).toHaveValue('Hamra Street 12')
    expect(screen.getAllByRole('radio')[0]).toBeChecked()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Al Watan Market')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.updateCustomer).toHaveBeenCalledTimes(1))
    expect(api.createCustomer).not.toHaveBeenCalled()

    const [id, payload] = api.updateCustomer.mock.calls[0]
    expect(id).toBe(42)
    expect(payload).toMatchObject({ code: 'CUST-042', name: 'Al Watan Market' })
    expect(payload.addresses[0]).toMatchObject({
      address: 'Hamra Street 12',
      is_primary: true,
    })
  })
})
