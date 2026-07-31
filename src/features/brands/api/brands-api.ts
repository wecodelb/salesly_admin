import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { Brand } from '@/features/products/types'
import type { CreateBrandPayload, UpdateBrandPayload } from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
}

export async function fetchBrands(): Promise<Brand[]> {
  const res = await apiClient.get<Envelope<ListData<Brand>>>(ENDPOINTS.BRANDS)
  return res.data.data?.data ?? []
}

export async function createBrand(payload: CreateBrandPayload): Promise<Brand> {
  const res = await apiClient.post<Envelope<{ data: Brand }>>(ENDPOINTS.BRANDS, payload)
  return res.data.data.data
}

export async function updateBrand(id: number, payload: UpdateBrandPayload): Promise<void> {
  await apiClient.patch(`${ENDPOINTS.BRANDS}/${id}`, payload)
}

/** 409 when products still reference the brand — the message names the count. */
export async function deleteBrand(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.BRANDS}/${id}`)
}
