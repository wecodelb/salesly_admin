import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ItemDistribution } from '../types'

/** ITM-0110's real position: out with a salesman, on the shelf, and a third
 *  location holding cartons that are entirely spoken for. */
const ROWS: ItemDistribution[] = [
  {
    warehouse: {
      id: 2,
      code: 'DEP-1',
      name: 'Depot 1',
      is_depot: true,
      max_weight: null,
      max_volume: null,
      salesman: { id: 7, name: 'Ahmad Khalil' },
    },
    qty: 49,
    available_qty: 44,
    reserved_qty: 5,
  },
  {
    warehouse: {
      id: 1,
      code: 'MAIN',
      name: 'Main Warehouse',
      is_depot: false,
      max_weight: null,
      max_volume: null,
    },
    qty: 88,
    available_qty: 48,
    reserved_qty: 0,
  },
  {
    warehouse: {
      id: 3,
      code: 'OVF',
      name: 'Overflow Store',
      is_depot: false,
      max_weight: null,
      max_volume: null,
    },
    qty: 17,
    available_qty: 0,
    reserved_qty: 0,
  },
]

// Stubbed at the network edge rather than at the hook, so the panel runs on
// data shaped exactly as the endpoint delivers it.
const fetchItemDistribution = vi.fn(async (): Promise<ItemDistribution[]> => ROWS)

vi.mock('../api/products-api', () => ({
  fetchItemDistribution: () => fetchItemDistribution(),
  fetchProducts: async () => [],
  fetchProduct: async () => undefined,
  createItem: async () => undefined,
  updateItem: async () => undefined,
  deleteItem: async () => undefined,
  fetchCategories: async () => [],
  createCategory: async () => undefined,
  fetchUoms: async () => [],
  fetchBrands: async () => [],
  createBrand: async () => undefined,
  fetchCurrencies: async () => [],
}))

const { ProductDistributionPanel } = await import('./ProductDistributionPanel')

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <ProductDistributionPanel itemId={110} />
    </QueryClientProvider>,
  )
}

/** The body rows, once the query has resolved — the panel paints skeletons
 *  first and those carry no cells to match against. */
async function locationRows() {
  await screen.findByText('Main Warehouse')
  const table = screen.getByRole('table')
  // Header and totals sit in their own sections; only the body is a location.
  return within(within(table).getAllByRole('rowgroup')[1]).getAllByRole('row')
}

describe('the stock distribution panel', () => {
  it('adds every location up in the totals row', async () => {
    renderPanel()

    await screen.findByText('Main Warehouse')
    const totals = screen.getByText('All locations').closest('tr')!

    expect(within(totals).getByText('154')).toBeInTheDocument()
    expect(within(totals).getByText('92')).toBeInTheDocument()
    expect(within(totals).getByText('5')).toBeInTheDocument()
    expect(within(totals).getByText(/3 locations/)).toBeInTheDocument()
  })

  it('reads a fully committed location as committed, not as out of stock', async () => {
    renderPanel()

    const rows = await locationRows()
    const committed = rows.find((r) => within(r).queryByText('Overflow Store'))!

    expect(within(committed).getByText('Fully committed')).toBeInTheDocument()
    expect(within(committed).queryByText('Out of stock')).toBeNull()
    // The cartons are still there — the row must not read as an empty shelf.
    expect(within(committed).getByText('17')).toBeInTheDocument()
  })

  it('names the salesman carrying a depot and marks the row as one', async () => {
    renderPanel()

    const rows = await locationRows()
    const carried = rows.find((r) => within(r).queryByText('Depot 1'))!

    expect(within(carried).getByText('Depot')).toBeInTheDocument()
    expect(within(carried).getByText('Ahmad Khalil is carrying 49')).toBeInTheDocument()
    expect(within(carried).getByText('44 free')).toBeInTheDocument()
  })

  it('keeps the endpoint order — who is carrying it before what is on the shelf', async () => {
    renderPanel()

    const rows = await locationRows()
    expect(within(rows[0]).getByText('Depot 1')).toBeInTheDocument()
  })

  it('says the product has never been stocked rather than showing a bare zero', async () => {
    fetchItemDistribution.mockResolvedValueOnce([])
    renderPanel()

    expect(await screen.findByText('Never stocked anywhere')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
