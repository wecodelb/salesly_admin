import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  fetchOrderRules: vi.fn(),
  saveOrderRules: vi.fn(),
}))

vi.mock('../api/orders-api', () => api)
vi.mock('@/features/customers/hooks/use-customers', () => ({
  useSalesmen: () => ({ data: [{ id: 4, name: 'Ahmad Khalil' }] }),
}))

const { OrdersPage } = await import('./OrdersPage')

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OrdersPage />
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
    api.fetchOrders.mockReset().mockResolvedValue(PAGE)
    api.fetchOrder.mockReset().mockImplementation(async (id: number) => PAGE.orders.find((o) => o.id === id))
    api.approveOrder.mockReset().mockResolvedValue(order({ status: 'APPROVED' }))
    api.rejectOrder.mockReset().mockResolvedValue(order({ status: 'REJECTED' }))
    api.fetchOrderRules.mockReset().mockResolvedValue({ auto_approve: true, max_auto_approve_total: 3000, overdue_days: 30 })
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

  it('approves a waiting order from its drawer', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByText('#101'))
    await userEvent.click(await screen.findByRole('button', { name: /Approve order/ }))

    expect(api.approveOrder).toHaveBeenCalledWith(1, undefined)
  })

  it('will not reject without a reason the salesman can read', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByText('#101'))
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

    await userEvent.click(await screen.findByText('#101'))
    expect(await screen.findByText('Nescafé Classic 50g')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve order/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approval rules/ })).not.toBeInTheDocument()
  })

  it('opens the approval rules with the values the company saved', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Approval rules/ }))

    expect(await screen.findByDisplayValue('3000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
  })

  it('shows each line in the packaging it was sold in', async () => {
    signIn(['orders'], [PERMISSIONS.ORDERS_VIEW])
    renderPage()

    await userEvent.click(await screen.findByText('#101'))

    expect(await screen.findByText('5 Box · $24.00 each')).toBeInTheDocument()
  })
})
