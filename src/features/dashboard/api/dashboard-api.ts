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
export async function fetchDashboardSummary(
  range: { from?: string; to?: string } = {},
): Promise<DashboardSummary> {
  const res = await apiClient.get<Envelope<DashboardSummary>>(ENDPOINTS.DASHBOARD_SUMMARY, {
    // Omitted rather than sent empty: the server defaults to today, and a blank
    // date on the query string is a different thing from no date at all.
    params: {
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    },
  })
  return res.data.data
}
