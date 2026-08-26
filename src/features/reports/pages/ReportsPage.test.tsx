import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Export button, and what it exports.
 *
 * Export is `window.print()`, which means the PDF is whatever is on screen at
 * the moment it is clicked. There is no separate rendering pass to get wrong —
 * but equally no safety net, so the two things worth asserting are that the
 * button cannot fire over an unfinished screen, and that what it fires over is
 * the report the controls actually describe.
 */

const CUSTOMERS = [
  {
    id: 1,
    code: 'C1',
    name: 'Corner Shop',
    salesman_id: 1,
    salesman_name: 'Ahmad',
    customer_group_name: 'Retail',
    area_name: 'Beirut',
    balance: 400,
    credit_limit: null,
    phone1: '01 234 567',
    is_active: true,
  },
  {
    id: 2,
    code: 'C2',
    name: 'Bakery',
    salesman_id: 2,
    salesman_name: 'Sara',
    customer_group_name: 'Wholesale',
    area_name: 'Tripoli',
    balance: 150,
    credit_limit: 1000,
    phone1: '03 111 222',
    is_active: true,
  },
]

const PRODUCTS = [
  {
    id: 1,
    code: 'P1',
    name: 'Cola 330ml',
    category: 'Drinks',
    brand: 'Coca-Cola',
    price_usd: 5,
    price: 5,
    stock: 10,
  },
]

const INVOICES = [
  {
    id: 1,
    trs_number: 'SI-1',
    trs_date: '2026-03-15',
    customer: 'Corner Shop',
    customer_id: 1,
    salesman: { id: 1, name: 'Ahmad' },
    total_price: 100,
    paid_amount: 100,
    rows: [],
  },
  {
    id: 2,
    trs_number: 'SI-2',
    trs_date: '2026-06-20',
    customer: 'Bakery',
    customer_id: 2,
    salesman: { id: 2, name: 'Sara' },
    total_price: 250,
    paid_amount: 0,
    rows: [],
  },
]

// Stubbed at the network edge, like the dashboard's tests, so the hooks, the
// query cache and the report builder all run for real on API-shaped data.
let failing = false
let pending = false

const never = new Promise(() => {})
const answer = <T,>(value: T) => {
  if (failing) return Promise.reject(new Error('nope'))
  if (pending) return never as Promise<T>
  return Promise.resolve(value)
}

vi.mock('@/features/customers/api/customers-api', () => ({
  fetchCustomers: () => answer(CUSTOMERS),
}))
vi.mock('@/features/products/api/products-api', () => ({
  fetchProducts: () => answer(PRODUCTS),
}))
const fetchInvoices = vi.fn((_filters: { perPage?: number }) =>
  answer({ invoices: INVOICES, meta: {} }),
)
vi.mock('@/features/invoices/api/invoices-api', () => ({
  fetchInvoices: (f: { perPage?: number }) => fetchInvoices(f),
}))

async function renderReports() {
  const { ReportsPage } = await import('./ReportsPage')
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  if (!pending && !failing) {
    // The document only exists once all three reads have landed.
    await screen.findByRole('table')
  }
  return view
}

const exportButton = () => screen.getByRole('button', { name: /export pdf/i })

/** The picker button for a report. Its name also becomes the document title,
 *  so a bare getByText would match two nodes once the report is showing. */
const pickReport = (name: RegExp) =>
  userEvent.click(screen.getByRole('button', { name }))

const reportDoc = () => document.querySelector('.report-doc') as HTMLElement

/** The masthead alone. The title is deliberately repeated in the running
 *  footer, so the whole document matches it twice. */
const masthead = () => document.querySelector('.report-masthead') as HTMLElement

beforeEach(() => {
  failing = false
  pending = false
  fetchInvoices.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the Export button', () => {
  it('prints the page, which is the whole of the export', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    await renderReports()

    await userEvent.click(exportButton())

    expect(print).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('will not fire while the figures are still loading', async () => {
    // Printing a skeleton produces a PDF of grey bars, and the person holding
    // it has no way to tell it apart from a report of genuinely empty months.
    pending = true
    await renderReports()

    expect(exportButton()).toBeDisabled()
  })

  it('will not fire when a read behind the report failed', async () => {
    // Worse than a skeleton: a partial report prints as a complete one.
    failing = true
    await renderReports()

    expect(await screen.findByText(/build the report/)).toBeInTheDocument()
    expect(exportButton()).toBeDisabled()
  })
})

describe('what gets exported', () => {
  it('asks for the whole invoice book, not the first page of it', async () => {
    // A report that totals page one prints a figure that looks perfectly
    // reasonable and is wrong, which is the worst kind of wrong.
    await renderReports()

    expect(fetchInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ perPage: 500 }),
    )
  })

  it('prints the report the controls say it is printing', async () => {
    await renderReports()

    await pickReport(/Customer book/)

    expect(within(masthead()).getByText('Customer book')).toBeInTheDocument()
    expect(within(reportDoc()).getByText('Corner Shop')).toBeInTheDocument()
  })

  it('narrows the document when a date range is set', async () => {
    await renderReports()

    await pickReport(/Invoice book/)
    const from = screen.getByLabelText('From')
    await userEvent.type(from, '2026-06-01')

    await waitFor(() => {
      // SI-1 is in March and falls outside; SI-2 in June stays.
      expect(within(reportDoc()).queryByText('SI-1')).toBeNull()
      expect(within(reportDoc()).getByText('SI-2')).toBeInTheDocument()
    })
  })

  it('says the range on the document, so a printed page is self-describing', async () => {
    await renderReports()

    await pickReport(/Invoice book/)
    await userEvent.type(screen.getByLabelText('From'), '2026-06-01')

    await waitFor(() => {
      expect(within(masthead()).getByText(/From 01 Jun 2026/)).toBeInTheDocument()
    })
  })
})

describe('switching reports', () => {
  it('resets the breakdown rather than carrying a meaningless one over', async () => {
    // "By category" carried onto a customer list silently produces one flat
    // group, which reads as a report rather than as a broken one.
    await renderReports()

    await pickReport(/Product catalog/)
    const breakdown = screen.getByLabelText('Break down') as HTMLSelectElement
    await userEvent.selectOptions(breakdown, breakdown.options[1].value)
    const carried = breakdown.value

    await pickReport(/Customer book/)

    expect((screen.getByLabelText('Break down') as HTMLSelectElement).value).not.toBe(
      carried,
    )
  })

  it('offers dates only where a date narrows anything', async () => {
    // A catalog is what it is today. Offering a range would imply a history it
    // does not keep, and print a range the figures do not honour.
    await renderReports()

    await pickReport(/Product catalog/)
    expect(screen.queryByLabelText('From')).toBeNull()

    await pickReport(/Invoice book/)
    expect(screen.getByLabelText('From')).toBeInTheDocument()
  })
})
