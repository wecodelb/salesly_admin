import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { PERMISSIONS } from '@/core/auth/permissions'
import type { Order, OrdersPage as OrdersPageData } from '../types'

function order(over: Partial<Order>): Order {
  return {
    id: 1,
    trs_number: 101,
    trs_date: '15/10/2026 09:00',
    status: 'SUBMITTED',
    customer: { id: 9, code: 'C-9', name: 'Al Watan Grocery', phone: null, balance: 480, credit_limit: 500 },
    salesman: { id: 4, name: 'Ahmad Khalil' },
    warehouse: { id: 1, name: 'Main warehouse' },
    delivery_date: '2026-10-16',
    deliverer: { id: 4, name: 'Ahmad Khalil' },
    submitted_at: null,
    decided_at: null,
    decided_by: null,
    decided_by_name: null,
    hold_reasons: [{ code: 'credit', message: 'This order takes the customer past their credit limit.' }],
    rejected_reason: null,
    total_qty: 10,
    total_price: 120,
    total_price_lbp: 10740000,
    currency: 'USD',
    memo: null,
    rows: [
      {
        id: 1,
        item_id: 3,
        uom_id: 2,
        trs_qty: 5,
        qty: 60,
        price: 2,
        total: 120,
        item_code: 'NES-1',
        item_name: 'Nescafé Classic 50g',
        uom_name: 'Box',
        unit: 12,
      },
    ],
    ...over,
  }
}

const PAGE: OrdersPageData = {
  orders: [order({}), order({ id: 2, trs_number: 102, status: 'APPROVED', hold_reasons: [] })],
  total: 2,
  lastPage: 1,
  pendingApproval: 1,
}

const api = vi.hoisted(() => ({
  fetchOrders: vi.fn(),
  fetchOrder: vi.fn(),
  approveOrder: vi.fn(),
  rejectOrder: vi.fn(),
  cancelOrder: vi.fn(),
  fetchOrderStock: vi.fn(),
}))

// The catalogue the drawer's pickers are built from: a jar sold by the piece
// or in boxes of twelve.
const PRODUCTS = [
  {
    id: 3,
    code: 'NES-1',
    name: 'Nescafé Classic 50g',
    uom_id: 1,
    uom: 'Piece',
    uoms: [
      { uom_id: 1, unit: 1, uom: { id: 1, code: 'PCS', name: 'Piece' } },
      { uom_id: 2, unit: 12, uom: { id: 2, code: 'BOX', name: 'Box' } },
    ],
  },
]

vi.mock('../api/orders-api', () => api)
vi.mock('@/features/customers/hooks/use-customers', () => ({
  useSalesmen: () => ({ data: [{ id: 4, name: 'Ahmad Khalil' }] }),
  useCustomers: () => ({ data: [{ id: 9, name: 'Al Watan Grocery' }] }),
}))
const catalogue = vi.hoisted(() => ({ loading: false }))
vi.mock('@/features/products/hooks/use-products', () => ({
  useProducts: () => (catalogue.loading ? { data: undefined, isLoading: true } : { data: PRODUCTS, isLoading: false }),
}))
vi.mock('@/features/warehouses/hooks/use-warehouses', () => ({
  useWarehouses: () => ({ data: [{ id: 1, name: 'Main warehouse', is_depot: false }] }),
}))

const { OrdersPage, OrderRequestsPage } = await import('./OrdersPage')

function renderPage(path = '/orders') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/order-requests" element={<OrderRequestsPage />} />
          <Route path="/orders/:id" element={<p>order page {window.location.pathname}</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function signIn(modules: string[], permissions: string[]) {
  useAuthStore.setState({
    token: 't',
    role: 'manager',
    permissions: permissions as never,
    modules: modules as never,
    user: { id: '9', name: 'Office', email: 'o@x.test', company: 'Acme Distribution' },
    hasHydrated: true,
  })
}

describe('the orders page', () => {
  beforeEach(() => {
    catalogue.loading = false
    api.fetchOrders.mockReset().mockResolvedValue(PAGE)
    api.fetchOrder.mockReset().mockImplementation(async (id: number) => PAGE.orders.find((o) => o.id === id))
    api.approveOrder.mockReset().mockResolvedValue(order({ status: 'APPROVED' }))
    api.rejectOrder.mockReset().mockResolvedValue(order({ status: 'REJECTED' }))
    // 600 jars in the warehouse, at $2 a jar for this shop.
    api.fetchOrderStock.mockReset().mockResolvedValue([{ item_id: 3, available_qty: 600, price: 2 }])
  })

  it('tells a company without the module that orders are not in its plan', async () => {
    signIn([], [PERMISSIONS.ORDERS_VIEW])
    renderPage()

    expect(await screen.findByText("Orders aren't part of your plan")).toBeInTheDocument()
    expect(api.fetchOrders).not.toHaveBeenCalled()
  })

  it('lists the orders with why the waiting one waits, and counts the queue', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    expect(await screen.findByText('#101')).toBeInTheDocument()
    expect(screen.getByText('This order takes the customer past their credit limit.')).toBeInTheDocument()
    expect(screen.getByText('1 order is waiting for approval')).toBeInTheDocument()
  })

  it('opens a waiting order to review with its lines ready to adjust, like a load request', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Review & approve/ }))

    expect(await screen.findByText('Approve order #101')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('5')).toBeInTheDocument()
    expect(await screen.findByText('600 available')).toBeInTheDocument()
    expect(screen.getByText('$24.00 each · $120.00')).toBeInTheDocument()
  })

  it('waits for the products before showing the lines or letting the order be approved', async () => {
    catalogue.loading = true
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Review & approve/ }))

    expect(await screen.findByText('Loading products…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve order/ })).toBeDisabled()
  })

  it('approves the order as the manager adjusted it', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Review & approve/ }))
    const quantity = await screen.findByDisplayValue('5')
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '3')
    await userEvent.click(screen.getByRole('button', { name: /Approve order/ }))

    expect(api.approveOrder).toHaveBeenCalledWith(1, {
      rows: [{ item_id: 3, uom_id: 2, qty: 3 }],
      warehouse_id: 1,
      deliverer_id: 4,
      delivery_date: '2026-10-16',
      memo: '',
    })
  })

  it('stops a line the warehouse cannot fill before it is sent', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Review & approve/ }))
    const quantity = await screen.findByDisplayValue('5')
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '60')
    await userEvent.click(screen.getByRole('button', { name: /Approve order/ }))

    expect(await screen.findByText('Only 600 available')).toBeInTheDocument()
    expect(api.approveOrder).not.toHaveBeenCalled()
  })

  it('will not approve an order with every product taken off', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Review & approve/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Remove product 1' }))
    await userEvent.click(screen.getByRole('button', { name: /Approve order/ }))

    expect(await screen.findByText('An order needs at least one product')).toBeInTheDocument()
    expect(api.approveOrder).not.toHaveBeenCalled()
  })

  it('rejects from the row, and only with a reason the salesman can read', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /^Reject$/ }))
    const confirm = await screen.findByRole('button', { name: 'Reject order' })
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByRole('textbox', { name: /reads this on his phone/ }), 'Pay the open invoices first.')
    await userEvent.click(confirm)

    expect(api.rejectOrder).toHaveBeenCalledWith(1, 'Pay the open invoices first.')
  })

  it('offers no decision to someone without the approval permission', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW])
    renderPage()

    expect(await screen.findByText('#101')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Review & approve/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approval rules/ })).not.toBeInTheDocument()
  })

  it('opens an order on a page of its own, as a load request does', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW])
    renderPage()

    await userEvent.click(await screen.findByText('#101'))

    expect(await screen.findByText(/order page/)).toBeInTheDocument()
  })

  it('narrows the list by customer and by the days it was taken', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW])
    renderPage()
    await screen.findByText('#101')

    await userEvent.click(screen.getByRole('button', { name: 'Customer: All customers' }))
    await userEvent.click(screen.getByRole('option', { name: /Al Watan Grocery/ }))
    fireEvent.change(screen.getByLabelText('Taken from'), { target: { value: '2026-10-01' } })

    await vi.waitFor(() =>
      expect(api.fetchOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ customerId: 9, dateFrom: '2026-10-01', dateTo: '', page: 1 }),
      ),
    )
  })

  it('lists what the salesmen asked for on the requests screen, and nothing else', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage('/order-requests')

    expect(await screen.findByText('Order requests')).toBeInTheDocument()
    expect(api.fetchOrders.mock.calls[0][0]).toMatchObject({ status: 'SUBMITTED' })
  })

  it('lists the answered orders on the approved screen, with no approval rules any more', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    expect(await screen.findByText('Approved orders')).toBeInTheDocument()
    expect(api.fetchOrders.mock.calls[0][0]).toMatchObject({ status: 'decided' })
    expect(screen.queryByRole('button', { name: /Approval rules/ })).not.toBeInTheDocument()
  })
})
