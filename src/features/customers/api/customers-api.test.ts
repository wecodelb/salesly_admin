import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const post = vi.fn()

vi.mock('@/core/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}))

const { fetchCustomers, updateCustomer } = await import('./customers-api')

/** Shapes a page the way the Laravel backend nests it. */
function page(ids: number[], currentPage: number, lastPage: number) {
  return {
    data: {
      status: 'Success',
      message: null,
      data: {
        data: ids.map((id) => ({ id, name: `Shop ${id}` })),
        pagination: {
          current_page: currentPage,
          last_page: lastPage,
          per_page: 200,
          total: 0,
        },
      },
    },
  }
}

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('fetchCustomers', () => {
  it('returns the single page when there is only one', async () => {
    get.mockResolvedValueOnce(page([1, 2, 3], 1, 1))

    expect(await fetchCustomers()).toHaveLength(3)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('walks every page — a manager sees the whole book, not just page 1', async () => {
    get
      .mockResolvedValueOnce(page([1, 2], 1, 3))
      .mockResolvedValueOnce(page([3, 4], 2, 3))
      .mockResolvedValueOnce(page([5], 3, 3))

    const all = await fetchCustomers()

    expect(all.map((c) => c.id)).toEqual([1, 2, 3, 4, 5])
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('sends an increasing page param', async () => {
    get
      .mockResolvedValueOnce(page([1], 1, 2))
      .mockResolvedValueOnce(page([2], 2, 2))

    await fetchCustomers(50)

    expect(get.mock.calls[0][1]).toMatchObject({ params: { per_page: 50, page: 1 } })
    expect(get.mock.calls[1][1]).toMatchObject({ params: { per_page: 50, page: 2 } })
  })

  it('stops on an empty page even if pagination claims more', async () => {
    get
      .mockResolvedValueOnce(page([1], 1, 9))
      .mockResolvedValueOnce(page([], 2, 9))

    expect(await fetchCustomers()).toHaveLength(1)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('survives a response with no pagination block', async () => {
    get.mockResolvedValueOnce({
      data: { status: 'Success', message: null, data: { data: [{ id: 1 }] } },
    })

    expect(await fetchCustomers()).toHaveLength(1)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('does not loop forever on a nonsense last_page', async () => {
    get.mockResolvedValue(page([1], 1, 99_999))

    await fetchCustomers()

    // MAX_PAGES guard.
    expect(get.mock.calls.length).toBeLessThanOrEqual(50)
  })
})

describe('updateCustomer', () => {
  it('POSTs salesman_id — the field the Flutter app reads as the assignment', async () => {
    post.mockResolvedValueOnce({})

    await updateCustomer(7, { salesman_id: 12 })

    expect(post).toHaveBeenCalledWith('/customers/7', { salesman_id: 12 })
  })

  it('sends an explicit null to unassign rather than omitting the field', async () => {
    post.mockResolvedValueOnce({})

    await updateCustomer(7, { salesman_id: null })

    // Omitting it would leave the customer assigned — the backend would see
    // no change at all.
    expect(post).toHaveBeenCalledWith('/customers/7', { salesman_id: null })
  })

  it('POSTs credit_limit on its own without touching the assignment', async () => {
    post.mockResolvedValueOnce({})

    await updateCustomer(7, { credit_limit: 2500 })

    expect(post).toHaveBeenCalledWith('/customers/7', { credit_limit: 2500 })
    expect(post.mock.calls[0][1]).not.toHaveProperty('salesman_id')
  })
})
