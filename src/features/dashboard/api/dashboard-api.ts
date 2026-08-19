import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { DashboardSummary } from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

/**
 * The whole dashboard in one request.
 *
 * Deliberately not one call per card: the screen is read as a whole — today's
 * takings only mean something beside yesterday's — and eight round trips would
 * let the cards disagree with each other while they landed one by one.
 */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiClient.get<Envelope<DashboardSummary>>(ENDPOINTS.DASHBOARD_SUMMARY)
  return res.data.data
}
