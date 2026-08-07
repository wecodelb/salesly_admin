import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type {
  CreatePriceListPayload,
  CustomerOption,
  PriceList,
  UpdatePriceListPayload,
} from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
}

export async function fetchPriceLists(): Promise<PriceList[]> {
  const res = await apiClient.get<Envelope<ListData<PriceList>>>(ENDPOINTS.PRICE_LISTS)
  return res.data.data?.data ?? []
}

/** Detail — includes the per-item override rows. */
export async function fetchPriceList(id: number): Promise<PriceList> {
  const res = await apiClient.get<Envelope<{ data: PriceList }>>(`${ENDPOINTS.PRICE_LISTS}/${id}`)
  return res.data.data.data
}

export async function createPriceList(payload: CreatePriceListPayload): Promise<void> {
  await apiClient.post(ENDPOINTS.PRICE_LISTS, payload)
}

export async function updatePriceList(id: number, payload: UpdatePriceListPayload): Promise<void> {
  await apiClient.post(`${ENDPOINTS.PRICE_LISTS}/${id}`, payload)
}

export async function deletePriceList(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.PRICE_LISTS}/${id}`)
}

/** Lightweight customer options for the "applies to" select. */
export async function fetchCustomerOptions(): Promise<CustomerOption[]> {
  const res = await apiClient.get<Envelope<ListData<{ id: number; name: string }>>>(
    ENDPOINTS.CUSTOMERS,
    { params: { per_page: 200 } },
  )
  const rows = res.data.data?.data ?? []
  return rows.map((c) => ({ id: c.id, name: c.name }))
}
