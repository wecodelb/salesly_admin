import { useQuery } from '@tanstack/react-query'

import { fetchInvoicePage } from '@/features/invoices/api/invoices-api'
import { fetchLatestReturns } from '@/features/returns/api/returns-api'
import { parseApiDate } from '@/features/reports/report-format'

/**
 * "New since you last looked", for the sidebar.
 *
 * A document is new when it is dated after the moment this browser last
 * opened its screen. The moment lives in localStorage — per browser, not per
 * account — which is the honest scope for it: the sidebar is saying "you have
 * not seen these here", not "nobody has".
 */

export type SeenKind = 'invoices' | 'returns'

const key = (kind: SeenKind) => `salesly.seen.${kind}`

function startOfToday(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

/**
 * When this screen was last opened here. The first time it is asked, the
 * answer is the start of today: a fresh browser is shown today's documents as
 * new, rather than the whole book or nothing at all.
 */
export function lastSeen(kind: SeenKind, now = new Date()): number {
  try {
    const stored = Number(window.localStorage.getItem(key(kind)))
    if (Number.isFinite(stored) && stored > 0) return stored
    const start = startOfToday(now)
    window.localStorage.setItem(key(kind), String(start))
    return start
  } catch {
    return startOfToday(now)
  }
}

/** Opening the screen is seeing what is on it. */
export function markSeen(kind: SeenKind, now = Date.now()): number {
  try {
    window.localStorage.setItem(key(kind), String(now))
  } catch {
    // Storage off (private window): the badge simply resets each visit.
  }
  return now
}

/** How many of these dates fall after `since`. Undated rows are not new. */
export function countNewer(dates: (string | null | undefined)[], since: number): number {
  return dates.reduce((n, raw) => {
    const date = parseApiDate(raw ?? null)
    return date && date.getTime() > since ? n + 1 : n
  }, 0)
}

const POLL_MS = 30_000

async function latestDates(kind: SeenKind): Promise<(string | null)[]> {
  if (kind === 'invoices') {
    const page = await fetchInvoicePage({ page: 1, perPage: 50 })
    return page.invoices.map((i) => i.trs_date)
  }
  return (await fetchLatestReturns(50)).map((r) => r.trs_date)
}

/**
 * The count for one screen, re-read every half minute. `since` is part of the
 * key, so opening the screen — which moves it — clears the badge at once.
 */
export function useNewCount(kind: SeenKind, since: number, enabled: boolean) {
  return useQuery({
    queryKey: ['nav-new', kind, since],
    queryFn: async () => countNewer(await latestDates(kind), since),
    enabled,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}
