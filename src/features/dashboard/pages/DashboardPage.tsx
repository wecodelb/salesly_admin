import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronRight,
  DollarSign,
  MapPin,
  RefreshCw,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { StatCard } from '../components/StatCard'
import { SalesTrendChart } from '../components/SalesTrendChart'
import { TopSalesmenChart } from '../components/TopSalesmenChart'
import { useDashboardSummary } from '../hooks/use-dashboard'
import {
  creditUse,
  money,
  moneyExact,
  orderStatus,
  type OwingCustomer,
  type RecentOrder,
} from '../types'

const CARD =
  'rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)]'
const SECTION_TITLE = 'text-sm font-semibold text-[var(--text-primary)]'

/** "14:32" — the dashboard refreshes itself, so it says when it last did. */
function clockTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** "12 Mar" — for naming a single day that is not today. */
function shortDay(iso: string): string {
  const at = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(at.getTime())) return iso
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * The manager's cockpit, at company scope.
 *
 * Every figure comes from GET /dashboard/summary, aggregated server-side in one
 * request. None of it could be assembled here: the list endpoints are paginated,
 * so "sales today" summed from page one of /orders would be a number that looks
 * right and is wrong — which is worse than the demo badge this screen used to
 * carry.
 *
 * The one thing deliberately not shown is days overdue. The schema has no due
 * date and no payment terms, so the old "12 days overdue" was invented — and it
 * was the single number on this screen a manager would have acted on. What is
 * shown instead is what is genuinely known: the balance, and whether it has
 * passed the credit limit somebody actually set.
 *
 * Every figure answers the same window. The cards, the trend and the ranking
 * all follow the dates at the top, and the cards say which period they are —
 * a "Sales today" heading over last week's figure is the kind of quiet mismatch
 * that teaches people not to trust a dashboard.
 *
 * What is deliberately never dated is what customers owe. A balance is true
 * now, not as at last Tuesday, and narrowing it to the window would report a
 * debt that has since been paid.
 */

/** The windows a manager actually asks for, as offsets from today. */
const PRESETS: { label: string; days: number }[] = [
  { label: 'Today', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

const isoDay = (offsetDays = 0): string => {
  const at = new Date()
  at.setDate(at.getDate() - offsetDays)
  return at.toISOString().slice(0, 10)
}

export function DashboardPage() {
  const navigate = useNavigate()

  // Empty means today — the server's own default, so a first load asks for
  // nothing and gets what this screen has always shown.
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data, isLoading, isError, refetch, isFetching } = useDashboardSummary({
    from: from || undefined,
    to: to || undefined,
  })

  const applyPreset = (days: number) => {
    if (days === 1) {
      setFrom('')
      setTo('')
      return
    }
    setFrom(isoDay(days - 1))
    setTo(isoDay(0))
  }

  /** Which preset, if any, the current window matches — so one can look chosen. */
  const activePreset = (days: number): boolean => {
    if (days === 1) return !from && !to
    return from === isoDay(days - 1) && to === isoDay(0)
  }

  const openCustomer = (customerId: number | null) => {
    if (customerId != null) navigate(`/customers/${customerId}`)
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Your sales overview at a glance" />
        <ErrorState
          title="Couldn't load the dashboard"
          message="The figures for this company couldn't be read. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  const totals = data?.totals

  /**
   * What the cards call the window.
   *
   * A card headed "Sales today" is telling a lie the moment somebody picks last
   * week, and a figure that misnames its own period is worse than one carrying
   * no period at all — the reader has no way to know it moved.
   */
  const periodWord = !data
    ? ''
    : data.period.is_today
      ? 'today'
      : data.period.days === 1
        ? `on ${shortDay(data.period.from)}`
        : `· ${data.period.days} days`

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your sales overview at a glance"
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh now"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--bg-surface-raised)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-60"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            {data ? `Updated ${clockTime(data.generated_at)}` : 'Loading'}
          </button>
        }
      />

      {/* The window everything below answers to. Presets first because they are
          what gets used; the two dates are there for the month somebody has to
          reconcile. */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.days)}
              className={[
                'rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-colors',
                activePreset(preset.days)
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              From
            </span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              To
            </span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
            />
          </label>
          {data && !data.period.is_today && (
            <span className="pb-1 text-[11px] text-[var(--text-muted)]">
              vs {shortDay(data.period.compared_from)} – {shortDay(data.period.compared_to)}
            </span>
          )}
        </div>
      </div>

      {/* The four figures for the window, each against the window before it. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={`Sales ${periodWord}`}
          value={totals ? money(totals.sales.value) : '—'}
          change={totals?.sales.change}
          icon={<DollarSign size={18} />}
          accent="primary"
          loading={isLoading}
        />
        <StatCard
          title={`Orders ${periodWord}`}
          value={totals ? String(totals.orders.value) : '—'}
          change={totals?.orders.change}
          icon={<ShoppingCart size={18} />}
          accent="green"
          loading={isLoading}
        />
        <StatCard
          title={`Collected ${periodWord}`}
          value={totals ? money(totals.collected.value) : '—'}
          change={totals?.collected.change}
          icon={<Wallet size={18} />}
          accent="amber"
          loading={isLoading}
        />
        <StatCard
          title="Visits done"
          value={totals ? `${totals.visits.done}/${totals.visits.started}` : '—'}
          footnote={
            totals
              ? totals.visits.started === 0
                ? 'No calls started'
                : `${totals.visits.started - totals.visits.done} still open`
              : undefined
          }
          icon={<MapPin size={18} />}
          accent="teal"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={`lg:col-span-2 ${CARD}`}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>{data ? `Sales — last ${data.sales_trend.length} days` : 'Sales trend'}</h2>
            <span className="font-mono text-xs text-[var(--text-muted)]">
              {data
                ? money(data.sales_trend.reduce((sum, d) => sum + d.value, 0)) + ' total'
                : ''}
            </span>
          </div>
          {isLoading || !data ? (
            <div className="h-[210px] animate-pulse rounded bg-[var(--bg-surface-raised)]" />
          ) : (
            <SalesTrendChart data={data.sales_trend} />
          )}
        </section>

        <section className={CARD}>
          <h2 className={`${SECTION_TITLE} mb-4`}>{periodWord ? `Top salesmen ${periodWord}` : 'Top salesmen'}</h2>
          {isLoading || !data ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--border-default)]" />
                  <div className="h-2 animate-pulse rounded-full bg-[var(--bg-surface-raised)]" />
                </div>
              ))}
            </div>
          ) : (
            <TopSalesmenChart data={data.top_salesmen} />
          )}
        </section>
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={`lg:col-span-2 ${CARD}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={SECTION_TITLE}>Recent orders</h2>
            <button
              onClick={() => navigate('/orders')}
              className="cursor-pointer text-xs font-medium text-[var(--accent-blue)] hover:underline"
            >
              See all
            </button>
          </div>

          {isLoading || !data ? (
            <SkeletonRows />
          ) : data.recent_orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              No orders have been written yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {data.recent_orders.map((order) => (
                <OrderRow key={order.id} order={order} onOpen={openCustomer} />
              ))}
            </div>
          )}
        </section>

        {/* Outstanding — balances, not "overdue". See the note on the page. */}
        <section className={CARD}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className={`${SECTION_TITLE} inline-flex items-center gap-2`}>
              <AlertTriangle size={15} className="text-[var(--accent-red)]" />
              Outstanding
            </h2>
            <span className="font-mono text-xs font-semibold text-[var(--accent-red)]">
              {data ? money(data.outstanding.total) : '—'}
            </span>
          </div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            {data
              ? `${data.outstanding.customers} accounts owing` +
                (data.outstanding.over_limit > 0
                  ? ` · ${data.outstanding.over_limit} over limit`
                  : '')
              : ''}
          </p>

          {isLoading || !data ? (
            <SkeletonRows />
          ) : data.outstanding.top.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              Nobody owes anything.
            </p>
          ) : (
            <>
              <div className="divide-y divide-[var(--border-subtle)]">
                {data.outstanding.top.map((customer) => (
                  <OwingRow key={customer.id} customer={customer} onOpen={openCustomer} />
                ))}
              </div>
              <button
                onClick={() => navigate('/collections')}
                className="mt-3 h-9 w-full cursor-pointer rounded-[var(--radius-btn)] bg-[var(--accent-red)]/10 text-sm font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--accent-red)]/20"
              >
                Go collect
              </button>
            </>
          )}
        </section>
      </div>
    </>
  )
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 py-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 flex-1 animate-pulse rounded bg-[var(--border-default)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--bg-surface-raised)]" />
        </div>
      ))}
    </div>
  )
}

function OrderRow({
  order,
  onOpen,
}: {
  order: RecentOrder
  onOpen: (id: number | null) => void
}) {
  const status = orderStatus(order.status)

  return (
    <button
      onClick={() => onOpen(order.customer_id)}
      disabled={order.customer_id == null}
      title={order.customer_id == null ? undefined : 'Open customer'}
      className="-mx-2 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[var(--bg-surface-raised)] disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className="w-16 flex-shrink-0 font-mono text-xs text-[var(--text-muted)]">
        {order.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
          {order.customer}
        </span>
        <span className="block truncate text-xs text-[var(--text-muted)]">{order.salesman}</span>
      </span>
      <span className="flex-shrink-0 font-mono text-sm font-medium text-[var(--text-primary)]">
        {moneyExact(order.total)}
      </span>
      <span className="flex-shrink-0">
        <StatusPill status={status.pill} label={status.label} />
      </span>
    </button>
  )
}

function OwingRow({
  customer,
  onOpen,
}: {
  customer: OwingCustomer
  onOpen: (id: number) => void
}) {
  const use = creditUse(customer)
  const over = use !== null && use > 1

  return (
    <button
      onClick={() => onOpen(customer.id)}
      title="Open customer"
      className="-mx-2 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[var(--bg-surface-raised)]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
          {customer.name}
        </span>
        {/* What is actually known: the balance against the ceiling somebody
            set. Where no ceiling exists there is nothing to say about it. */}
        {use === null ? (
          <span className="block text-xs text-[var(--text-muted)]">No credit limit set</span>
        ) : (
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-surface-raised)]">
              <span
                className={`block h-full rounded-full ${over ? 'bg-[var(--accent-red)]' : 'bg-[var(--accent-amber)]'}`}
                style={{ width: `${Math.min(use, 1) * 100}%` }}
              />
            </span>
            <span
              className={`text-xs ${over ? 'text-[var(--accent-red)]' : 'text-[var(--text-muted)]'}`}
            >
              {over ? 'Over limit' : `of ${money(customer.credit_limit ?? 0)}`}
            </span>
          </span>
        )}
      </span>
      <span className="flex-shrink-0 font-mono text-sm font-medium text-[var(--accent-red)]">
        {moneyExact(customer.balance)}
      </span>
      <ChevronRight size={15} className="flex-shrink-0 text-[var(--text-muted)]" />
    </button>
  )
}
