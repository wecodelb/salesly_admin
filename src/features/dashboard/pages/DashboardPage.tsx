import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronRight,
  FlaskConical,
  MapPin,
  ShoppingCart,
  Wallet,
  DollarSign,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { KpiCard } from '@/shared/components/KpiCard/KpiCard'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { SalesTrendChart } from '../components/SalesTrendChart'
import { TopSalesmenChart } from '../components/TopSalesmenChart'
import {
  money,
  OVERDUE_ACCOUNTS,
  RECENT_ORDERS,
  SALES_TREND,
  TOP_SALESMEN,
  type RecentOrder,
} from '../data'

const orderStatus: Record<RecentOrder['status'], { pill: string; label: string }> = {
  pending: { pill: 'warning', label: 'Pending' },
  confirmed: { pill: 'active', label: 'Confirmed' },
  delivered: { pill: 'success', label: 'Delivered' },
}

// Manager cockpit — mirrors the Salesly mobile dashboard (KPI boxes, today's
// figures, overdue accounts) at company scope. All figures are demo data
// until the dashboard endpoints exist; customer names navigate to the
// Customers screen and open that customer's detail drawer.
export function DashboardPage() {
  const navigate = useNavigate()

  const openCustomer = (customerId: number) =>
    navigate('/customers', { state: { customerId } })

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your sales overview at a glance"
        actions={
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-pill)] bg-[var(--accent-amber)]/12 text-[var(--accent-amber)] text-xs font-medium">
            <FlaskConical size={13} />
            Demo data — API pending
          </span>
        }
      />

      {/* KPI row — same four boxes as the mobile dashboard, company scope */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Sales today"
          value={money(4280)}
          change={12}
          changePeriod="vs yesterday"
          icon={<DollarSign size={18} className="text-[var(--accent-primary)]" />}
        />
        <KpiCard
          title="Orders today"
          value={32}
          change={8}
          changePeriod="vs yesterday"
          icon={<ShoppingCart size={18} className="text-[var(--accent-green)]" />}
          iconBg="bg-[var(--accent-green)]/10"
        />
        <KpiCard
          title="Collected today"
          value={money(1150)}
          change={-4}
          changePeriod="vs yesterday"
          icon={<Wallet size={18} className="text-[var(--accent-amber)]" />}
          iconBg="bg-[var(--accent-amber)]/10"
        />
        <KpiCard
          title="Visits done"
          value="27/48"
          icon={<MapPin size={18} className="text-[var(--accent-teal)]" />}
          iconBg="bg-[var(--accent-teal)]/10"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <section className="lg:col-span-2 bg-[var(--bg-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Sales — last 14 days
          </h2>
          <SalesTrendChart data={SALES_TREND} />
        </section>

        <section className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Top salesmen — this week
          </h2>
          <TopSalesmenChart data={TOP_SALESMEN} />
        </section>
      </div>

      {/* Activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent orders */}
        <section className="lg:col-span-2 bg-[var(--bg-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent orders</h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs font-medium text-[var(--accent-blue)] hover:underline cursor-pointer"
            >
              See all
            </button>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {RECENT_ORDERS.map((o) => (
              <button
                key={o.id}
                onClick={() => openCustomer(o.customerId)}
                title="Open customer"
                className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[var(--bg-surface-raised)] rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
              >
                <span className="text-xs font-mono text-[var(--text-muted)] w-16 flex-shrink-0">
                  {o.number}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                    {o.customer}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)] truncate">
                    {o.salesman}
                  </span>
                </span>
                <span className="text-sm font-mono font-medium text-[var(--text-primary)] flex-shrink-0">
                  {money(o.total)}
                </span>
                <span className="flex-shrink-0">
                  <StatusPill
                    status={orderStatus[o.status].pill}
                    label={orderStatus[o.status].label}
                  />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Overdue accounts — mirrors the mobile overdue banner (3 · $2,840) */}
        <section className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] inline-flex items-center gap-2">
              <AlertTriangle size={15} className="text-[var(--accent-red)]" />
              Overdue accounts
            </h2>
            <span className="text-xs font-mono font-semibold text-[var(--accent-red)]">
              {money(OVERDUE_ACCOUNTS.reduce((s, a) => s + a.amount, 0))}
            </span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {OVERDUE_ACCOUNTS.map((a) => (
              <button
                key={a.id}
                onClick={() => openCustomer(a.customerId)}
                title="Open customer"
                className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[var(--bg-surface-raised)] rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                    {a.customer}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {a.daysOverdue} days overdue
                  </span>
                </span>
                <span className="text-sm font-mono font-medium text-[var(--accent-red)] flex-shrink-0">
                  {money(a.amount)}
                </span>
                <ChevronRight size={15} className="text-[var(--text-muted)] flex-shrink-0" />
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/collections')}
            className="mt-3 w-full h-9 rounded-[var(--radius-btn)] bg-[var(--accent-red)]/10 text-[var(--accent-red)] text-sm font-medium hover:bg-[var(--accent-red)]/20 transition-colors cursor-pointer"
          >
            Go collect
          </button>
        </section>
      </div>
    </>
  )
}
