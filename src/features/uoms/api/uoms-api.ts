import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { CreateUomPayload, Uom, UpdateUomPayload } from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
}

// Must stay request-identical to features/products' fetchUoms(): both fill the
// same ['admin-uoms'] cache entry, so a narrower page here would silently
// truncate the item form's unit picker.
export async function fetchUoms(): Promise<Uom[]> {
  const res = await apiClient.get<Envelope<ListData<Uom>>>(ENDPOINTS.UOMS, {
    params: { per_page: 200 },
  })
  return res.data.data?.data ?? []
}

export async function createUom(payload: CreateUomPayload): Promise<Uom> {
  const res = await apiClient.post<Envelope<{ data: Uom }>>(ENDPOINTS.UOMS, payload)
  return res.data.data.data
}

export async function updateUom(id: number, payload: UpdateUomPayload): Promise<void> {
  await apiClient.post(`${ENDPOINTS.UOMS}/${id}`, payload)
}

/** Rejects with 409 + an explanatory message when products still reference it. */
export async function deleteUom(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.UOMS}/${id}`)
}
