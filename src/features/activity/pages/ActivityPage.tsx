import { useMemo, useState, type ReactElement } from 'react'
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
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
import { useActivity } from '../hooks/use-activity'
import {
  describe,
  formatAmount,
  formatDwell,
  hasAmount,
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

      {isLoading && events.length === 0 ? (
        <div className="py-16 text-center text-sm text-[var(--text-muted)]">Loading…</div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} />}
          title="Nothing yet"
          description="Documents raised and shops entered will appear here as they happen."
        />
      ) : (
        <Feed events={events} />
      )}
    </>
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
    <div className="mb-4 flex flex-wrap gap-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1.5"
          title={`Last heard from ${timeAgo(user.last_seen_at)}`}
        >
          <span
            className={
              user.is_online
                ? 'h-2 w-2 rounded-full bg-emerald-500'
                : 'h-2 w-2 rounded-full bg-[var(--text-muted)] opacity-50'
            }
          />
          <span className="text-sm text-[var(--text-primary)]">{user.name}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {user.is_online ? 'online' : timeAgo(user.last_seen_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * The stream itself.
 *
 * A list rather than a table: these rows are not comparable to one another —
 * an invoice and a shop door have nothing to line up in columns — and a table
 * would promise a symmetry that is not there.
 */
function Feed({ events }: { events: ActivityEvent[] }) {
  return (
    <ol className="overflow-hidden rounded-xl border border-[var(--border-default)]">
      {events.map((event, index) => (
        <li
          key={event.id}
          className={
            'flex items-start gap-3 bg-[var(--surface-raised)] px-4 py-3' +
            (index === 0 ? '' : ' border-t border-[var(--border-default)]')
          }
        >
          <KindIcon event={event} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {describe(event)}
              </span>
              {event.reference ? (
                <span className="font-mono text-xs text-[var(--text-muted)]">
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
            <div className="text-xs text-[var(--text-muted)]">{timeAgo(event.at)}</div>
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
