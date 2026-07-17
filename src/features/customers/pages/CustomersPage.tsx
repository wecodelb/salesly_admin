import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  CreditCard,
  Eye,
  FlaskConical,
  Store,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { KpiCard } from '@/shared/components/KpiCard/KpiCard'
import { Select } from '@/shared/components/Select'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { AssignSalesmanModal } from '../components/AssignSalesmanModal'
import { CreditLimitModal } from '../components/CreditLimitModal'
import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer'
import { USE_MOCK_DATA, useCustomers, useSalesmen } from '../hooks/use-customers'
import { formatMoney, isOverLimit, type AdminCustomer } from '../types'

// React part 1 — Customers management (manager scope = ALL company customers).
// Assign-to-salesman is what makes a customer appear in that salesman's
// Flutter app. Data is served from the mock store until backend part 1 lands
// (see USE_MOCK_DATA in ../hooks/use-customers.ts).
export function CustomersPage() {
  const { can } = usePermissions()
  const canEdit = can(PERMISSIONS.CUSTOMERS_EDIT)

  const { data: customers = [], isLoading, isError, refetch } = useCustomers()
  const { data: salesmen = [] } = useSalesmen()

  const [search, setSearch] = useState('')
  const [salesmanFilter, setSalesmanFilter] = useState('')
  const [creditFilter, setCreditFilter] = useState('')
  const [detail, setDetail] = useState<AdminCustomer | null>(null)
  const [assigning, setAssigning] = useState<AdminCustomer | null>(null)
  const [settingLimit, setSettingLimit] = useState<AdminCustomer | null>(null)

  const debouncedSearch = useDebounce(search, 250)
  const location = useLocation()

  // Deep link from the dashboard: /customers navigated with { customerId }
  // in router state opens that customer's detail drawer once data is in.
  useEffect(() => {
    const id = (location.state as { customerId?: number } | null)?.customerId
    if (!id || customers.length === 0) return
    const target = customers.find((c) => c.id === id)
    if (target) setDetail(target)
  }, [location.state, customers])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return customers.filter((c) => {
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.phone1.includes(q) ||
        c.address.toLowerCase().includes(q)
      const matchesSalesman =
        !salesmanFilter ||
        (salesmanFilter === 'unassigned'
          ? c.salesman_id === null
          : String(c.salesman_id) === salesmanFilter)
      const matchesCredit =
        !creditFilter ||
        (creditFilter === 'due' ? c.balance > 0 : isOverLimit(c))
      return matchesQuery && matchesSalesman && matchesCredit
    })
  }, [customers, debouncedSearch, salesmanFilter, creditFilter])

  const kpis = useMemo(() => {
    const assigned = customers.filter((c) => c.salesman_id !== null).length
    return {
      total: customers.length,
      assigned,
      unassigned: customers.length - assigned,
      overLimit: customers.filter(isOverLimit).length,
    }
  }, [customers])

  const columns: Column<AdminCustomer & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-[var(--accent-primary)]">
              {c.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[var(--text-primary)] truncate">{c.name}</div>
            <div className="text-xs font-mono text-[var(--text-muted)] truncate">{c.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Contact',
      render: (c) => (
        <div className="min-w-0">
          <div className="text-sm text-[var(--text-secondary)] truncate">{c.phone1 || '—'}</div>
          <div className="text-xs text-[var(--text-muted)] truncate">{c.address || '—'}</div>
        </div>
      ),
    },
    {
      key: 'salesman_name',
      header: 'Salesman',
      sortable: true,
      render: (c) =>
        c.salesman_name ? (
          <span className="text-sm text-[var(--text-secondary)]">{c.salesman_name}</span>
        ) : (
          <StatusPill status="inactive" label="Unassigned" />
        ),
    },
    {
      key: 'balance',
      header: 'Balance',
      sortable: true,
      render: (c) => (
        <span
          className={[
            'font-mono text-sm font-medium',
            isOverLimit(c)
              ? 'text-[var(--accent-red)]'
              : c.balance > 0
                ? 'text-[var(--accent-amber)]'
                : 'text-[var(--text-secondary)]',
          ].join(' ')}
        >
          {formatMoney(c.balance)}
        </span>
      ),
    },
    {
      key: 'credit_limit',
      header: 'Credit limit',
      sortable: true,
      render: (c) => (
        <span className="font-mono text-sm text-[var(--text-secondary)]">
          {c.credit_limit != null ? formatMoney(c.credit_limit) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) =>
        isOverLimit(c) ? (
          <StatusPill status="error" label="Over limit" />
        ) : c.balance > 0 ? (
          <StatusPill status="warning" label="Has due" />
        ) : (
          <StatusPill status="active" label="Clear" />
        ),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-1',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <button
            title="View"
            onClick={(e) => {
              e.stopPropagation()
              setDetail(c)
            }}
            className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
          >
            <Eye size={15} />
          </button>
          {canEdit && (
            <button
              title="Assign salesman"
              onClick={(e) => {
                e.stopPropagation()
                setAssigning(c)
              }}
              className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
            >
              <UserPlus size={15} />
            </button>
          )}
          {canEdit && (
            <button
              title="Set credit limit"
              onClick={(e) => {
                e.stopPropagation()
                setSettingLimit(c)
              }}
              className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
            >
              <CreditCard size={15} />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Customers" subtitle="All company customers — assignment & credit" />
        <ErrorState
          title="Couldn't load customers"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="All company customers — assignment & credit"
        actions={
          USE_MOCK_DATA ? (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-pill)] bg-[var(--accent-amber)]/12 text-[var(--accent-amber)] text-xs font-medium">
              <FlaskConical size={13} />
              Demo data — backend part 1 pending
            </span>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Customers"
          value={kpis.total}
          loading={isLoading}
          icon={<Store size={18} className="text-[var(--accent-primary)]" />}
        />
        <KpiCard
          title="Assigned"
          value={kpis.assigned}
          loading={isLoading}
          icon={<UserCheck size={18} className="text-[var(--accent-green)]" />}
          iconBg="bg-[var(--accent-green)]/10"
        />
        <KpiCard
          title="Unassigned"
          value={kpis.unassigned}
          loading={isLoading}
          icon={<UserX size={18} className="text-[var(--accent-amber)]" />}
          iconBg="bg-[var(--accent-amber)]/10"
        />
        <KpiCard
          title="Over limit"
          value={kpis.overLimit}
          loading={isLoading}
          icon={<AlertTriangle size={18} className="text-[var(--accent-red)]" />}
          iconBg="bg-[var(--accent-red)]/10"
        />
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by name, code, phone or address…"
        filters={
          <>
            <div className="w-44">
              <Select
                value={salesmanFilter}
                onChange={(e) => setSalesmanFilter(e.target.value)}
                placeholder="All salesmen"
                options={[
                  { value: 'unassigned', label: 'Unassigned' },
                  ...salesmen.map((s) => ({ value: String(s.id), label: s.name })),
                ]}
              />
            </div>
            <div className="w-40">
              <Select
                value={creditFilter}
                onChange={(e) => setCreditFilter(e.target.value)}
                placeholder="All balances"
                options={[
                  { value: 'due', label: 'With balance' },
                  { value: 'over', label: 'Over limit' },
                ]}
              />
            </div>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={filtered as (AdminCustomer & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(c) => setDetail(c as AdminCustomer)}
        emptyMessage="No customers match your filters."
      />

      <CustomerDetailDrawer
        customer={detail}
        onClose={() => setDetail(null)}
        canEdit={canEdit}
        onAssign={(c) => {
          setDetail(null)
          setAssigning(c)
        }}
        onSetLimit={(c) => {
          setDetail(null)
          setSettingLimit(c)
        }}
      />

      <AssignSalesmanModal customer={assigning} onClose={() => setAssigning(null)} />
      <CreditLimitModal customer={settingLimit} onClose={() => setSettingLimit(null)} />
    </>
  )
}
