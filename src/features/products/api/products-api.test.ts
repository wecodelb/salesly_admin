import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
// Create and update both POST now — to /items and /items/{id} respectively —
// so one mock covers both, and the path in each assertion is what tells them
// apart.
const post = vi.fn()
const del = vi.fn()

vi.mock('@/core/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}))

const {
  fetchProducts,
  createItem,
  updateItem,
  deleteItem,
  fetchCategories,
  fetchUoms,
  fetchBrands,
  createBrand,
  fetchCurrencies,
} = await import('./products-api')

/** Shapes a paginated /items page the way the Laravel backend nests it. */
function page(ids: number[], currentPage: number, lastPage: number) {
  return {
    data: {
      status: 'Success',
      message: null,
      data: {
        data: ids.map((id) => ({ id, name: `Item ${id}`, code: `IT-${id}` })),
        pagination: { current_page: currentPage, last_page: lastPage, per_page: 200, total: 0 },
      },
    },
  }
}

/** A flat list envelope (categories / uoms). */
function flatList(rows: unknown[]) {
  return { data: { status: 'Success', message: null, data: { data: rows } } }
}

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('fetchProducts', () => {
  it('returns the single page when there is only one', async () => {
    get.mockResolvedValueOnce(page([1, 2, 3], 1, 1))
    expect(await fetchProducts()).toHaveLength(3)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('walks every page — the manager sees the whole catalog', async () => {
    get
      .mockResolvedValueOnce(page([1, 2], 1, 3))
      .mockResolvedValueOnce(page([3, 4], 2, 3))
      .mockResolvedValueOnce(page([5], 3, 3))
    const all = await fetchProducts()
    expect(all.map((p) => p.id)).toEqual([1, 2, 3, 4, 5])
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('stops on an empty page even if pagination claims more', async () => {
    get.mockResolvedValueOnce(page([1], 1, 9)).mockResolvedValueOnce(page([], 2, 9))
    expect(await fetchProducts()).toHaveLength(1)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('does not loop forever on a nonsense last_page', async () => {
    get.mockResolvedValue(page([1], 1, 99_999))
    await fetchProducts()
    expect(get.mock.calls.length).toBeLessThanOrEqual(50)
  })
})

describe('item mutations', () => {
  it('POSTs the create payload to /items', async () => {
    post.mockResolvedValueOnce({})
    await createItem({ uuid: 'u-1', code: 'X', name: 'X', uom_id: 1, cost: 5, price: 10 })
    expect(post).toHaveBeenCalledWith('/items', {
      uuid: 'u-1',
      code: 'X',
      name: 'X',
      uom_id: 1,
      cost: 5,
      price: 10,
    })
  })

  it('POSTs a partial edit to /items/{id}', async () => {
    post.mockResolvedValueOnce({})
    await updateItem(7, { price: 12.5 })
    expect(post).toHaveBeenCalledWith('/items/7', { price: 12.5 })
  })

  it('DELETEs /items/{id}', async () => {
    del.mockResolvedValueOnce({})
    await deleteItem(9)
    expect(del).toHaveBeenCalledWith('/items/9')
  })
})

describe('reference lists', () => {
  it('unwraps categories from the flat envelope', async () => {
    get.mockResolvedValueOnce(flatList([{ id: 1, code: 'C', name: 'Computers' }]))
    const cats = await fetchCategories()
    expect(cats).toEqual([{ id: 1, code: 'C', name: 'Computers' }])
  })

  it('fetches uoms with a wide per_page so the dropdown is complete', async () => {
    get.mockResolvedValueOnce(flatList([{ id: 1, code: 'PCS', name: 'Pieces' }]))
    await fetchUoms()
    expect(get.mock.calls[0][1]).toMatchObject({ params: { per_page: 200 } })
  })

  it('unwraps brands from the flat envelope', async () => {
    get.mockResolvedValueOnce(flatList([{ id: 1, code: 'ACM', name: 'Acme' }]))
    expect(await fetchBrands()).toEqual([{ id: 1, code: 'ACM', name: 'Acme' }])
  })

  it('POSTs a new brand and hands back the created row', async () => {
    // The created row comes back so the product form can select what you just
    // made, rather than asking you to find it in the list again.
    post.mockResolvedValueOnce({
      data: { status: 'Success', message: null, data: { data: { id: 9, code: '', name: 'Acme Tools' } } },
    })

    const created = await createBrand('Acme Tools')

    expect(post).toHaveBeenCalledWith('/brands', { name: 'Acme Tools' })
    expect(created.id).toBe(9)
  })

  it('unwraps currencies from the flat envelope', async () => {
    get.mockResolvedValueOnce(
      flatList([{ id: 1, code: 'USD', name: 'US Dollar', symbol: '$', is_base: true, is_active: true }]),
    )
    const currencies = await fetchCurrencies()
    expect(currencies).toHaveLength(1)
    expect(currencies[0].is_base).toBe(true)
  })
})
