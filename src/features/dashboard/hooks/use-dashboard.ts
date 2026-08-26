import { useQuery } from '@tanstack/react-query'
import { fetchDashboardSummary } from '../api/dashboard-api'

const DASHBOARD_KEY = ['admin-dashboard-summary'] as const

/**
 * The dashboard's figures.
 *
 * Kept fresh on a timer because this is the screen somebody leaves open on a
 * second monitor all morning: without it, "Sales today" would quietly go on
 * describing the moment the tab was opened. Sixty seconds is well inside how
 * often a manager glances at it and nowhere near often enough to matter to the
 * database.
 */
export function useDashboardSummary(range: { from?: string; to?: string } = {}) {
  return useQuery({
    // The window is part of the key: two periods are two answers, and sharing
    // one cache entry would show last week the figures for today.
    queryKey: [...DASHBOARD_KEY, range.from ?? null, range.to ?? null],
    queryFn: () => fetchDashboardSummary(range),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // A stale figure on screen beats a spinner replacing one: while a refetch
    // is in flight the previous numbers stay put.
    staleTime: 30_000,
  })
}
