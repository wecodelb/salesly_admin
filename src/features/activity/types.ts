/**
 * One thing that happened, whatever kind of thing it was.
 *
 * Documents and visits share a shape here on purpose. The office is not asking
 * "show me invoices" — it has a screen for that — it is asking "what happened",
 * and a feed that made a salesman read two columns to answer that would not be
 * a feed.
 */
export interface ActivityEvent {
  /** Unique across both sources: `doc-12`, `visit-in-4`, `visit-out-4`. */
  id: string
  kind: ActivityKind
  /** ISO 8601. Null only if a document was written without a date. */
  at: string | null
  /** `#417` for a document; visits have no number. */
  reference: string | null
  document_id: number
  /** A document's own status, or `checked_in` / `checked_out` for a visit. */
  status: string | null
  customer_id: number | null
  customer_name: string | null
  salesman_id: number | null
  salesman_name: string | null
  amount: number | null
  currency: string | null
  /** How long he was in the shop. Only on a `checked_out` event. */
  minutes?: number | null
}

export type ActivityKind =
  | 'order'
  | 'invoice'
  | 'return'
  | 'collection'
  | 'load_request'
  | 'load_issue'
  | 'unload'
  | 'visit'
  | 'document'

/**
 * Somebody the app has heard from.
 *
 * "Online" is his phone having spoken to the server inside the last ten
 * minutes — not a heartbeat he can leave running, and nothing to do with GPS.
 * A salesman in a basement drops off; he is not lost, he simply has not been
 * heard from, which is the thing worth knowing.
 */
export interface OnlineUser {
  id: number
  name: string
  last_seen_at: string
  minutes_ago: number
  is_online: boolean
}

export interface ActivityFeed {
  events: ActivityEvent[]
  online: OnlineUser[]
  total: number
}

export interface ActivityFilters {
  kind?: ActivityKind | ''
  salesmanId?: number | null
  since?: string
  page?: number
  perPage?: number
}

/** What each kind is called on screen. */
export const KIND_LABELS: Record<ActivityKind, string> = {
  order: 'Order',
  invoice: 'Invoice',
  return: 'Return',
  collection: 'Collection',
  load_request: 'Load request',
  load_issue: 'Load issue',
  unload: 'Unload',
  visit: 'Visit',
  document: 'Document',
}

export const KIND_OPTIONS: { value: ActivityKind | ''; label: string }[] = [
  { value: '', label: 'Everything' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'order', label: 'Orders' },
  { value: 'return', label: 'Returns' },
  { value: 'collection', label: 'Collections' },
  { value: 'visit', label: 'Visits' },
  { value: 'load_request', label: 'Load requests' },
  { value: 'load_issue', label: 'Load issues' },
  { value: 'unload', label: 'Unloads' },
]

/**
 * What the event says happened, in words.
 *
 * A visit is the only kind whose status changes the sentence — arriving and
 * leaving are different events on the same document, and "Visit" against both
 * would read as the shop being visited twice.
 */
export function describe(event: ActivityEvent): string {
  if (event.kind === 'visit') {
    return event.status === 'checked_out' ? 'Left the shop' : 'Arrived at the shop'
  }
  return KIND_LABELS[event.kind] ?? 'Document'
}

/** Money is only meaningful on the kinds that carry it. */
export function hasAmount(event: ActivityEvent): boolean {
  return event.amount != null && event.kind !== 'visit'
}

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatAmount(event: ActivityEvent): string {
  if (!hasAmount(event)) return '—'
  return `$${money.format(event.amount as number)}`
}

/**
 * "3 min ago", "2 h ago", "5 d ago".
 *
 * Relative rather than a clock time: the question this screen answers is how
 * long ago, and a reader converting 14:52 into "twenty minutes" in their head
 * is doing the screen's job for it.
 */
export function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'

  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'

  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000))
  if (seconds < 60) return 'just now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`

  return `${Math.round(hours / 24)} d ago`
}

/** How long he spent in the shop, when the visit is closed. */
export function formatDwell(event: ActivityEvent): string {
  const minutes = event.minutes
  if (minutes == null) return '—'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** The calendar day an event belongs to, as `YYYY-MM-DD` in local time. */
export function dayKey(iso: string | null): string {
  if (!iso) return 'unknown'

  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'

  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export interface ActivityDay {
  key: string
  events: ActivityEvent[]
}

/**
 * The feed cut into days, in the order it arrived.
 *
 * A stream with no day breaks reads as one endless list, and the reader ends up
 * checking timestamps to work out where yesterday started — which is the
 * screen's job, not his.
 */
export function groupByDay(events: ActivityEvent[]): ActivityDay[] {
  const days: ActivityDay[] = []

  for (const event of events) {
    const key = dayKey(event.at)
    const last = days[days.length - 1]

    if (last && last.key === key) last.events.push(event)
    else days.push({ key, events: [event] })
  }

  return days
}

/**
 * "Today", "Yesterday", else the date.
 *
 * Nobody reads "09/09/2026" and thinks "today"; the two nearest days are the
 * ones this screen is mostly about, so they get their names.
 */
export function dayLabel(key: string, now: Date = new Date()): string {
  if (key === 'unknown') return 'Undated'

  if (key === dayKey(now.toISOString())) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === dayKey(yesterday.toISOString())) return 'Yesterday'

  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** The clock time an event happened, for the rail down the left. */
export function clockTime(iso: string | null): string {
  if (!iso) return '—'

  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}
