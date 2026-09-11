import { useQuery } from '@tanstack/react-query'
import { fetchActivity } from '../api/activity-api'
import type { ActivityFilters } from '../types'

const ACTIVITY_KEY = ['activity'] as const

/**
 * The feed, refreshed on a timer.
 *
 * This is the one screen in the console whose whole value is being current — a
 * stale answer to "what is happening right now" is worse than no answer — so it
 * re-reads every half minute, and keeps doing so with the tab in the
 * background, because a manager leaves this open on a second monitor.
 */
export function useActivity(filters: ActivityFilters = {}) {
  return useQuery({
    queryKey: [
      ...ACTIVITY_KEY,
      filters.kind ?? null,
      filters.salesmanId ?? null,
      filters.since ?? null,
      filters.page ?? null,
      filters.perPage ?? null,
    ],
    queryFn: () => fetchActivity(filters),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    // The previous answer stays on screen while the next is fetched, so a feed
    // that reloads twice a minute does not blink a spinner at somebody reading
    // it.
    placeholderData: (previous) => previous,
  })
}

/**
 * How many of the team are online right now, for the sidebar.
 *
 * Asks for a single event: the online list rides along with every page of the
 * feed, and the menu has no use for the events themselves. Only polled for
 * somebody the server would let read the feed.
 */
export function useOnlineCount(enabled: boolean) {
  return useQuery({
    queryKey: [...ACTIVITY_KEY, 'online-count'],
    queryFn: () => fetchActivity({ perPage: 1 }),
    select: (feed) => feed.online.filter((u) => u.is_online).length,
    enabled,
    refetchInterval: 60_000,
  })
}
