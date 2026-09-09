import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUp,
  Banknote,
  LogIn,
  LogOut,
  Package,
  RotateCcw,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
import { useToast } from '@/shared/hooks/use-toast'
import { useActivity } from '../hooks/use-activity'
import {
  dayLabel,
  describe,
  formatAmount,
  formatDwell,
  groupByDay,
  hasAmount,
  clockTime,
  timeAgo,
  KIND_OPTIONS,
  type ActivityEvent,
  type ActivityKind,
  type OnlineUser,
} from '../types'

/**
 * What the team is doing, right now.
 *
 * Every other screen in the console answers a question about one kind of
 * document. This one answers a question about *time* — what has happened
 * today, and who is still working — which is why it merges the documents with
 * the shop visits instead of sitting beside them. A manager should not have to
 * read five tabs and sort them in his head.
 *
 * "Online" here means the phone has called the server in the last ten minutes.
 * It is not GPS and not a presence toggle: it is the app itself speaking, which
 * is the only signal that cannot be left switched on in a drawer. A salesman in
 * a basement drops off the list — he is not lost, he simply has not been heard
 * from, and that is the thing worth knowing.
 */
export function ActivityPage() {
  const [kind, setKind] = useState<ActivityKind | ''>('')

  const { data, isLoading, isError, refetch } = useActivity({ kind: kind || undefined })

  const events = useMemo(() => data?.events ?? [], [data])
  const online = useMemo(() => data?.online ?? [], [data])
  const liveNow = useMemo(() => online.filter((u) => u.is_online), [online])

  const { unseen, markSeen } = useUnseen(events)
  const topRef = useRef<HTMLDivElement | null>(null)

  const stats = useMemo(() => {
    const visits = events.filter((e) => e.kind === 'visit' && e.status === 'checked_in').length
    const documents = events.filter((e) => e.kind !== 'visit').length

    return [
      {
        label: 'On the app now',
        value: liveNow.length,
        tone: liveNow.length > 0 ? undefined : ('muted' as const),
        icon: <Activity size={15} />,
      },
      { label: 'Events', value: events.length },
      { label: 'Documents', value: documents, icon: <Package size={15} /> },
      { label: 'Shops entered', value: visits, icon: <LogIn size={15} /> },
    ]
  }, [events, liveNow])

  const days = useMemo(() => groupByDay(events), [events])

  if (isError) {
    return (
      <>
        <PageHeader title="Activity" subtitle="Team activity feed" />
        <ErrorState onRetry={() => refetch()} />
      </>
    )
  }

  return (
    <>
      <div ref={topRef} />

      <PageHeader title="Activity" subtitle="Every document raised and every shop entered" />

      <StatStrip stats={stats} />

      <OnlineStrip users={online} />

      <FilterBar
        filters={
          <FilterSelect
            label="Kind"
            allLabel="Everything"
            value={kind}
            onChange={(v) => setKind(v as ActivityKind | '')}
            options={KIND_OPTIONS}
          />
        }
        activeCount={kind ? 1 : 0}
        onClearFilters={() => setKind('')}
      />

      {unseen > 0 ? (
        <NewEventsPill
          count={unseen}
          onClick={() => {
            markSeen()
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      ) : null}

      {isLoading && events.length === 0 ? (
        <FeedSkeleton />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} />}
          title="Nothing yet"
          description="Documents raised and shops entered will appear here as they happen."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.key}>
              <DayHeading label={dayLabel(day.key)} count={day.events.length} />
              <Feed events={day.events} />
            </section>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * How many events have arrived since he last looked.
 *
 * The feed re-reads itself every half minute, and silently growing under
 * somebody's eyes is the one thing a live screen must not do — he would either
 * miss what arrived or lose his place to a list that moved. So new events are
 * counted and announced, and nothing scrolls until he asks.
 *
 * The first load is never "new": everything is new the first time, and opening
 * the page to "121 new events" would be noise, not news.
 */
function useUnseen(events: ActivityEvent[]) {
  const toast = useToast()
  const seenIds = useRef<Set<string> | null>(null)
  const [unseen, setUnseen] = useState(0)

  useEffect(() => {
    if (events.length === 0) return

    const ids = new Set(events.map((e) => e.id))

    // First sight of the feed: remember it, announce nothing.
    if (seenIds.current === null) {
      seenIds.current = ids
      return
    }

    const arrived = events.filter((e) => !seenIds.current!.has(e.id))
    if (arrived.length === 0) return

    seenIds.current = ids
    setUnseen((n) => n + arrived.length)

    // Named rather than counted where it can be: "Ahmad arrived at Corner
    // Shop" is worth glancing at; "1 new event" makes him come and look.
    const first = arrived[0]
    toast.info(
      arrived.length === 1 ? describe(first) : `${arrived.length} new events`,
      arrived.length === 1
        ? [first.customer_name, first.salesman_name].filter(Boolean).join(' · ')
        : undefined,
    )
    // toast is a stable store binding; re-running on it would re-announce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  return { unseen, markSeen: () => setUnseen(0) }
}

/** "3 new events" — sticky, so it stays reachable as he reads down. */
function NewEventsPill({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className="sticky top-2 z-10 mb-3 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
      >
        <ArrowUp size={14} />
        {count === 1 ? '1 new event' : `${count} new events`}
      </button>
    </div>
  )
}

/**
 * Who the app has heard from, most recent first.
 *
 * Everybody is listed, not only the ones online — "quiet for three hours" is
 * information, and dropping a man off the strip entirely reads the same as him
 * never having existed.
 */
function OnlineStrip({ users }: { users: OnlineUser[] }) {
  if (users.length === 0) return null

  return (
    <div className="mb-5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-3">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          The team
        </h2>
        <span className="text-xs text-[var(--text-muted)]">
          {users.filter((u) => u.is_online).length} on the app
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {users.map((user) => (
          <div
            key={user.id}
            title={`Last heard from ${timeAgo(user.last_seen_at)}`}
            className={
              'flex items-center gap-2.5 rounded-full border py-1 pl-1 pr-3 transition ' +
              (user.is_online
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-[var(--border-default)] opacity-70')
            }
          >
            <span className="relative">
              <span
                className={
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ' +
                  (user.is_online
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]')
                }
              >
                {initials(user.name)}
              </span>
              {user.is_online ? (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-raised)] bg-emerald-500" />
                </span>
              ) : null}
            </span>

            <span className="flex flex-col leading-tight">
              <span className="text-sm text-[var(--text-primary)]">{user.name}</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {user.is_online ? 'online now' : timeAgo(user.last_seen_at)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DayHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h2>
      <span className="text-xs text-[var(--text-muted)]">
        {count === 1 ? '1 event' : `${count} events`}
      </span>
      <span className="h-px flex-1 bg-[var(--border-default)]" />
    </div>
  )
}

/**
 * The stream itself, as a timeline.
 *
 * A list rather than a table: these rows are not comparable to one another —
 * an invoice and a shop door have nothing to line up in columns — and a table
 * would promise a symmetry that is not there. The rail down the left is what
 * makes it read as one day passing rather than as rows in a grid.
 */
function Feed({ events }: { events: ActivityEvent[] }) {
  return (
    <ol className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)]">
      {events.map((event, index) => (
        <li
          key={event.id}
          className={
            'group relative flex items-start gap-3 px-4 py-3 transition hover:bg-[var(--surface-sunken)]' +
            (index === 0 ? '' : ' border-t border-[var(--border-default)]')
          }
        >
          <span className="w-11 shrink-0 pt-0.5 text-right font-mono text-[11px] text-[var(--text-muted)]">
            {clockTime(event.at)}
          </span>

          <KindIcon event={event} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {describe(event)}
              </span>
              {event.reference ? (
                <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                  {event.reference}
                </span>
              ) : null}
            </div>

            <div className="truncate text-xs text-[var(--text-muted)]">
              {event.customer_name ?? '—'}
              {event.salesman_name ? ` · ${event.salesman_name}` : ''}
              {event.kind === 'visit' && event.status === 'checked_out'
                ? ` · ${formatDwell(event)} inside`
                : ''}
            </div>
          </div>

          <div className="shrink-0 text-right">
            {hasAmount(event) ? (
              <div className="font-mono text-sm text-[var(--text-primary)]">
                {formatAmount(event)}
              </div>
            ) : null}
            <div className="text-[11px] text-[var(--text-muted)]">{timeAgo(event.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** A glyph per kind, so the stream can be skimmed without reading it. */
function KindIcon({ event }: { event: ActivityEvent }) {
  const { icon, tint } = glyphFor(event)

  return (
    <span
      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`}
    >
      {icon}
    </span>
  )
}

function glyphFor(event: ActivityEvent): { icon: ReactElement; tint: string } {
  const size = 15

  switch (event.kind) {
    case 'visit':
      return event.status === 'checked_out'
        ? { icon: <LogOut size={size} />, tint: 'bg-slate-500/10 text-slate-500' }
        : { icon: <LogIn size={size} />, tint: 'bg-emerald-500/10 text-emerald-600' }
    case 'invoice':
      return { icon: <ArrowUpRight size={size} />, tint: 'bg-blue-500/10 text-blue-600' }
    case 'order':
      return { icon: <ShoppingCart size={size} />, tint: 'bg-indigo-500/10 text-indigo-600' }
    case 'return':
      return { icon: <RotateCcw size={size} />, tint: 'bg-amber-500/10 text-amber-600' }
    case 'collection':
      return { icon: <Banknote size={size} />, tint: 'bg-emerald-500/10 text-emerald-600' }
    case 'unload':
      return { icon: <ArrowDownLeft size={size} />, tint: 'bg-slate-500/10 text-slate-500' }
    default:
      return { icon: <Truck size={size} />, tint: 'bg-slate-500/10 text-slate-500' }
  }
}

/** Shape of the feed while the first read is in flight. */
function FeedSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={
            'flex items-center gap-3 px-4 py-3' +
            (i === 0 ? '' : ' border-t border-[var(--border-default)]')
          }
        >
          <div className="h-3 w-9 animate-pulse rounded bg-[var(--surface-sunken)]" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--surface-sunken)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/4 animate-pulse rounded bg-[var(--surface-sunken)]" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--surface-sunken)]" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** "Ahmad Khalil" → "AK". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
