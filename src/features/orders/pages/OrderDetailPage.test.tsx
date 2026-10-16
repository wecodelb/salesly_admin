import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { PERMISSIONS } from '@/core/auth/permissions'
import type { Order } from '../types'

const ORDER: Order = {
  id: 1,
  trs_number: 101,
  trs_date: '15/10/2026 09:00',
  status: 'APPROVED',
  customer: { id: 9, code: 'C-9', name: 'Al Watan Grocery', phone: null, balance: 480, credit_limit: 500 },
  salesman: { id: 4, name: 'Ahmad Khalil' },
  warehouse: { id: 1, name: 'Main Warehouse' },
  delivery_date: '2026-10-16',
  deliverer: { id: 4, name: 'Ahmad Khalil' },
  submitted_at: null,
  decided_at: '15/10/2026 10:00',
  decided_by: 5,
  decided_by_name: 'Rania Khoury',
  hold_reasons: [],
  rejected_reason: null,
  total_qty: 60,
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
}

const api = vi.hoisted(() => ({ fetchOrder: vi.fn(), cancelOrder: vi.fn(), approveOrder: vi.fn(), rejectOrder: vi.fn() }))
vi.mock('../api/orders-api', () => api)
// The approve drawer is only opened from a waiting order; these tests never do.
vi.mock('../components/OrderApproveDrawer', () => ({ OrderApproveDrawer: () => null }))
// The paper copy has its own test; here the screen is read alone.
vi.mock('../components/OrderPrintSheet', () => ({ OrderPrintSheet: () => null }))

const { OrderDetailPage } = await import('./OrderDetailPage')

function renderPage(permissions: string[]) {
  useAuthStore.setState({
    token: 't',
    role: 'manager',
    permissions: permissions as never,
    modules: ['orders'] as never,
    user: { id: '9', name: 'Office', email: 'o@x.test', company: 'Acme Distribution' },
    hasHydrated: true,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/orders/1']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('an order\'s own page', () => {
  beforeEach(() => api.fetchOrder.mockReset())

  it('shows an approved order\'s goods held in the warehouse, not on the van', async () => {
    api.fetchOrder.mockResolvedValue(ORDER)
    renderPage([PERMISSIONS.ORDERS_VIEW])

    expect(await screen.findByText('Order #101')).toBeInTheDocument()
    expect(
      screen.getByText(
        "Held for this order in Main Warehouse — still in the warehouse. They move to Ahmad Khalil's van only when he signs for them on his load.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Approved by Rania Khoury')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Approved')
  })

  it('lists each line in the packaging it was ordered in, priced per packaging', async () => {
    api.fetchOrder.mockResolvedValue(ORDER)
    renderPage([PERMISSIONS.ORDERS_VIEW])

    expect(await screen.findByText('5 Box')).toBeInTheDocument()
    expect(screen.getByText('$24.00')).toBeInTheDocument()
    expect(screen.getAllByText('$120.00').length).toBeGreaterThan(0)
  })

  it('offers the decision on a waiting order to whoever may approve', async () => {
    api.fetchOrder.mockResolvedValue({
      ...ORDER,
      status: 'SUBMITTED',
      decided_by: null,
      decided_by_name: null,
      hold_reasons: [{ code: 'credit', message: 'Over the limit.' }],
    })
    renderPage([PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_APPROVE])

    expect(await screen.findByRole('button', { name: /Review & approve/ })).toBeInTheDocument()
    expect(screen.getByText('Over the limit.')).toBeInTheDocument()
    expect(screen.getByText(/Nothing is held yet/)).toBeInTheDocument()
  })

  it('prints the order from its page', async () => {
    api.fetchOrder.mockResolvedValue(ORDER)
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderPage([PERMISSIONS.ORDERS_VIEW])

    await userEvent.click(await screen.findByRole('button', { name: /Print order/ }))

    expect(print).toHaveBeenCalledOnce()
    print.mockRestore()
  })
})
