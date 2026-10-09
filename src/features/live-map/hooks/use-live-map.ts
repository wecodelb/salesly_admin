import { useQuery } from '@tanstack/react-query'
import { fetchTeam, fetchTrail } from '../api/live-map-api'

const LIVE_MAP_KEY = ['live-map'] as const

/**
 * The team, re-read every fifteen seconds.
 *
 * The phones report every fifteen seconds, so this asks as often: polling
 * faster would mostly fetch the same answer, and slower would leave the map
 * behind the vans. Kept going in the background, because this is the screen a manager
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
 * One salesman's trail for a day. Today's grows by a fix every fifteen seconds,
 * so it is re-read as often and the line follows him; a past day's never
 * changes, so it is read once.
 */
export function useTrail(userId: number | null, date: string, isToday: boolean) {
  return useQuery({
    queryKey: [...LIVE_MAP_KEY, 'trail', userId, date],
    queryFn: () => fetchTrail(userId as number, date),
    enabled: userId != null,
    refetchInterval: isToday ? 15_000 : false,
    staleTime: isToday ? 0 : Infinity,
  })
}
