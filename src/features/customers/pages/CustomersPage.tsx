import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeCheck,
  CreditCard,
  Eye,
  FlaskConical,
  MoreVertical,
  Pencil,
  Plus,
  Store,
  Power,
  PowerOff,

  Tags,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { customersExportDoc } from '../customers-export'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { KpiCard } from '@/shared/components/KpiCard/KpiCard'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Modal } from '@/shared/components/Modal/Modal'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { phoneMatchesQuery } from '@/shared/components/PhoneInput/phone-value'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useCustomerGroups } from '@/features/customer-groups/hooks/use-customer-groups'
import { AssignSalesmanModal } from '../components/AssignSalesmanModal'
import { AssignPriceListModal } from '../components/AssignPriceListModal'
import { CreditLimitModal } from '../components/CreditLimitModal'
import { CustomerFormDrawer } from '../components/CustomerFormDrawer'
import {
  USE_MOCK_DATA,
  useCustomers,
  useDeleteCustomer,
  useSalesmen,
  useSetCustomerActive,
  useVerifyCustomer,
} from '../hooks/use-customers'
import { formatMoney, isOverLimit, type AdminCustomer } from '../types'

// React part 1 — Customers management (manager scope = ALL company customers).
// Assign-to-salesman is what makes a customer appear in that salesman's
// Flutter app. Data is served from the mock store until backend part 1 lands
// (see USE_MOCK_DATA in ../hooks/use-customers.ts).
export function CustomersPage() {
  const { can } = usePermissions()
  const canCreate = can(PERMISSIONS.CUSTOMERS_CREATE)
  const canEdit = can(PERMISSIONS.CUSTOMERS_EDIT)
  const canDelete = can(PERMISSIONS.CUSTOMERS_DELETE)
  const canVerify = can(PERMISSIONS.CUSTOMERS_VERIFY)

  const { run } = useActionProgress()
  const { data: customers = [], isLoading, isError, refetch } = useCustomers()
  const { data: salesmen = [] } = useSalesmen()
  const { data: customerGroups = [] } = useCustomerGroups()
  const verifyCustomer = useVerifyCustomer()
  const setCustomerActive = useSetCustomerActive()
  const deleteCustomer = useDeleteCustomer()

  const [search, setSearch] = useState('')
  const [salesmanFilter, setSalesmanFilter] = useState('')
  const [creditFilter, setCreditFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')
  const [customerGroupFilter, setCustomerGroupFilter] = useState('')
  const [assigning, setAssigning] = useState<AdminCustomer | null>(null)
  const [settingLimit, setSettingLimit] = useState<AdminCustomer | null>(null)
  const [assigningPriceList, setAssigningPriceList] = useState<AdminCustomer | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AdminCustomer | null>(null)
  const [deleting, setDeleting] = useState<AdminCustomer | null>(null)
  // The form drawer pulls areas, currencies and price lists the moment it
  // mounts. Nobody browsing the list should pay for those three requests, so
  // it joins the tree on the first open and then stays — which keeps the
  // close animation intact.
  const [formMounted, setFormMounted] = useState(false)

  const debouncedSearch = useDebounce(search, 250)
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return customers.filter((c) => {
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        // Digit-wise, so "03 456 789" still finds "+961 3 456 789" — the
        // number is stored the way it is read, not the way it is searched.
        phoneMatchesQuery(c.phone1, q) ||
        phoneMatchesQuery(c.phone2, q) ||
        c.address.toLowerCase().includes(q)
      const matchesSalesman =
        !salesmanFilter ||
        (salesmanFilter === 'unassigned'
          ? c.salesman_id === null
          : String(c.salesman_id) === salesmanFilter)
      const matchesCredit =
        !creditFilter ||
        (creditFilter === 'due' ? c.balance > 0 : isOverLimit(c))
      const matchesStatus =
        !statusFilter || (statusFilter === 'active' ? c.is_active : !c.is_active)
      const matchesVerified =
        !verifiedFilter ||
        (verifiedFilter === 'verified' ? c.is_verified : !c.is_verified)
      // 'unset' is the only way to reach the customers nobody has classified.
      const matchesCustomerGroup =
        !customerGroupFilter ||
        (customerGroupFilter === 'unset'
          ? c.customer_group_id == null
          : String(c.customer_group_id) === customerGroupFilter)
      return (
        matchesQuery &&
        matchesSalesman &&
        matchesCredit &&
        matchesStatus &&
        matchesVerified &&
        matchesCustomerGroup
      )
    })
  }, [
    customers,
    debouncedSearch,
    salesmanFilter,
    creditFilter,
    statusFilter,
    verifiedFilter,
    customerGroupFilter,
  ])

  const kpis = useMemo(() => {
    const assigned = customers.filter((c) => c.salesman_id !== null).length
    return {
      total: customers.length,
      assigned,
      unassigned: customers.length - assigned,
      overLimit: customers.filter(isOverLimit).length,
    }
  }, [customers])

  // Option counts, taken over the whole list rather than the filtered rows so
  // they stay a stable map of the data instead of echoing the current filter.
  const counts = useMemo(() => {
    const bySalesman = new Map<string, number>()
    const byCustomerGroup = new Map<string, number>()
    let unassigned = 0
    let ungrouped = 0
    let withBalance = 0
    let active = 0
    let verified = 0
    for (const c of customers) {
      if (c.salesman_id === null) unassigned++
      else {
        const key = String(c.salesman_id)
        bySalesman.set(key, (bySalesman.get(key) ?? 0) + 1)
      }
      if (c.customer_group_id == null) ungrouped++
      else {
        const key = String(c.customer_group_id)
        byCustomerGroup.set(key, (byCustomerGroup.get(key) ?? 0) + 1)
      }
      if (c.balance > 0) withBalance++
      if (c.is_active) active++
      if (c.is_verified) verified++
    }
    return {
      bySalesman,
      byCustomerGroup,
      unassigned,
      ungrouped,
      withBalance,
      overLimit: customers.filter(isOverLimit).length,
      active,
      inactive: customers.length - active,
      verified,
      unverified: customers.length - verified,
    }
  }, [customers])

  const activeFilterCount = [
    salesmanFilter,
    customerGroupFilter,
    creditFilter,
    statusFilter,
    verifiedFilter,
  ].filter(Boolean).length

  // Said in words on the printed page. The filters are obvious on screen — the
  // selects are right there — and invisible on a sheet of paper, where a
  // narrowed list read as the whole book is how a total gets acted on wrongly.
  const exportFilters = useMemo(() => {
    const salesmanName =
      salesmanFilter === 'unassigned'
        ? 'Unassigned'
        : salesmen.find((s) => String(s.id) === salesmanFilter)?.name
    const groupName =
      customerGroupFilter === 'unset'
        ? 'Ungrouped'
        : customerGroups.find((g) => String(g.id) === customerGroupFilter)?.name

    return [
      debouncedSearch.trim() && `Search “${debouncedSearch.trim()}”`,
      salesmanFilter && `Salesman: ${salesmanName ?? salesmanFilter}`,
      customerGroupFilter && `Group: ${groupName ?? customerGroupFilter}`,
      creditFilter === 'due' && 'With balance',
      creditFilter === 'over' && 'Over limit',
      statusFilter && (statusFilter === 'active' ? 'Active only' : 'Inactive only'),
      verifiedFilter &&
        (verifiedFilter === 'verified' ? 'Verified only' : 'Unverified only'),
    ]
  }, [
    debouncedSearch,
    salesmanFilter,
    customerGroupFilter,
    creditFilter,
    statusFilter,
    verifiedFilter,
    salesmen,
    customerGroups,
  ])

  const clearFilters = () => {
    setSalesmanFilter('')
    setCustomerGroupFilter('')
    setCreditFilter('')
    setStatusFilter('')
    setVerifiedFilter('')
  }

  // Every write below goes through `run`, which owns the centre-screen dialog:
  // spinner while in flight, checkmark or the server's message at the end. The
  // toasts these actions used to raise would now be saying the same thing a
  // second time, so they're gone.
  const handleVerify = (c: AdminCustomer) =>
    run(
      { label: 'Verifying customer', detail: c.name, success: `${c.name} is now approved.` },
      () => verifyCustomer.mutateAsync(c.id),
    )

  const handleSetActive = (c: AdminCustomer, active: boolean) =>
    run(
      {
        label: active ? 'Activating customer' : 'Deactivating customer',
        detail: c.name,
        success: active
          ? `${c.name} is back in day-to-day work.`
          : `${c.name} is dormant — no new orders.`,
      },
      () => setCustomerActive.mutateAsync({ id: c.id, active }),
    )

  const openCreate = () => {
    setFormMounted(true)
    setCreating(true)
  }

  const openEdit = (c: AdminCustomer) => {
    setFormMounted(true)
    setEditing(c)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const customer = deleting
    // Closed up front: leaving the confirm modal stacked under the progress
    // dialog would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Removing customer',
        detail: customer.name,
        success: `${customer.name} was hidden from the list.`,
      },
      () => deleteCustomer.mutateAsync(customer.id),
    )
  }

  /** Verify / activate / delete — whichever of them this customer and this
   *  user's permissions allow, in menu order. */
  const lifecycleActions = (c: AdminCustomer) => [
    ...(canVerify && !c.is_verified
      ? [{ label: 'Verify', icon: <BadgeCheck size={14} />, onClick: () => handleVerify(c) }]
      : []),
    ...(canEdit
      ? [
          c.is_active
            ? {
                label: 'Deactivate',
                icon: <PowerOff size={14} />,
                onClick: () => handleSetActive(c, false),
              }
            : {
                label: 'Activate',
                icon: <Power size={14} />,
                onClick: () => handleSetActive(c, true),
              },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: 'Delete',
            icon: <Trash2 size={14} />,
            onClick: () => setDeleting(c),
            danger: true,
          },
        ]
      : []),
  ]

  // What the table is actually showing, in the order it shows them.
  // DataTable owns the sort, so this is the page's only way to print rows
  // in the order somebody reads them on screen.
  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

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
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[var(--text-primary)] truncate">{c.name}</span>
              {c.is_verified && (
                // Wrapper carries the tooltip: a `title` attribute on an <svg>
                // is not what browsers show on hover.
                <span
                  className="flex-shrink-0 leading-none"
                  title={
                    c.verified_by_name ? `Verified by ${c.verified_by_name}` : 'Verified customer'
                  }
                >
                  <BadgeCheck
                    size={14}
                    aria-label="Verified"
                    className="text-[var(--accent-primary)]"
                  />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--text-muted)] truncate">{c.code}</span>
              {!c.is_verified && <StatusPill status="draft" label="Unverified" />}
            </div>
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
      key: 'customer_group_name',
      header: 'Group',
      sortable: true,
      // The company's own grouping, maintained under Preferences > Customer
      // groups. Neutral chip on purpose: these labels are user-defined, so
      // there's no fixed good/bad meaning to colour-code.
      render: (c) =>
        c.customer_group_name ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            {c.customer_group_name}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">Ungrouped</span>
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
      render: (c) =>
        c.allow_credit === false ? (
          <span className="text-xs text-[var(--text-muted)]">Cash only</span>
        ) : (
          <span className="font-mono text-sm text-[var(--text-secondary)]">
            {c.credit_limit != null ? formatMoney(c.credit_limit) : '—'}
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Standing',
      // Two independent readings stacked: whether the customer is still in
      // play at all, then what their balance says. Named "Standing" since
      // "Status" now belongs to the company's own vocabulary column above.
      render: (c) => (
        <div className="flex flex-col items-start gap-1">
          {!c.is_active && <StatusPill status="inactive" label="Inactive" />}
          {isOverLimit(c) ? (
            <StatusPill status="error" label="Over limit" />
          ) : c.balance > 0 ? (
            <StatusPill status="warning" label="Has due" />
          ) : (
            <StatusPill status="active" label="Clear" />
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-1',
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button
                aria-label={`Actions for ${c.name}`}
                className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
              >
                <MoreVertical size={15} />
              </button>
            }
            items={[
              {
                label: 'View details',
                icon: <Eye size={14} />,
                onClick: () => navigate(`/customers/${c.id}`),
              },
              ...(canEdit
                ? [
                    { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(c) },
                    {
                      label: 'Assign salesman',
                      icon: <UserPlus size={14} />,
                      onClick: () => setAssigning(c),
                    },
                    {
                      label: 'Set credit limit',
                      icon: <CreditCard size={14} />,
                      onClick: () => setSettingLimit(c),
                    },
                    {
                      label: 'Assign price list',
                      icon: <Tags size={14} />,
                      onClick: () => setAssigningPriceList(c),
                    },
                  ]
                : []),
              // Lifecycle sits below a single rule, so the whole group reads
              // as one section however many of its entries apply.
              ...lifecycleActions(c).map((item, i) => ({ ...item, divider: i === 0 })),
            ]}
          />
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
          <>
            {USE_MOCK_DATA && (
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-pill)] bg-[var(--accent-amber)]/12 text-[var(--accent-amber)] text-xs font-medium">
                <FlaskConical size={13} />
                Demo data — backend part 1 pending
              </span>
            )}
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() =>
                customersExportDoc(shownRows(), customers.length, exportFilters)
              }
            />
            {canCreate && (
              <Button icon={<Plus size={16} />} onClick={openCreate}>
                New customer
              </Button>
            )}
          </>
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
        activeCount={activeFilterCount}
        onClearFilters={clearFilters}
        filters={
          <>
            <div className="w-52">
              <FilterSelect
                label="Salesman"
                allLabel="All salesmen"
                icon={<UserCheck size={14} />}
                value={salesmanFilter}
                onChange={setSalesmanFilter}
                searchPlaceholder="Search salesmen…"
                options={[
                  { value: 'unassigned', label: 'Unassigned', count: counts.unassigned },
                  ...salesmen.map((s) => ({
                    value: String(s.id),
                    label: s.name,
                    group: 'Assigned to',
                    count: counts.bySalesman.get(String(s.id)) ?? 0,
                  })),
                ]}
              />
            </div>
            <div className="w-48">
              {/* The company's own vocabulary, in the order set under
                  Preferences > Customer groups. */}
              <FilterSelect
                label="Group"
                allLabel="All groups"
                icon={<BadgeCheck size={14} />}
                value={customerGroupFilter}
                onChange={setCustomerGroupFilter}
                searchPlaceholder="Search groups…"
                options={[
                  { value: 'unset', label: 'Ungrouped', count: counts.ungrouped },
                  ...customerGroups.map((s) => ({
                    value: String(s.id),
                    label: s.name,
                    group: 'Groups',
                    count: counts.byCustomerGroup.get(String(s.id)) ?? 0,
                  })),
                ]}
              />
            </div>
            <div className="w-44">
              <FilterSelect
                label="Balance"
                allLabel="All balances"
                icon={<CreditCard size={14} />}
                value={creditFilter}
                onChange={setCreditFilter}
                options={[
                  { value: 'due', label: 'With balance', count: counts.withBalance },
                  { value: 'over', label: 'Over limit', count: counts.overLimit },
                ]}
              />
            </div>
            <div className="w-40">
              {/* Named "Activity" rather than "Status": the status filter above
                  is now the company's own vocabulary. */}
              <FilterSelect
                label="Activity"
                allLabel="Active & inactive"
                icon={<Power size={14} />}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'active', label: 'Active', count: counts.active },
                  { value: 'inactive', label: 'Inactive', count: counts.inactive },
                ]}
              />
            </div>
            <div className="w-48">
              <FilterSelect
                label="Verification"
                allLabel="All verification"
                icon={<BadgeCheck size={14} />}
                value={verifiedFilter}
                onChange={setVerifiedFilter}
                options={[
                  { value: 'verified', label: 'Verified', count: counts.verified },
                  { value: 'unverified', label: 'Unverified', count: counts.unverified },
                ]}
              />
            </div>
          </>
        }
      />

      <DataTable
        onVisibleRows={onVisibleRows}
        columns={columns}
        data={filtered as (AdminCustomer & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(c) => navigate(`/customers/${(c as AdminCustomer).id}`)}
        emptyMessage="No customers match your filters."
      />

      <AssignSalesmanModal customer={assigning} onClose={() => setAssigning(null)} />
      <CreditLimitModal customer={settingLimit} onClose={() => setSettingLimit(null)} />
      {/* Mounted on demand for the same reason as the form drawer: it fetches
          the price lists as soon as it exists, and browsing the list shouldn't
          trigger that. A Modal renders nothing while closed, so nothing is lost. */}
      {assigningPriceList && (
        <AssignPriceListModal
          customer={assigningPriceList}
          onClose={() => setAssigningPriceList(null)}
        />
      )}

      {formMounted && (
        <>
          <CustomerFormDrawer open={creating} onClose={() => setCreating(false)} />
          <CustomerFormDrawer open={!!editing} onClose={() => setEditing(null)} customer={editing} />
        </>
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove customer"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteCustomer.isPending} onClick={confirmDelete}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Remove <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span>?
          They'll be hidden from the list and from their salesman's app, but can be restored later.
        </p>
      </Modal>
    </>
  )
}
