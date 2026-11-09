import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsPage } from './SettingsPage'

/**
 * The two ways to start over. Clear transactions keeps the stock the company
 * has counted; Clear data takes the stock too. Each asks first, and each says
 * which it did.
 */

const posts: { url: string; body: unknown }[] = []

vi.mock('@/core/api/client', () => ({
  apiClient: {
    get: async () => ({ data: { data: { data: { checkin_requires_barcode: false } } } }),
    post: async (url: string, body: unknown) => {
      posts.push({ url, body })
      return { data: { data: { data: body } } }
    },
  },
}))

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  posts.length = 0
  vi.restoreAllMocks()
})

describe('SettingsPage', () => {
  it('clears the transactions and keeps the stock, once the owner says yes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mount()

    await userEvent.click(screen.getByRole('button', { name: 'Clear transactions' }))

    await waitFor(() => expect(posts).toEqual([{ url: '/testing/reset-data', body: { confirm: 'yes', keep_stock: true } }]))
    expect(await screen.findByText('The transactions were cleared. The stock is as it was.')).toBeInTheDocument()
  })

  it('does nothing when the owner says no', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mount()

    await userEvent.click(screen.getByRole('button', { name: 'Clear transactions' }))

    expect(posts).toEqual([])
  })

  it('still offers to clear everything, stock included', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mount()

    await userEvent.click(screen.getByRole('button', { name: 'Clear data' }))

    await waitFor(() => expect(posts).toEqual([{ url: '/testing/reset-data', body: { confirm: 'yes' } }]))
  })
})
