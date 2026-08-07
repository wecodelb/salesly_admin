import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { PERMISSIONS, type Permission } from '@/core/auth/permissions'
import type { Currency, ExchangeRate } from '../types'

const USD: Currency = {
  id: 1,
  code: 'USD',
  name: 'US Dollar',
  symbol: '$',
  decimal_places: 2,
  symbol_position: 'before',
  is_base: true,
  is_active: true,
}

const LBP: Currency = {
  id: 2,
  code: 'LBP',
  name: 'Lebanese Pound',
  symbol: 'L£',
  decimal_places: 0,
  symbol_position: 'after',
  is_base: false,
  is_active: true,
}

/** Seeded but never priced — the case that used to fill the panel with rows for
 *  rates nobody had entered. */
const EUR: Currency = {
  id: 3,
  code: 'EUR',
  name: 'Euro',
  symbol: '€',
  decimal_places: 2,
  symbol_position: 'before',
  is_base: false,
  is_active: true,
}

const rate = (id: number, value: number, from: string): ExchangeRate => ({
  id,
  currency_id: LBP.id,
  currency: { id: LBP.id, code: LBP.code, symbol: LBP.symbol },
  rate: value,
  effective_at: from,
  // Left null on every row on purpose: entries recorded before the backend
  // started closing superseded windows look like this, and it's why current
  // versus replaced has to be read off the ordering rather than an end date.
  effective_to: null,
  created_by_name: 'Rita',
  created_at: from,
})

// Newest first — the order the endpoint sorts in (effective_at desc, id desc)
// and the only thing that says which of these is the rate in force.
const RATES = [
  rate(30, 90000, '2026-08-01'),
  rate(20, 89500, '2026-06-01'),
  rate(10, 89000, '2026-01-01'),
]

// Stubbed at the network edge rather than at the hooks, so the derivation under
// test runs on data shaped exactly as the API delivers it.
vi.mock('../api/currencies-api', () => ({
  fetchCurrencies: async () => [USD, LBP, EUR],
  fetchExchangeRates: async () => RATES,
  createCurrency: async () => undefined,
  updateCurrency: async () => undefined,
  setBaseCurrency: async () => undefined,
  createExchangeRate: async () => undefined,
  deleteExchangeRate: async () => undefined,
}))

const { CurrenciesPage } = await import('./CurrenciesPage')

/** The page formats figures with the runtime's locale; matching against the
 *  same call keeps the assertions from depending on which one that is. */
const expression = (value: number) => `1 USD = ${value.toLocaleString()} LBP`

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <CurrenciesPage />
    </QueryClientProvider>,
  )
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

/** The rates panel and its body rows. The table paints skeletons while the
 *  query is in flight and those are `role="row"` too, so wait for real content
 *  before counting. */
async function ratesTable() {
  const panel = (await screen.findByText('Exchange rates')).closest('section')!
  await within(panel).findByText(expression(89000))
  return { panel, rows: within(panel).getAllByRole('row').slice(1) }
}

beforeEach(() => {
  signIn([PERMISSIONS.EXCHANGE_RATES_VIEW, PERMISSIONS.EXCHANGE_RATES_MANAGE])
})

describe('the exchange rates panel', () => {
  it('lists every recorded rate newest first, and nothing for a currency without one', async () => {
    renderPage()

    const { panel, rows } = await ratesTable()

    expect(rows).toHaveLength(RATES.length)
    expect(within(rows[0]).getByText(expression(90000))).toBeInTheDocument()
    expect(within(rows[1]).getByText(expression(89500))).toBeInTheDocument()
    expect(within(rows[2]).getByText(expression(89000))).toBeInTheDocument()
    // EUR exists in the catalog but was never priced; it earns no row.
    expect(within(panel).queryByText(/EUR/)).toBeNull()
  })

  it('marks only the newest rate as the one in force', async () => {
    renderPage()

    const { panel, rows } = await ratesTable()

    expect(within(panel).getAllByText('Current')).toHaveLength(1)
    expect(within(rows[0]).getByText('Current')).toBeInTheDocument()
    expect(within(rows[1]).queryByText('Current')).toBeNull()
    expect(within(rows[2]).queryByText('Current')).toBeNull()

    expect(within(rows[0]).getByText('still in force')).toBeInTheDocument()
  })

  it('closes each superseded window where the rate that replaced it opens', async () => {
    renderPage()

    const { rows } = await ratesTable()

    // 89,500 ran until 90,000 took over, and 89,000 until 89,500 did — read off
    // the neighbouring rows, since none of them carries an end date.
    expect(within(rows[1]).getByText('until 2026-08-01')).toBeInTheDocument()
    expect(within(rows[2]).getByText('until 2026-06-01')).toBeInTheDocument()
    // Only the top row is still being applied.
    expect(within(rows[1]).queryByText('still in force')).toBeNull()
    expect(within(rows[2]).queryByText('still in force')).toBeNull()
  })

  it('hides the record and delete actions without exchange_rates.manage', async () => {
    signIn([PERMISSIONS.EXCHANGE_RATES_VIEW])
    renderPage()

    const { panel, rows } = await ratesTable()

    expect(within(panel).queryByRole('button', { name: 'New rate' })).toBeNull()
    expect(within(rows[0]).queryByTitle('Delete this entry')).toBeNull()
  })
})
