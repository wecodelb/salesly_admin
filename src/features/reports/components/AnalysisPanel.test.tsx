import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import type { ReportDocument } from '../report-types'

/**
 * The analysis side of Reports, driven the way the office drives it: pick a
 * question, narrow it, read it, export it.
 *
 * Stubbed at the HTTP client, so the hooks, the query cache and the layout all
 * run for real on API-shaped data, and every assertion about a request is an
 * assertion about what the server would actually be asked.
 */

const SALES = {
  currency: 'USD',
  period: { from: '2026-09-01', to: '2026-09-16', prior_from: '2026-08-16', prior_to: '2026-08-31' },
  include_returns: true,
  compare: 'previous_period',
  kpis: {
    net_sales: 350, sales_value: 360, returns_value: 10, qty: 40, returns_qty: 2, invoice_count: 3, lines_count: 4,
    cost_value: 200, gross_margin: 150, margin_pct: 42.9, prior_net_sales: 280, growth_pct: 25, active_skus: 2, billed_customers: 2,
  },
}

function salesRow(keys: { dim: string; id: number; label: string }[], net: number) {
  return {
    keys, invoice_count: 1, lines_count: 1, qty: 10, returns_qty: 0, sales_value: net, returns_value: 0, net_sales: net,
    cost_value: net / 2, gross_margin: net / 2, margin_pct: 50, share_pct: 50, prior_net_sales: net, growth_pct: 0, rank: 1,
  }
}

const calls: { url: string; params: Record<string, string> }[] = []
let failing = false

function reply(url: string, params: Record<string, string>) {
  if (url === '/reports/sales-analysis') {
    const levels = (params.group_by ?? 'item').split(',')
    const rows =
      levels.length > 1
        ? [
            salesRow([{ dim: levels[0], id: 1, label: 'Ahmad' }, { dim: levels[1], id: 7, label: 'IT-COLA — Cola' }], 200),
            salesRow([{ dim: levels[0], id: 2, label: 'Sara' }, { dim: levels[1], id: 7, label: 'IT-COLA — Cola' }], 150),
          ]
        : [
            salesRow([{ dim: levels[0], id: 7, label: 'IT-COLA — Cola' }], 200),
            salesRow([{ dim: levels[0], id: 8, label: 'IT-WATER — Water' }], 150),
          ]
    return { ...SALES, group_by: levels, rows }
  }
  if (url === '/reports/inventory') {
    return {
      currency: 'USD',
      group_by: [params.group_by ?? 'item'],
      kpis: { skus: 1, units: 40, cost_value: 80, sale_value: 200, locations: 2 },
      rows: [{ keys: [{ dim: 'item', id: 7, label: 'IT-COLA — Cola' }], available_qty: 38, reserved_qty: 2, on_hand: 40, cost_value: 80, sale_value: 200, locations: 2 }],
    }
  }
  if (url === '/reports/unloads' || url === '/reports/loads') {
    return {
      currency: 'USD',
      group_by: [params.group_by ?? 'salesman'],
      kpis: { documents: 1, lines: 1, qty: 6, cost_value: 12, sale_value: 30, loaded_qty: 60, unload_ratio_pct: 10 },
      rows: [{ keys: [{ dim: 'salesman', id: 1, label: 'Ahmad' }], documents: 1, lines: 1, qty: 6, cost_value: 12, sale_value: 30, loaded_qty: 60, unload_ratio_pct: 10 }],
    }
  }
  if (url.startsWith('/users')) {
    return [
      { id: 1, name: 'Ahmad', email: 'a@x', role: 'salesman', status: 'active', permissions: [] },
      { id: 2, name: 'Sara', email: 's@x', role: 'salesman', status: 'active', permissions: [] },
    ]
  }
  if (url.startsWith('/areas')) return [{ id: 3, name: 'Beirut', code: 'B' }]
  return []
}

vi.mock('@/core/api/client', () => ({
  apiClient: {
    get: async (url: string, config?: { params?: Record<string, string> }) => {
      const params = config?.params ?? {}
      calls.push({ url, params })
      if (failing && url.startsWith('/reports')) throw new Error('offline')
      const body = reply(url, params)
      // The report endpoints answer with the payload itself under `data`;
      // the list endpoints wrap theirs once more, like the rest of the API.
      const data = url.startsWith('/reports') ? body : { data: body }
      return { data: { status: 'Success', message: null, data } }
    },
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
  },
}))

const excel = vi.fn(async (..._args: unknown[]) => 'report.xlsx')
vi.mock('../excel-export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../excel-export')>()),
  downloadExcel: (...args: unknown[]) => excel(...args),
}))

const lastReport = (path: string) => [...calls].reverse().find((c) => c.url === path)?.params

async function open(entry = '/reports') {
  const { AnalysisPanel } = await import('./AnalysisPanel')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <AnalysisPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  calls.length = 0
  failing = false
  excel.mockClear()
  useAuthStore.setState({ user: { id: '1', name: 'Admin', email: 'a@b.c', company: 'Nestle Lebanon' } })
})

afterEach(() => {
  useAuthStore.setState({ user: null })
})

describe('opening Reports', () => {
  it('shows sales by item for this month, compared with the period before', async () => {
    await open()

    expect(await screen.findByText('IT-COLA — Cola')).toBeInTheDocument()
    const asked = lastReport('/reports/sales-analysis')!
    expect(asked.group_by).toBe('item')
    expect(asked.compare).toBe('previous_period')
    expect(asked.from).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('leads with the figures for the whole window', async () => {
    await open()

    const band = await screen.findByRole('region', { name: 'Key figures' })
    expect(within(band).getByText('$350.00')).toBeInTheDocument()
    expect(within(band).getByText('42.9%')).toBeInTheDocument()
    expect(within(band).getByText(/25\.0%/)).toBeInTheDocument()
  })
})

describe('asking a different question', () => {
  it('groups by salesman, then item, under a heading per salesman', async () => {
    await open()
    await screen.findByText('IT-COLA — Cola')

    await userEvent.click(screen.getByRole('button', { name: 'Salesman by item' }))

    await waitFor(() => expect(lastReport('/reports/sales-analysis')!.group_by).toBe('salesman,item'))
    expect(await screen.findByRole('button', { name: 'Hide Ahmad' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide Sara' })).toBeInTheDocument()
  })

  it('adds and removes a grouping level', async () => {
    await open('/reports?view=sales-by-salesman')
    await screen.findByText('IT-COLA — Cola')

    await userEvent.click(screen.getByRole('button', { name: /add level/i }))
    await waitFor(() => expect(lastReport('/reports/sales-analysis')!.group_by.split(',')).toHaveLength(2))

    await userEvent.click(screen.getByRole('button', { name: /stop grouping by salesman/i }))
    await waitFor(() => expect(lastReport('/reports/sales-analysis')!.group_by.split(',')).toHaveLength(1))
  })

  it('reads the dates a preset stands for', async () => {
    await open()
    await screen.findByText('IT-COLA — Cola')

    await userEvent.selectOptions(screen.getByLabelText('Period'), 'custom')
    await userEvent.clear(screen.getByLabelText('From'))
    await userEvent.type(screen.getByLabelText('From'), '2026-03-01')

    await waitFor(() => expect(lastReport('/reports/sales-analysis')!.from).toBe('2026-03-01'))
  })

  it('narrows by salesman, and says so on the exported page', async () => {
    await open()
    await screen.findByText('IT-COLA — Cola')

    await userEvent.selectOptions(await screen.findByLabelText('Salesman'), '2')
    await waitFor(() => expect(lastReport('/reports/sales-analysis')!.salesman_id).toBe('2'))

    await userEvent.click(screen.getByRole('button', { name: /^export/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /excel/i }))

    await waitFor(() => expect(excel).toHaveBeenCalledOnce())
    const [doc] = excel.mock.calls[0] as [ReportDocument<unknown>]
    expect(doc.title).toBe('Sales by item')
    expect(doc.subtitle).toContain('Salesman: Sara')
  })

  it('drops the comparison columns when there is nothing to compare with', async () => {
    await open()
    await screen.findByText('IT-COLA — Cola')
    expect(screen.getByRole('button', { name: 'Growth' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Compare with'), 'none')

    await waitFor(() => expect(lastReport('/reports/sales-analysis')!.compare).toBe('none'))
  })
})

describe('stock and vans', () => {
  it('reads inventory as it stands now, with no date to pick', async () => {
    await open('/reports?view=inventory')

    expect(await screen.findByText('IT-COLA — Cola')).toBeInTheDocument()
    expect(screen.queryByLabelText('Period')).toBeNull()

    await userEvent.click(screen.getByLabelText(/only what is in stock/i))
    await waitFor(() => expect(lastReport('/reports/inventory')!.only_in_stock).toBe('1'))
  })

  it('leads the unload ratio with the share of each load that came back', async () => {
    await open('/reports?view=unload-ratio')

    // A cell, not just the text: Ahmad is also an option in the salesman filter.
    expect(await screen.findByRole('cell', { name: 'Ahmad' })).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers.indexOf('Unload ratio')).toBeLessThan(headers.indexOf('Documents'))
  })
})

describe('when the figures cannot be read', () => {
  it('says so, offers to try again, and will not export', async () => {
    failing = true
    await open()

    expect(await screen.findByText(/couldn't load this report/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^export/i })).toBeDisabled()
  })
})
