import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Ban,
  CheckCheck,
  Eye,
  FileCheck2,
  Inbox,
  MoreVertical,
  Pencil,
  Plus,
  Send,
  Trash2,
  Truck,
  UserCheck,
  Warehouse,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Modal } from '@/shared/components/Modal/Modal'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useSalesmen } from '@/features/customers/hooks/use-customers'
import { AcceptTransferModal } from '../components/AcceptTransferModal'
import { DepotTransferFormDrawer } from '../components/DepotTransferFormDrawer'
import { RefillRequestsPanel } from '../components/RefillRequestsPanel'
import {
  useCancelDepotTransfer,
  useDeleteDepotTransfer,
  useDepotTransfers,
  useIssueDepotTransfer,
  usePendingRefillCount,
  useWarehouseOptions,
} from '../hooks/use-my-depot'
import {
  TYPE_LABELS,
  VOLUME_UNIT,
  WEIGHT_UNIT,
  formatQty,
  formatVolume,
  formatWeight,
  isAcceptable,
  isEditableDraft,
  isPendingRequest,
  parseApiDate,
  toDateInput,
  transferPill,
  withinDateRange,
  type DepotTransfer,
  type DepotTransferType,
} from '../types'

/**
 * Everything moving between the warehouse and the depots, in one feed.
 *
 * The three documents share a list because they are one flow — a request, the
 * load that answers it, the signature that closes it — and reading them apart
 * hides the state that matters most: a load issued and not yet signed for is in
 * neither warehouse, and only this screen says so.
 */
export function DepotTransfersPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canIssue = can(PERMISSIONS.DEPOT_ISSUE)
  const canAccept = can(PERMISSIONS.DEPOT_ACCEPT)

  const { run } = useActionProgress()
  const { data: transfers = [], isLoading, isError, refetch } = useDepotTransfers()
  // The same polled figure the sidebar wears, so the two cannot disagree while
  // somebody is looking at both.
  const { data: pendingRequests = 0 } = usePendingRefillCount()
  const { data: salesmen = [] } = useSalesmen()
  const warehouses = useWarehouseOptions(transfers)
  const issueTransfer = useIssueDepotTransfer()
  const cancelTransfer = useCancelDepotTransfer()
  const deleteTransfer = useDeleteDepotTransfer()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [salesmanFilter, setSalesmanFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<DepotTransfer | null>(null)
  const [loadingFrom, setLoadingFrom] = useState<DepotTransfer | null>(null)
  const [accepting, setAccepting] = useState<DepotTransfer | null>(null)
  const [deleting, setDeleting] = useState<DepotTransfer | null>(null)
  // The form drawer pulls products, salesmen and the source's stock the moment
  // it mounts. Nobody reading the feed should pay for that, so it joins the
  // tree on the first open and then stays — which keeps the close animation.
  const [formMounted, setFormMounted] = useState(false)

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()

    return transfers.filter((t) => {
      const matchesQuery =
        !q ||
        t.trs_number.toLowerCase().includes(q) ||
        (t.salesman?.name ?? '').toLowerCase().includes(q) ||
        (t.source?.name ?? '').toLowerCase().includes(q) ||
        (t.destination?.name ?? '').toLowerCase().includes(q)
      const matchesType = !typeFilter || t.trs_type === typeFilter
      const matchesStatus = !statusFilter || t.status === statusFilter
      const matchesSalesman = !salesmanFilter || String(t.salesman?.id) === salesmanFilter
      // Either end matches: asking about a warehouse means everything that
      // moved through it, in whichever direction.
      const matchesWarehouse =
        !warehouseFilter ||
        String(t.source?.id) === warehouseFilter ||
        String(t.destination?.id) === warehouseFilter

      return (
        matchesQuery &&
        matchesType &&
        matchesStatus &&
        matchesSalesman &&
        matchesWarehouse &&
        withinDateRange(t.trs_date, dateFrom, dateTo)
      )
    })
  }, [
    transfers,
    debouncedSearch,
    typeFilter,
    statusFilter,
    salesmanFilter,
    warehouseFilter,
    dateFrom,
    dateTo,
  ])

  // Taken over the whole feed rather than the filtered rows: these four figures
  // describe the depot operation, and echoing the current filter back would
  // make them useless as the thing you glance at before loading anybody.
  const stats = useMemo(() => {
    const today = toDateInput(new Date())
    const stockedDepots = new Set<number>()
    let awaiting = 0
    let inTransit = 0
    let acceptedToday = 0

    for (const t of transfers) {
      if (isPendingRequest(t)) awaiting++
      if (t.is_in_transit) inTransit++
      if (t.trs_type === 'TRI') {
        const date = parseApiDate(t.trs_date)
        if (date && toDateInput(date) === today) acceptedToday++
        // A depot counts as stocked once something has actually been signed
        // into it — an issue still on the road has landed nowhere.
        if (t.destination?.is_depot && t.destination.id) stockedDepots.add(t.destination.id)
      }
    }

    return [
      {
        label: 'Requests waiting',
        value: awaiting,
        tone: awaiting > 0 ? ('warn' as const) : undefined,
        icon: <Inbox size={15} />,
      },
      {
        label: 'Loads on the road',
        value: inTransit,
        tone: inTransit > 0 ? ('warn' as const) : undefined,
        icon: <Truck size={15} />,
      },
      { label: 'Accepted today', value: acceptedToday, icon: <CheckCheck size={15} /> },
      { label: 'Depots stocked', value: stockedDepots.size, icon: <Warehouse size={15} /> },
    ]
  }, [transfers])

  const counts = useMemo(() => {
    const byType = new Map<string, number>()
    const byStatus = new Map<string, number>()
    const bySalesman = new Map<string, number>()

    for (const t of transfers) {
      byType.set(t.trs_type, (byType.get(t.trs_type) ?? 0) + 1)
      if (t.status) byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1)
      if (t.salesman?.id) {
        const key = String(t.salesman.id)
        bySalesman.set(key, (bySalesman.get(key) ?? 0) + 1)
      }
    }

    return { byType, byStatus, bySalesman }
  }, [transfers])

  const activeFilterCount = [
    typeFilter,
    statusFilter,
    salesmanFilter,
    warehouseFilter,
    dateFrom,
    dateTo,
  ].filter(Boolean).length

  const clearFilters = () => {
    setTypeFilter('')
    setStatusFilter('')
    setSalesmanFilter('')
    setWarehouseFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const openCreate = () => {
    setLoadingFrom(null)
    setFormMounted(true)
    setCreating(true)
  }

  const openEdit = (t: DepotTransfer) => {
    setFormMounted(true)
    setEditing(t)
  }

  const openLoadFrom = (request: DepotTransfer) => {
    setFormMounted(true)
    setLoadingFrom(request)
    setCreating(true)
  }

  const handleIssue = (t: DepotTransfer) =>
    run(
      {
        label: 'Issuing load',
        detail: t.trs_number,
        success: `The goods have left ${t.source?.name ?? 'the warehouse'} — in transit until somebody signs.`,
      },
      () => issueTransfer.mutateAsync(t.id),
    )

  const handleCancel = (t: DepotTransfer) =>
    run(
      {
        label: 'Cancelling load',
        detail: t.trs_number,
        success: 'The reservation is back on the shelf; the document stays readable.',
      },
      () => cancelTransfer.mutateAsync(t.id),
    )

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    // Closed up front: leaving the confirm modal under the progress dialog
    // would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting draft',
        detail: target.trs_number,
        success: 'The draft is gone and its reservation released.',
      },
      () => deleteTransfer.mutateAsync(target.id),
    )
  }

  const rowActions = (t: DepotTransfer) => [
    {
      label: 'View details',
      icon: <Eye size={14} />,
      onClick: () => navigate(`/depot-transfers/${t.id}`),
    },
    ...(canIssue && isEditableDraft(t)
      ? [
          { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(t) },
          { label: 'Issue', icon: <Send size={14} />, onClick: () => handleIssue(t), divider: true },
          { label: 'Cancel', icon: <Ban size={14} />, onClick: () => handleCancel(t) },
          {
            label: 'Delete draft',
            icon: <Trash2 size={14} />,
            onClick: () => setDeleting(t),
            danger: true,
          },
        ]
      : []),
    ...(canAccept && isAcceptable(t)
      ? [
          {
            label: 'Accept',
            icon: <FileCheck2 size={14} />,
            onClick: () => setAccepting(t),
            divider: true,
          },
        ]
      : []),
  ]

  // Document, date, salesman, weight, volume, status — what somebody deciding
  // whether a vehicle can take another load actually reads across. Everything
  // else a document carries is on its own page, one click away.
  const columns: Column<DepotTransfer & Record<string, unknown>>[] = [
    {
      key: 'trs_number',
      header: 'Document',
      sortable: true,
      render: (t) => (
        <span className="font-mono text-sm text-[var(--text-primary)]">{t.trs_number}</span>
      ),
    },
    {
      key: 'trs_date',
      header: 'Date',
      sortable: true,
      // The API writes dates day-first, which sorts as text into an order no
      // calendar recognises — 03/11 ahead of 02/12. Sorted on the parsed
      // instant instead; a date that won't parse sinks rather than shuffling
      // the rows around it.
      sortValue: (t) => parseApiDate(t.trs_date)?.getTime() ?? null,
      render: (t) => (
        <span className="whitespace-nowrap text-sm text-[var(--text-secondary)]">
          {t.trs_date ?? '—'}
        </span>
      ),
    },
    {
      key: 'salesman',
      header: 'Salesman',
      render: (t) =>
        t.salesman?.name ? (
          <span className="text-sm text-[var(--text-secondary)]">{t.salesman.name}</span>
        ) : (
          <StatusPill status="inactive" label="Nobody" />
        ),
    },
    {
      key: 'total_weight',
      header: `Weight (${WEIGHT_UNIT})`,
      sortable: true,
      align: 'right',
      // What the load costs a vehicle. Quantity says nothing about that — a
      // thousand sachets and a thousand crates are the same figure and two
      // different mornings.
      render: (t) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatWeight(t.total_weight)}
        </span>
      ),
    },
    {
      key: 'total_volume',
      header: `Volume (${VOLUME_UNIT})`,
      sortable: true,
      align: 'right',
      render: (t) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatVolume(t.total_volume)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => {
        const pill = transferPill(t)
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusPill status={pill.status} label={pill.label} pulse={t.is_in_transit} />
            {t.discrepancy_qty != null && t.discrepancy_qty > 0 && (
              <StatusPill status="error" label={`${formatQty(t.discrepancy_qty)} short`} />
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      width: 'w-1',
      render: (t) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button
                aria-label={`Actions for ${t.trs_number}`}
                className="cursor-pointer rounded-[var(--radius-btn)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
              >
                <MoreVertical size={15} />
              </button>
            }
            items={rowActions(t)}
          />
        </div>
      ),
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Depot loads" subtitle="Filling a salesman's depot, and emptying it back" />
        <ErrorState
          title="Couldn't load depot movements"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Depot loads"
        subtitle="Filling a salesman's depot from the warehouse, and emptying it back at the end of the day"
        actions={
          <div className="flex items-center gap-3">
            {/* Somebody is standing in a car park waiting on this, which is why
                it sits beside the title rather than only in the strip below. */}
            {pendingRequests > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--accent-amber)]/12 px-2.5 py-1 text-xs font-medium text-[var(--accent-amber)]">
                <Inbox size={13} aria-hidden />
                {pendingRequests} {pendingRequests === 1 ? 'request' : 'requests'} waiting
              </span>
            )}
            {canIssue && (
              <Button icon={<Plus size={16} />} onClick={openCreate}>
                New load
              </Button>
            )}
          </div>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <RefillRequestsPanel transfers={transfers} onLoadFrom={openLoadFrom} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by document, salesman or warehouse…"
        activeCount={activeFilterCount}
        onClearFilters={clearFilters}
        filters={
          <>
            <div className="w-48">
              <FilterSelect
                label="Type"
                allLabel="All documents"
                icon={<Truck size={14} />}
                value={typeFilter}
                onChange={setTypeFilter}
                options={(Object.keys(TYPE_LABELS) as DepotTransferType[]).map((type) => ({
                  value: type,
                  label: TYPE_LABELS[type],
                  count: counts.byType.get(type) ?? 0,
                }))}
              />
            </div>
            <div className="w-44">
              <FilterSelect
                label="Status"
                allLabel="Any status"
                icon={<CheckCheck size={14} />}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  {
                    // One stored status, two readings — a load being built is
                    // loaded, a request nobody has answered is waiting.
                    value: 'DRAFT',
                    label: 'Loaded / awaiting approval',
                    count: counts.byStatus.get('DRAFT') ?? 0,
                  },
                  {
                    value: 'CONFIRMED',
                    label: 'Issued / approved',
                    count: counts.byStatus.get('CONFIRMED') ?? 0,
                  },
                  {
                    value: 'COMPLETED',
                    label: 'Delivered',
                    count: counts.byStatus.get('COMPLETED') ?? 0,
                  },
                  {
                    value: 'CANCELED',
                    label: 'Cancelled / rejected',
                    count: counts.byStatus.get('CANCELED') ?? 0,
                  },
                ]}
              />
            </div>
            <div className="w-48">
              <FilterSelect
                label="Salesman"
                allLabel="All salesmen"
                icon={<UserCheck size={14} />}
                value={salesmanFilter}
                onChange={setSalesmanFilter}
                searchPlaceholder="Search salesmen…"
                options={salesmen.map((s) => ({
                  value: String(s.id),
                  label: s.name,
                  count: counts.bySalesman.get(String(s.id)) ?? 0,
                }))}
              />
            </div>
            <div className="w-52">
              <FilterSelect
                label="Warehouse"
                allLabel="Every warehouse"
                icon={<Warehouse size={14} />}
                value={warehouseFilter}
                onChange={setWarehouseFilter}
                searchPlaceholder="Search warehouses…"
                options={warehouses.map((w) => ({
                  value: String(w.id),
                  label: w.is_depot ? `${w.name} (depot)` : (w.name ?? ''),
                }))}
              />
            </div>
            {/* Whole days, matching the endpoint's own date_from/date_to. */}
            <div className="w-40">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
              />
            </div>
            <div className="w-40">
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
              />
            </div>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={filtered as (DepotTransfer & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(t) => navigate(`/depot-transfers/${(t as DepotTransfer).id}`)}
        emptyIcon={<Truck size={30} />}
        emptyMessage="Nothing has moved between the warehouse and the depots yet."
        emptyAction={
          canIssue ? (
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Load a salesman
            </Button>
          ) : undefined
        }
      />

      {formMounted && (
        <>
          <DepotTransferFormDrawer
            open={creating}
            onClose={() => {
              setCreating(false)
              setLoadingFrom(null)
            }}
            fromRequest={loadingFrom}
          />
          <DepotTransferFormDrawer
            open={!!editing}
            onClose={() => setEditing(null)}
            transfer={editing}
          />
        </>
      )}

      <AcceptTransferModal transfer={accepting} onClose={() => setAccepting(null)} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete draft load"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteTransfer.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Delete{' '}
          <span className="font-medium text-[var(--text-primary)]">{deleting?.trs_number}</span>?
          Nothing has left the warehouse yet — the goods it was holding go straight back on the
          shelf, and the document disappears for good.
        </p>
      </Modal>
    </>
  )
}
