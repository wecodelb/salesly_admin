import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Clock,
  Plus,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Button } from '@/shared/components/Button'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import { parseApiDate } from '@/features/reports/report-format'
import { adjustmentsExportDoc } from '../adjustments-export'
import { AdjustmentFormDrawer } from '../components/AdjustmentFormDrawer'
import { useAdjustments, useAdjustmentTypes } from '../hooks/use-adjustments'
import {
  formatQty,
  rowsOf,
  statusPill,
  totalsOf,
  typesOf,
  type Adjustment,
} from '../types'

const STATUSES = [
  { value: 'pending', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

/**
 * Stock that moved without a sale behind it.
 *
 * The strip leads with what is waiting rather than what happened: an approved
 * sheet is history and nobody acts on it, while a pending one is a claim about
 * a shelf that somebody has to look at — and it is the only figure here that
 * can still be changed.
 *
 * In and out are shown apart rather than netted. A day that added a thousand
 * and lost a thousand is not the same day as one where nothing happened, and a
 * single net figure of zero would say it was.
 */
export function AdjustmentsPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.ADJUSTMENTS_CREATE)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [creating, setCreating] = useState(false)

  const debouncedSearch = useDebounce(search, 250)

  const { data: warehouses = [] } = useWarehouses()
  const { data: types = [] } = useAdjustmentTypes()

  const { data, isLoading, isError, refetch } = useAdjustments({
    status: status || null,
    warehouseId: warehouseId ? Number(warehouseId) : null,
    adjustmentTypeId: typeId ? Number(typeId) : null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  })

  const adjustments = data?.adjustments ?? []
  const truncated = data?.truncated ?? false

  // Applied here rather than sent as well: the endpoint does search, but
  // re-sending on every keystroke would refetch the whole book to narrow a
  // list already in hand.
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return adjustments

    return adjustments.filter(
      (a) =>
        String(a.number).includes(q) ||
        (a.warehouse ?? '').toLowerCase().includes(q) ||
        (a.memo ?? '').toLowerCase().includes(q) ||
        typesOf(a).some((t) => t.name.toLowerCase().includes(q)) ||
        rowsOf(a).some((r) => (r.item_name ?? '').toLowerCase().includes(q)),
    )
  }, [adjustments, debouncedSearch])

  const totals = useMemo(() => totalsOf(filtered), [filtered])

  const stats = useMemo(
    () => [
      {
        label: 'Awaiting approval',
        value: totals.pending,
        tone: totals.pending > 0 ? ('warn' as const) : undefined,
        icon: <Clock size={15} />,
      },
      { label: 'Sheets', value: totals.count, icon: <ClipboardList size={15} /> },
      { label: 'Units in', value: formatQty(totals.addedIn), icon: <ArrowUpRight size={15} /> },
      { label: 'Units out', value: formatQty(totals.takenOut), icon: <ArrowDownRight size={15} /> },
    ],
    [totals],
  )

  const activeFilters =
    (status ? 1 : 0) +
    (warehouseId ? 1 : 0) +
    (typeId ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  // Said in words on the printed page, where the filter bar is not there to be
  // looked at.
  const exportFilters = useMemo(
    () => [
      debouncedSearch.trim() && `Search “${debouncedSearch.trim()}”`,
      status && `Status: ${STATUSES.find((s) => s.value === status)?.label ?? status}`,
      warehouseId &&
        `Warehouse: ${warehouses.find((w) => String(w.id) === warehouseId)?.name ?? warehouseId}`,
      typeId && `Type: ${types.find((t) => String(t.id) === typeId)?.name ?? typeId}`,
      dateFrom && `From ${dateFrom}`,
      dateTo && `To ${dateTo}`,
      truncated && 'Partial read — most recent sheets only',
    ],
    [debouncedSearch, status, warehouseId, typeId, dateFrom, dateTo, truncated, warehouses, types],
  )

  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<Adjustment & Record<string, unknown>>[] = [
    {
      key: 'number',
      header: 'Sheet',
      sortable: true,
      render: (a) => (
        <div className="min-w-0">
          <span className="font-mono text-sm text-[var(--text-primary)]">#{a.number}</span>
          <div className="text-xs text-[var(--text-muted)]">{a.adjusted_at ?? '—'}</div>
        </div>
      ),
      // `d/m/Y H:i` compared as text puts the 3rd of November before the 2nd of
      // January, so the column sorts on a real date.
      sortValue: (a) => parseApiDate(a.adjusted_at)?.getTime() ?? 0,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      sortable: true,
      render: (a) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">{a.warehouse || '—'}</div>
          {a.created_by?.name && (
            <div className="truncate text-xs text-[var(--text-muted)]">{a.created_by.name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'types',
      header: 'What',
      // The types as badges — a sheet carrying two damaged crates and an
      // expired pallet says so at a glance rather than in a count.
      render: (a) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            {typesOf(a).length === 0 ? (
              <span className="text-sm text-[var(--text-muted)]">—</span>
            ) : (
              typesOf(a).map((t) => (
                <span
                  key={t.id}
                  className="inline-flex rounded-[var(--radius-pill)] bg-[var(--bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]"
                >
                  {t.name}
                </span>
              ))
            )}
          </div>
          {rowsOf(a).length > 0 && (
            <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
              {rowsOf(a).length} {rowsOf(a).length === 1 ? 'row' : 'rows'} ·{' '}
              {rowsOf(a)
                .slice(0, 2)
                .map((r) => r.item_name)
                .join(', ')}
              {rowsOf(a).length > 2 ? '…' : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'movement',
      header: 'Movement',
      align: 'right',
      render: (a) => {
        const inQty = rowsOf(a).filter((r) => r.direction === 'in').reduce((s, r) => s + r.qty, 0)
        const outQty = rowsOf(a).filter((r) => r.direction === 'out').reduce((s, r) => s + r.qty, 0)

        return (
          <div className="flex flex-col items-end gap-0.5 font-mono text-sm tabular-nums">
            {inQty > 0 && (
              <span className="text-[var(--accent-green)]">+{formatQty(inQty)}</span>
            )}
            {outQty > 0 && (
              <span className="text-[var(--accent-amber)]">−{formatQty(outQty)}</span>
            )}
            {inQty === 0 && outQty === 0 && (
              <span className="text-[var(--text-muted)]">—</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      // Loud on purpose: an approved sheet has moved stock and a pending one
      // has not, and a reader who mixes them up is reading a shelf that does
      // not exist.
      render: (a) => {
        const pill = statusPill(a)
        return <StatusPill status={pill.status} label={pill.label} />
      },
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Adjustments" subtitle="Stock that moved without a sale behind it" />
        <ErrorState
          title="Couldn't load adjustments"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Adjustments"
        subtitle="Stock that moved without a sale behind it — and the paperwork saying why"
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() => adjustmentsExportDoc(shownRows(), adjustments.length, exportFilters)}
            />
            {canWrite && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New adjustment
              </Button>
            )}
          </>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      {truncated && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/8 px-4 py-3">
          <AlertTriangle size={15} aria-hidden className="mt-0.5 text-[var(--accent-amber)]" />
          <p className="text-xs text-[var(--text-secondary)]">
            Only the most recent sheets were loaded, so the totals above cover part of the
            period. Narrow by date or warehouse for exact figures.
          </p>
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by sheet number, product, warehouse or note…"
        activeCount={activeFilters}
        onClearFilters={() => {
          setStatus('')
          setWarehouseId('')
          setTypeId('')
          setDateFrom('')
          setDateTo('')
        }}
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <FilterSelect
                label="Status"
                allLabel="All statuses"
                icon={<Clock size={14} />}
                value={status}
                onChange={setStatus}
                options={STATUSES}
              />
            </div>
            <div className="w-52">
              <FilterSelect
                label="Warehouse"
                allLabel="All warehouses"
                icon={<WarehouseIcon size={14} />}
                value={warehouseId}
                onChange={setWarehouseId}
                searchPlaceholder="Search warehouses…"
                options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
              />
            </div>
            <div className="w-48">
              <FilterSelect
                label="Type"
                allLabel="All types"
                icon={<ClipboardList size={14} />}
                value={typeId}
                onChange={setTypeId}
                options={types.map((t) => ({ value: String(t.id), label: t.name }))}
              />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
          </div>
        }
      />

      <DataTable
        onVisibleRows={onVisibleRows}
        columns={columns}
        data={filtered as (Adjustment & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(a) => navigate(`/adjustments/${a.id}`)}
        emptyIcon={<ClipboardList size={28} />}
        emptyMessage={
          activeFilters > 0 || debouncedSearch
            ? 'No adjustments match these filters.'
            : 'No adjustments yet — they appear here as stock is written up or off.'
        }
      />

      {creating && (
        <AdjustmentFormDrawer open onClose={() => setCreating(false)} />
      )}
    </>
  )
}
