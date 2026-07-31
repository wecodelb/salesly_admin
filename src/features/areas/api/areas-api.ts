import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { Area, CreateAreaPayload, UpdateAreaPayload } from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
}

export async function fetchAreas(): Promise<Area[]> {
  const res = await apiClient.get<Envelope<ListData<Area>>>(ENDPOINTS.AREAS)
  return res.data.data?.data ?? []
}

export async function createArea(payload: CreateAreaPayload): Promise<Area> {
  const res = await apiClient.post<Envelope<{ data: Area }>>(ENDPOINTS.AREAS, payload)
  return res.data.data.data
}

export async function updateArea(id: number, payload: UpdateAreaPayload): Promise<Area> {
  const res = await apiClient.patch<Envelope<{ data: Area }>>(`${ENDPOINTS.AREAS}/${id}`, payload)
  return res.data.data.data
}

/** Rejected with 409 while the area still covers customers. */
export async function deleteArea(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.AREAS}/${id}`)
}
