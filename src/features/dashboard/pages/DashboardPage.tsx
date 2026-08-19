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
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch, isFetching } = useDashboardSummary()

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

  const today = data?.today

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

      {/* The four figures of the day, each against yesterday. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Sales today"
          value={today ? money(today.sales.value) : '—'}
          change={today?.sales.change}
          icon={<DollarSign size={18} />}
          accent="primary"
          loading={isLoading}
        />
        <StatCard
          title="Orders today"
          value={today ? String(today.orders.value) : '—'}
          change={today?.orders.change}
          icon={<ShoppingCart size={18} />}
          accent="green"
          loading={isLoading}
        />
        <StatCard
          title="Collected today"
          value={today ? money(today.collected.value) : '—'}
          change={today?.collected.change}
          icon={<Wallet size={18} />}
          accent="amber"
          loading={isLoading}
        />
        <StatCard
          title="Visits done"
          value={today ? `${today.visits.done}/${today.visits.started}` : '—'}
          footnote={
            today
              ? today.visits.started === 0
                ? 'No calls started today'
                : `${today.visits.started - today.visits.done} still open`
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
            <h2 className={SECTION_TITLE}>Sales — last 14 days</h2>
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
          <h2 className={`${SECTION_TITLE} mb-4`}>Top salesmen — this week</h2>
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
