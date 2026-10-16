import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Lock, Settings2, ShoppingCart, X } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Button } from '@/shared/components/Button'
import { ExportButton } from '@/features/reports/components/ExportButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { rangeLabel } from '@/features/reports/report-format'
import { useModules } from '@/core/auth/use-modules'
import { MODULES } from '@/core/auth/modules'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useCustomers, useSalesmen } from '@/features/customers/hooks/use-customers'
import { useOrders } from '../hooks/use-orders'
import { OrderRulesDrawer } from '../components/OrderRulesDrawer'
import { OrderApproveDrawer } from '../components/OrderApproveDrawer'
import { RejectOrderModal } from '../components/RejectOrderModal'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { ordersExportDoc } from '../orders-export'
import { STATUS_OPTIONS, canDecide, formatDay, formatMoney, orderPill } from '../orders-logic'
import type { Order, OrderStatus } from '../types'

type Row = Order & Record<string, unknown>

/**
 * The orders the field team took, and the queue of ones waiting for approval.
 *
 * Most orders never need the office: the company's rules approve them as they
 * are taken. The ones that broke a rule wait here with the reason beside them,
 * and a banner over the list says how many there are.
 */
export function OrdersPage() {
  const { has } = useModules()
  const bought = has(MODULES.ORDERS)
  const { can } = usePermissions()
  const mayApprove = can(PERMISSIONS.ORDERS_APPROVE)

  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [salesmanId, setSalesmanId] = useState('')
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [taken, setTaken] = useState({ from: '', to: '' })
  const [delivery, setDelivery] = useState({ from: '', to: '' })
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [reviewId, setReviewId] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<Order | null>(null)

  const orders = useOrders({
    status,
    salesmanId: salesmanId ? Number(salesmanId) : null,
    customerId: customerId ? Number(customerId) : null,
    search,
    dateFrom: taken.from,
    dateTo: taken.to,
    deliveryFrom: delivery.from,
    deliveryTo: delivery.to,
    page,
  }, bought)
  const salesmen = useSalesmen()
  const customers = useCustomers()
  const { rows: shownRows, onVisibleRows } = useShownRows((orders.data?.orders ?? []) as Row[])

  if (!bought) {
    return (
      <EmptyState
        icon={<Lock size={28} />}
        title="Orders aren't part of your plan"
        description="Take orders in the field, approve them by your own rules, and plan which day each shop is visited. Ask your Salesly provider to switch it on for your company."
      />
    )
  }
  if (orders.isError && !orders.data) {
    return <ErrorState message="The orders could not be loaded." onRetry={() => orders.refetch()} />
  }

  const list = (orders.data?.orders ?? []) as Row[]
  const pending = orders.data?.pendingApproval ?? 0
  const lastPage = orders.data?.lastPage ?? 1

  // Written under the printed title, so a filtered page never reads as the whole book.
  const exportFilters = [
    status && `Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`,
    customerId && `Customer: ${customers.data?.find((c) => String(c.id) === customerId)?.name ?? customerId}`,
    salesmanId && `Salesman: ${salesmen.data?.find((s) => String(s.id) === salesmanId)?.name ?? salesmanId}`,
    search.trim() && `Search “${search.trim()}”`,
    (taken.from || taken.to) && `Taken ${rangeLabel(taken.from, taken.to)}`,
    (delivery.from || delivery.to) && `Delivery ${rangeLabel(delivery.from, delivery.to)}`,
  ]

  const filtersSet = [status, salesmanId, customerId, search, taken.from || taken.to, delivery.from || delivery.to].filter(Boolean).length
  // Any change of filter starts again from the first page.
  const refilter = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const columns: Column<Row>[] = [
    {
      key: 'trs_number',
      header: 'Order',
      render: (o) => <span className="font-mono text-[var(--text-primary)]">#{o.trs_number}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <div className="max-w-[300px] min-w-0">
          <div className="truncate font-medium text-[var(--text-primary)]">{o.customer.name ?? '—'}</div>
          {o.status === 'SUBMITTED' && o.hold_reasons.length > 0 && (
            <div className="truncate text-xs text-[var(--accent-amber)]">{o.hold_reasons[0].message}</div>
          )}
        </div>
      ),
    },
    { key: 'salesman', header: 'Taken by', render: (o) => o.salesman.name ?? '—' },
    { key: 'trs_date', header: 'Taken on', render: (o) => o.trs_date ?? '—' },
    {
      key: 'delivery_date',
      header: 'Delivery',
      render: (o) => (
        <div>
          <div className="text-[var(--text-primary)]">{formatDay(o.delivery_date)}</div>
          <div className="text-xs text-[var(--text-muted)]">{o.deliverer.name ?? ''}</div>
        </div>
      ),
    },
    {
      key: 'total_price',
      header: 'Total',
      align: 'right',
      render: (o) => <span className="font-mono tabular-nums">{formatMoney(o.total_price)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => {
        const pill = orderPill(o.status)
        return <StatusPill status={pill.status} label={pill.label} />
      },
    },
    // The row's two answers, as on a load request: turn it down, or open it to
    // adjust and approve.
    ...(mayApprove
      ? [
          {
            key: 'actions',
            header: '',
            width: 'w-[17rem]',
            render: (o: Row) =>
              canDecide(o) ? (
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" icon={<X size={15} />} onClick={() => setRejecting(o)}>
                    Reject
                  </Button>
                  <Button icon={<ClipboardCheck size={15} />} onClick={() => setReviewId(o.id)}>
                    Review &amp; approve
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">—</span>
              ),
          } as Column<Row>,
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Orders taken in the field, and the ones waiting for your approval"
        actions={
          <>
            <ExportButton
              variant="outline"
              disabled={orders.isLoading}
              build={() => ordersExportDoc(shownRows(), orders.data?.total ?? 0, exportFilters)}
            />
            {mayApprove && (
              <Button variant="secondary" onClick={() => setRulesOpen(true)}>
                <Settings2 size={15} /> Approval rules
              </Button>
            )}
          </>
        }
      />

      {pending > 0 && status !== 'SUBMITTED' && (
        <button
          type="button"
          onClick={() => refilter(() => setStatus('SUBMITTED'))}
          className="mb-4 flex w-full items-center justify-between rounded-[var(--radius-card)] border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/8 px-4 py-3 text-left text-sm"
        >
          <span className="font-semibold text-[var(--accent-amber)]">
            {pending} {pending === 1 ? 'order is' : 'orders are'} waiting for approval
          </span>
          <span className="text-xs text-[var(--text-muted)]">Show them →</span>
        </button>
      )}

      <FilterBar
        search={search}
        onSearch={(q) => refilter(() => setSearch(q))}
        searchPlaceholder="Order number or customer"
        activeCount={filtersSet}
        onClearFilters={() =>
          refilter(() => {
            setStatus('')
            setSalesmanId('')
            setCustomerId('')
            setSearch('')
            setTaken({ from: '', to: '' })
            setDelivery({ from: '', to: '' })
          })
        }
        filters={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-56">
              <FilterSelect
                label="Status"
                value={status}
                onChange={(v) => refilter(() => setStatus(v as OrderStatus | ''))}
                options={STATUS_OPTIONS.filter((o) => o.value !== '').map((o) => ({ value: o.value, label: o.label }))}
                allLabel="All statuses"
              />
            </div>
            <div className="w-56">
              <FilterSelect
                label="Salesman"
                value={salesmanId}
                onChange={(v) => refilter(() => setSalesmanId(v))}
                options={(salesmen.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
                allLabel="All salesmen"
              />
            </div>
            <div className="w-56">
              <FilterSelect
                label="Customer"
                value={customerId}
                onChange={(v) => refilter(() => setCustomerId(v))}
                options={(customers.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                allLabel="All customers"
                searchable
                searchPlaceholder="Search customers…"
              />
            </div>
            <DateRangeFilter label="Taken" from={taken.from} to={taken.to} onChange={(r) => refilter(() => setTaken(r))} />
            <DateRangeFilter
              label="Delivery"
              from={delivery.from}
              to={delivery.to}
              onChange={(r) => refilter(() => setDelivery(r))}
            />
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={list}
        keyField="id"
        loading={orders.isLoading}
        onVisibleRows={onVisibleRows}
        // Opening a row opens the order's own page, as a load request does.
        onRowClick={(o) => navigate(`/orders/${o.id}`)}
        emptyIcon={<ShoppingCart size={28} />}
        emptyMessage={filtersSet ? 'No order matches these filters' : 'No orders yet — they appear here as the field team takes them'}
      />

      {lastPage > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-[var(--text-muted)]">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {lastPage}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

      <OrderApproveDrawer orderId={reviewId} onClose={() => setReviewId(null)} />
      <RejectOrderModal order={rejecting} open={rejecting != null} onClose={() => setRejecting(null)} />
      <OrderRulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  )
}
