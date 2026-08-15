import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type {
  AdjustStockPayload,
  AdminItem,
  Brand,
  Category,
  CreateItemPayload,
  Currency,
  ItemDistribution,
  ItemLevel,
  SaveItemLevelPayload,
  UomOption,
  UpdateItemPayload,
} from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
  pagination?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/** Guard against a malformed `last_page` spinning this forever. */
const MAX_PAGES = 50

/**
 * Every product in the company, across all pages. Manager scope = the whole
 * catalog, so stopping at page 1 would silently hide the tail.
 */
export async function fetchProducts(perPage = 200): Promise<AdminItem[]> {
  const all: AdminItem[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiClient.get<Envelope<ListData<AdminItem>>>(ENDPOINTS.ITEMS, {
      params: { per_page: perPage, page },
    })

    const body = res.data.data
    const rows = body?.data ?? []
    all.push(...rows)

    const lastPage = body?.pagination?.last_page ?? page
    if (rows.length === 0 || page >= lastPage) break
  }

  return all
}

/**
 * One product with its packaging variants. The detail page needs this rather
 * than picking the row out of the cached list: on a hard refresh that list
 * isn't there yet, and building it walks every page of the catalog first.
 */
export async function fetchProduct(id: number): Promise<AdminItem> {
  const res = await apiClient.get<Envelope<{ data: AdminItem }>>(`${ENDPOINTS.ITEMS}/${id}`)
  return res.data.data.data
}

/**
 * Where this product's stock physically sits, one row per location.
 *
 * The order is the backend's and is kept: depots first, then warehouses by
 * name, so the list answers "who is carrying this" before "what is on the
 * shelf". Re-sorting it here would throw that away.
 */
export async function fetchItemDistribution(itemId: number): Promise<ItemDistribution[]> {
  const res = await apiClient.get<Envelope<ListData<ItemDistribution>>>(
    `${ENDPOINTS.ITEMS}/${itemId}/distribution`,
  )
  return res.data.data?.data ?? []
}

/**
 * The reorder points for this product, one row per warehouse in the company.
 *
 * Every warehouse is answered for, not only the ones holding stock: "this depot
 * should carry ten and is carrying none" is the sentence the screen exists to
 * show, and a pair that has never been stocked has no ledger row to read it
 * off. Reading writes nothing — the zeros come back unsaved.
 *
 * The order is the backend's, depots first then by name, matching the
 * distribution list beside it.
 */
export async function fetchItemLevels(itemId: number): Promise<ItemLevel[]> {
  const res = await apiClient.get<Envelope<ListData<ItemLevel>>>(
    `${ENDPOINTS.ITEMS}/${itemId}/levels`,
  )
  return res.data.data?.data ?? []
}

/** Sets one pair's levels and hands back that row alone, already carrying the
 *  server's breach flags. */
export async function saveItemLevel(
  itemId: number,
  payload: SaveItemLevelPayload,
): Promise<ItemLevel> {
  const res = await apiClient.post<Envelope<{ data: ItemLevel }>>(
    `${ENDPOINTS.ITEMS}/${itemId}/levels`,
    payload,
  )
  return res.data.data.data
}

/**
 * Set what is physically on the shelf for one product in one warehouse.
 *
 * A counted figure, not a delta — a stock take produces "there are 42 here",
 * and asking somebody to work out the difference from what the system believes
 * is how a miscount becomes a correction in the wrong direction.
 *
 * The server refuses a count below what is already reserved on paperwork, which
 * surfaces here as a 422 naming the promised quantity.
 */
export async function adjustItemStock(
  itemId: number,
  payload: AdjustStockPayload,
): Promise<ItemDistribution> {
  const res = await apiClient.post<Envelope<{ data: ItemDistribution }>>(
    `${ENDPOINTS.ITEMS}/${itemId}/stock`,
    payload,
  )
  return res.data.data.data
}

export async function createItem(payload: CreateItemPayload): Promise<void> {
  await apiClient.post(ENDPOINTS.ITEMS, payload)
}

export async function updateItem(id: number, payload: UpdateItemPayload): Promise<void> {
  await apiClient.post(`${ENDPOINTS.ITEMS}/${id}`, payload)
}

export async function deleteItem(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.ITEMS}/${id}`)
}

// ─── Categories (dropdown + management) ──────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  const res = await apiClient.get<Envelope<ListData<Category>>>(ENDPOINTS.CATEGORIES)
  return res.data.data?.data ?? []
}

/** Returns the created row so the form can select what you just made. */
export async function createCategory(name: string): Promise<Category> {
  const res = await apiClient.post<Envelope<{ data: Category }>>(ENDPOINTS.CATEGORIES, { name })
  return res.data.data.data
}

// ─── UOMs (required for item create/edit) ────────────────────────────────────

export async function fetchUoms(): Promise<UomOption[]> {
  const res = await apiClient.get<Envelope<ListData<UomOption>>>(ENDPOINTS.UOMS, {
    params: { per_page: 200 },
  })
  return res.data.data?.data ?? []
}

// ─── Brands (dropdown + management) ──────────────────────────────────────────

export async function fetchBrands(): Promise<Brand[]> {
  const res = await apiClient.get<Envelope<ListData<Brand>>>(ENDPOINTS.BRANDS)
  return res.data.data?.data ?? []
}

/** Returns the created row so the form can select what you just made. */
export async function createBrand(name: string): Promise<Brand> {
  const res = await apiClient.post<Envelope<{ data: Brand }>>(ENDPOINTS.BRANDS, { name })
  return res.data.data.data
}

// ─── Currencies (product form + Exchange Rates screen) ───────────────────────

export async function fetchCurrencies(): Promise<Currency[]> {
  const res = await apiClient.get<Envelope<ListData<Currency>>>(ENDPOINTS.CURRENCIES)
  return res.data.data?.data ?? []
}
