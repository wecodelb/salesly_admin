import { useState } from 'react'
import { CheckCircle2, Circle, Lock, Plus, Route, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { useModules } from '@/core/auth/use-modules'
import { MODULES } from '@/core/auth/modules'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useSalesmen } from '@/features/customers/hooks/use-customers'
import { formatDay, formatMoney } from '@/features/orders/orders-logic'
import { useRouteDay, useVisitPlanActions, useVisitPlans } from '../hooks/use-routes'
import { VisitPlanDrawer } from '../components/VisitPlanDrawer'
import { describeRhythm, todayYmd } from '../routes-logic'
import type { VisitPlan } from '../types'

type Row = VisitPlan & Record<string, unknown>

/**
 * Who visits which shop, and when — and the day that comes out of it.
 *
 * A plan is a rhythm (weekdays, every N weeks), so the office sets it once and
 * every salesman's day is read off the plans: the shops due a visit, ticked
 * once he has checked in, and the approved orders he is to deliver. A new
 * order is due on the customer's next visit.
 */
export function RoutesPage() {
  const { has } = useModules()
  const bought = has(MODULES.ORDERS)
  const { can } = usePermissions()
  const mayPlan = can(PERMISSIONS.CALENDAR_PLAN)
  const toast = useToast()

  const [salesmanId, setSalesmanId] = useState('')
  const [date, setDate] = useState(todayYmd())
  const [editing, setEditing] = useState<VisitPlan | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const salesmen = useSalesmen()
  const plans = useVisitPlans(salesmanId ? Number(salesmanId) : null, bought)
  const { remove } = useVisitPlanActions()

  // The day panel needs one salesman: the one filtered, else the first.
  const daySalesmanId = salesmanId ? Number(salesmanId) : salesmen.data?.[0]?.id ?? null
  const day = useRouteDay(bought ? daySalesmanId : null, date)

  if (!bought) {
    return (
      <EmptyState
        icon={<Lock size={28} />}
        title="Visit planning isn't part of your plan"
        description="It comes with the Orders module. Ask your Salesly provider to switch it on for your company."
      />
    )
  }
  if (plans.isError && !plans.data) {
    return <ErrorState message="The visit plans could not be loaded." onRetry={() => plans.refetch()} />
  }

  const open = (plan: VisitPlan | null) => {
    setEditing(plan)
    setDrawerOpen(true)
  }

  const columns: Column<Row>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (p) => (
        <div>
          <div className="font-medium text-[var(--text-primary)]">{p.customer.name ?? '—'}</div>
          <div className="text-xs text-[var(--text-muted)]">{p.customer.code ?? ''}</div>
        </div>
      ),
    },
    { key: 'salesman', header: 'Salesman', render: (p) => p.salesman.name ?? '—' },
    { key: 'weekdays', header: 'Visits', render: (p) => describeRhythm(p.weekdays, p.every_weeks) },
    { key: 'next_visit', header: 'Next visit', render: (p) => (p.is_active ? formatDay(p.next_visit) : '—') },
    {
      key: 'is_active',
      header: 'Status',
      render: (p) => <StatusPill status={p.is_active ? 'success' : 'inactive'} label={p.is_active ? 'Active' : 'Paused'} />,
    },
    ...(mayPlan
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (p: Row) => (
              <button
                type="button"
                aria-label={`Remove the plan for ${p.customer.name ?? 'this customer'}`}
                onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    await remove.mutateAsync(p.id)
                    toast.success('Visit plan removed')
                  } catch {
                    toast.error('Not removed', 'Try again.')
                  }
                }}
                className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--accent-red)]"
              >
                <Trash2 size={15} />
              </button>
            ),
          },
        ]
      : []),
  ]

  const visits = day.data?.visits ?? []
  const deliveries = day.data?.deliveries ?? []
  const dayName = salesmen.data?.find((s) => s.id === daySalesmanId)?.name

  return (
    <>
      <PageHeader
        title="Routes"
        subtitle="When each customer is visited, and each salesman's day"
        actions={
          mayPlan ? (
            <Button onClick={() => open(null)}>
              <Plus size={15} /> Plan a customer
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        filters={
          <div className="w-56">
            <FilterSelect
              label="Salesman"
              value={salesmanId}
              onChange={setSalesmanId}
              options={(salesmen.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
              allLabel="All salesmen"
            />
          </div>
        }
        activeCount={salesmanId ? 1 : 0}
        onClearFilters={() => setSalesmanId('')}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <DataTable
          columns={columns}
          data={(plans.data ?? []) as Row[]}
          keyField="id"
          loading={plans.isLoading}
          onRowClick={mayPlan ? (p) => open(p) : undefined}
          emptyIcon={<Route size={28} />}
          emptyMessage="No customer has a visit plan yet"
        />

        <aside className="h-fit rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">The day</h2>
              <p className="text-xs text-[var(--text-muted)]">{dayName ?? 'No salesman yet'}</p>
            </div>
            <input
              type="date"
              aria-label="Day"
              value={date}
              onChange={(e) => setDate(e.target.value || todayYmd())}
              className="rounded-[var(--radius-btn)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
            />
          </div>

          {day.isLoading ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">Loading…</p>
          ) : (
            <>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Visits · {visits.length}
              </h3>
              {visits.length === 0 ? (
                <p className="mb-4 text-sm text-[var(--text-muted)]">No shop is due a visit this day.</p>
              ) : (
                <ul className="mb-4 space-y-1.5">
                  {visits.map((v) => (
                    <li key={v.plan_id} className="flex items-center gap-2 text-sm">
                      {v.visited ? (
                        <CheckCircle2 size={15} className="text-[var(--accent-green)]" />
                      ) : (
                        <Circle size={15} className="text-[var(--text-muted)]" />
                      )}
                      <span className="truncate text-[var(--text-primary)]">{v.customer.name}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Deliveries · {deliveries.length}
              </h3>
              {deliveries.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No approved order is due this day.</p>
              ) : (
                <ul className="space-y-1.5">
                  {deliveries.map((d) => (
                    <li key={d.order_id} className="flex items-center gap-2 text-sm">
                      <Truck size={15} className="text-[var(--text-muted)]" />
                      <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                        #{d.trs_number} · {d.customer.name}
                      </span>
                      <span className="font-mono tabular-nums text-[var(--text-secondary)]">{formatMoney(d.total_price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>

      <VisitPlanDrawer open={drawerOpen} plan={editing} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
