import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { ActivityEvent, ActivityFeed, ActivityFilters, OnlineUser } from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface FeedData {
  data: ActivityEvent[]
  online: OnlineUser[]
  pagination?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/**
 * One read for both halves of the screen.
 *
 * The feed and who is online arrive together because they are one question —
 * "what is happening" — and two requests would let the two halves disagree
 * about the moment they describe.
 */
export async function fetchActivity(filters: ActivityFilters = {}): Promise<ActivityFeed> {
  const { data } = await apiClient.get<Envelope<FeedData>>(ENDPOINTS.ACTIVITY, {
    params: {
      page: filters.page ?? 1,
      per_page: filters.perPage ?? 50,
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.salesmanId ? { salesman_id: filters.salesmanId } : {}),
      ...(filters.since ? { since: filters.since } : {}),
    },
  })

  const body = data?.data

  return {
    events: Array.isArray(body?.data) ? body.data : [],
    online: Array.isArray(body?.online) ? body.online : [],
    total: body?.pagination?.total ?? 0,
  }
}
