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
export function useDashboardSummary() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: fetchDashboardSummary,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // A stale figure on screen beats a spinner replacing one: while a refetch
    // is in flight the previous numbers stay put.
    staleTime: 30_000,
  })
}
