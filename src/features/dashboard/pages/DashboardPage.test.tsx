import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DashboardSummary } from '../types'

/**
 * The payload the server actually sends, as the shape every case here varies.
 *
 * Built from a real response off GET /dashboard/summary rather than invented,
 * because the states that broke this screen are the ones real data reaches and
 * the old demo constants never did: an empty week, a fortnight of zeroes, a
 * change with nothing to compare against.
 */
const BASE: DashboardSummary = {
  generated_at: '2026-08-19T11:55:02+00:00',
  currency: 'USD',
  today: {
    sales: { value: 4280, previous: 3820, change: 12 },
    orders: { value: 32, previous: 30, change: 6.7 },
    collected: { value: 1150, previous: 1200, change: -4.2 },
    visits: { done: 27, started: 48 },
  },
  sales_trend: [
    { date: '2026-08-18', label: '18 Aug', value: 3380 },
    { date: '2026-08-19', label: '19 Aug', value: 4280 },
  ],
  top_salesmen: [
    { id: 7, name: 'Ahmad Khalil', orders: 34, total: 12400 },
    { id: 10, name: 'Sara Fares', orders: 28, total: 10850 },
  ],
  recent_orders: [
    {
      id: 8,
      number: 'SO-2',
      customer: 'Tiba Restaurant',
      customer_id: 2,
      salesman: 'Demo User',
      total: 54.06,
      status: 'COMPLETED',
      date: '2026-08-06T08:16:44+00:00',
    },
    {
      id: 7,
      number: 'SO-1',
      customer: 'Al Watan Grocery',
      customer_id: 1,
      salesman: 'Ahmad Khalil',
      total: 148.1,
      status: 'DRAFT',
      date: '2026-08-06T08:16:35+00:00',
    },
  ],
  outstanding: {
    total: 22267.12,
    customers: 18,
    // Five company-wide against two listed — the disagreement is the point.
    over_limit: 5,
    top: [
      { id: 7, name: 'Hamra Mini Market', balance: 3420, credit_limit: 3000 },
      { id: 19, name: 'Zahle Wholesale Depot', balance: 3200, credit_limit: 8000 },
      { id: 26, name: 'Dbayeh Market Hub', balance: 2100, credit_limit: null },
    ],
  },
}

let payload: DashboardSummary = BASE

// Stubbed at the network edge rather than at the hook, so everything under test
// — the query, the formatting, the charts — runs on data shaped exactly as the
// API delivers it.
vi.mock('../api/dashboard-api', () => ({
  fetchDashboardSummary: async () => payload,
}))

async function renderDashboard(summary: DashboardSummary = BASE) {
  payload = summary
  const { DashboardPage } = await import('./DashboardPage')

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  // The first paint is skeletons, and the card *labels* are on screen through
  // all of it — waiting on one of those would assert against the loading state.
  // The header stamp only says "Updated" once the figures have actually landed.
  await screen.findByText(/^Updated /)
  return screen
}

/** The card whose label this is, so assertions can't match a figure that
 *  happens to appear somewhere else on a busy screen. */
function card(title: string): HTMLElement {
  const label = screen.getByText(title)
  const box = label.closest('div.relative.overflow-hidden')
  if (!box) throw new Error(`No stat card found for "${title}"`)
  return box as HTMLElement
}

describe('DashboardPage', () => {
  beforeEach(() => {
    payload = BASE
  })

  it('shows the figures the server sent, not placeholders', async () => {
    await renderDashboard()

    expect(within(card('Sales today')).getByText('$4,280')).toBeInTheDocument()
    expect(within(card('Orders today')).getByText('32')).toBeInTheDocument()
    expect(within(card('Collected today')).getByText('$1,150')).toBeInTheDocument()
    expect(within(card('Visits done')).getByText('27/48')).toBeInTheDocument()
  })

  it('reads the movement against yesterday off the server, sign included', async () => {
    await renderDashboard()

    expect(within(card('Sales today')).getByText('+12%')).toBeInTheDocument()
    expect(within(card('Collected today')).getByText('-4%')).toBeInTheDocument()
  })

  /**
   * The distinction the old screen got wrong. Everything is up infinitely from
   * zero, so a day that went from nothing to $500 is not "+0%" — there is no
   * percentage to report, and the card has to say so.
   */
  it('shows a dash, never a percentage, when yesterday was nothing', async () => {
    await renderDashboard({
      ...BASE,
      today: {
        ...BASE.today,
        sales: { value: 500, previous: 0, change: null },
      },
    })

    const sales = within(card('Sales today'))
    expect(sales.getByText('$500')).toBeInTheDocument()
    expect(sales.getByText('—')).toBeInTheDocument()
    expect(sales.queryByText('+0%')).not.toBeInTheDocument()
  })

  it('counts accounts over their limit company-wide, not off the listed rows', async () => {
    await renderDashboard()

    // Three rows are listed and only one of them is over; the server says five.
    expect(screen.getByText(/18 accounts owing · 5 over limit/)).toBeInTheDocument()
  })

  it('says an account has no ceiling rather than drawing it against one', async () => {
    await renderDashboard()

    expect(screen.getByText('No credit limit set')).toBeInTheDocument()
    expect(screen.getByText('Over limit')).toBeInTheDocument()
  })

  /**
   * Days overdue is deliberately absent. Nothing in the schema carries a due
   * date, so the demo screen's "12 days overdue" was invented — and it was the
   * one figure a manager would have acted on.
   */
  it('never claims anything is overdue', async () => {
    await renderDashboard()

    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument()
  })

  it('names each recent order, its customer and its state', async () => {
    await renderDashboard()

    expect(screen.getByText('SO-2')).toBeInTheDocument()
    expect(screen.getByText('Tiba Restaurant')).toBeInTheDocument()
    expect(screen.getByText('$54.06')).toBeInTheDocument()
    expect(screen.getByText('Delivered')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  // ── The states real data reaches and demo data never did ─────────────

  /**
   * An empty week is ordinary: nothing has been invoiced since Monday. The
   * chart this replaced spread that empty array into Math.max, got -Infinity,
   * and sized every bar at NaN%.
   */
  it('survives a week with no invoices at all', async () => {
    await renderDashboard({ ...BASE, top_salesmen: [] })

    expect(screen.getByText('Nothing invoiced yet this week.')).toBeInTheDocument()
  })

  /** A fortnight of zeroes divided by zero when scaling the y-axis. */
  it('survives a fortnight where nothing was sold', async () => {
    await renderDashboard({
      ...BASE,
      sales_trend: BASE.sales_trend.map((point) => ({ ...point, value: 0 })),
    })

    expect(screen.getByText(/Nothing invoiced in these 2 days/)).toBeInTheDocument()
  })

  /** A brand-new company has no trend at all; `data[0].label` threw. */
  it('survives an empty trend range', async () => {
    await renderDashboard({ ...BASE, sales_trend: [] })

    expect(screen.getByText('No sales in this period.')).toBeInTheDocument()
  })

  it('survives a company with no orders and nobody owing', async () => {
    await renderDashboard({
      ...BASE,
      recent_orders: [],
      outstanding: { total: 0, customers: 0, over_limit: 0, top: [] },
    })

    expect(screen.getByText('No orders have been written yet.')).toBeInTheDocument()
    expect(screen.getByText('Nobody owes anything.')).toBeInTheDocument()
  })
})
