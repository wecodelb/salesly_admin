import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageHeader } from './PageHeader'

function Screen({ read }: { read: () => Promise<string> }) {
  useQuery({ queryKey: ['orders'], queryFn: read })
  return <PageHeader title="Orders" />
}

describe('the page header', () => {
  it('reloads what the screen is showing', async () => {
    const read = vi.fn().mockResolvedValue('rows')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <Screen read={read} />
      </QueryClientProvider>,
    )
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: /Reload/ }))

    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })

  it('leaves the reload out where the page has its own', () => {
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <PageHeader title="Dashboard" reload={false} />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('button', { name: /Reload/ })).not.toBeInTheDocument()
  })
})
