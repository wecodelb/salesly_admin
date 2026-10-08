import { useQuery } from '@tanstack/react-query'
import { fetchTeam, fetchTrail } from '../api/live-map-api'

const LIVE_MAP_KEY = ['live-map'] as const

/**
 * The team, re-read every fifteen seconds.
 *
 * The phones report about once a minute, so polling faster would mostly fetch
 * the same answer; slower, and a van that has just stopped takes too long to
 * show it. Kept going in the background, because this is the screen a manager
 * leaves open on a second monitor.
 */
export function useFieldTeam(enabled = true) {
  return useQuery({
    queryKey: [...LIVE_MAP_KEY, 'team'],
    queryFn: fetchTeam,
    enabled,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    // The dots stay put while the next answer is fetched, instead of the map
    // emptying every fifteen seconds.
    placeholderData: (previous) => previous,
    // A 403 is an answer — not bought, or not allowed — and asking again
    // three times will not change it.
    retry: (count, error) => (error as { response?: { status?: number } })?.response?.status !== 403 && count < 2,
  })
}

/**
 * One salesman's trail for a day. Today's keeps growing, so it is re-read every
 * minute; a past day's never changes, so it is read once.
 */
export function useTrail(userId: number | null, date: string, isToday: boolean) {
  return useQuery({
    queryKey: [...LIVE_MAP_KEY, 'trail', userId, date],
    queryFn: () => fetchTrail(userId as number, date),
    enabled: userId != null,
    refetchInterval: isToday ? 60_000 : false,
    staleTime: isToday ? 0 : Infinity,
  })
}
