import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { CreatePromotionPayload, Promotion, UpdatePromotionPayload } from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
}

/** All promotions (active + inactive) — the admin manages the full set. */
export async function fetchPromotions(): Promise<Promotion[]> {
  const res = await apiClient.get<Envelope<ListData<Promotion>>>(ENDPOINTS.PROMOTIONS, {
    params: { scope: 'all' },
  })
  return res.data.data?.data ?? []
}

export async function createPromotion(payload: CreatePromotionPayload): Promise<void> {
  await apiClient.post(ENDPOINTS.PROMOTIONS, payload)
}

export async function updatePromotion(id: number, payload: UpdatePromotionPayload): Promise<void> {
  await apiClient.post(`${ENDPOINTS.PROMOTIONS}/${id}`, payload)
}

export async function deletePromotion(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.PROMOTIONS}/${id}`)
}
