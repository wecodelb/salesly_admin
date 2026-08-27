import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, PackagePlus, Truck, X } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { depotExportDoc } from '../depot-export'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { Button } from '@/shared/components/Button'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { DepotTransferFormDrawer } from '../components/DepotTransferFormDrawer'
import {
  useDepotTransfers,
  useRejectLoadRequest,
} from '../hooks/use-my-depot'
import {
  formatQty,
  isPendingRequest,
  transferPill,
  type DepotTransfer,
} from '../types'

/**
 * What the salesmen have asked the warehouse for.
 *
 * The inbox and the history in one table rather than a panel above a feed: a
 * request nobody has answered and one answered last Tuesday are the same document
 * at two points in its life, and splitting them meant reading two lists to follow
 * one ask.
 *
 * Answering is a single act. Pressing "Create load" opens the load drawer already
 * holding the salesman's lines, and that drawer approves the request and raises the
 * load together — so a request never rests in an "approved, nobody acted" state,
 * which was the state that used to get forgotten.
 */
export function LoadRequestsPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canIssue = can(PERMISSIONS.DEPOT_ISSUE)
  const { run } = useActionProgress()

  const { data: transfers = [], isLoading, isError, refetch } = useDepotTransfers()
  const rejectRequest = useRejectLoadRequest()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loadingFrom, setLoadingFrom] = useState<DepotTransfer | null>(null)
  const [formMounted, setFormMounted] = useState(false)

  const debouncedSearch = useDebounce(search, 250)

  // Only the requests. The feed carries all three documents because they are one
  // chain, and this screen is the first link of it.
  const requests = useMemo(
    () => transfers.filter((t) => t.trs_type === 'LR'),
    [transfers],
  )

  // Which requests already produced a load. Read off the loads themselves — a load
  // names its request through src_id — rather than trusting the request's own
  // status, so a row can never claim a load exists when none was raised.
  const loadedRequestIds = useMemo(
    () =>
      new Set(
        transfers
          .filter((t) => t.trs_type === 'LI' && t.src_id)
          .map((t) => t.src_id),
      ),
    [transfers],
  )

  const waiting = useMemo(() => requests.filter(isPendingRequest), [requests])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()

    return requests.filter((request) => {
      const matchesQuery =
        !q ||
        request.trs_number.toLowerCase().includes(q) ||
        (request.salesman?.name ?? '').toLowerCase().includes(q) ||
        (request.source?.name ?? '').toLowerCase().includes(q)

      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'waiting'
          ? isPendingRequest(request)
          : statusFilter === 'answered'
            ? request.status === 'CONFIRMED'
            : request.status === 'CANCELED')

      return matchesQuery && matchesStatus
    })
  }, [requests, debouncedSearch, statusFilter])

  const stats = useMemo(
    () => [
      {
        label: 'Waiting on an answer',
        value: waiting.length,
        tone: waiting.length > 0 ? ('warn' as const) : undefined,
        icon: <Inbox size={15} />,
      },
      {
        label: 'Loads raised',
        value: requests.filter((r) => loadedRequestIds.has(r.id)).length,
        icon: <Truck size={15} />,
      },
      { label: 'Requests', value: requests.length },
    ],
    [waiting, requests, loadedRequestIds],
  )

  const openLoadDrawer = (request: DepotTransfer) => {
    setLoadingFrom(request)
    setFormMounted(true)
  }

  const handleReject = (request: DepotTransfer) =>
    run(
      {
        label: 'Rejecting request',
        detail: request.trs_number,
        success: `${request.trs_number} was turned down. Nothing moved.`,
      },
      () => rejectRequest.mutateAsync(request.id),
    )

  // What the table is actually showing, in the order it shows them.
  // DataTable owns the sort, so this is the page's only way to print rows
  // in the order somebody reads them on screen.
  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<DepotTransfer & Record<string, unknown>>[] = [
    {
      key: 'trs_number',
      header: 'Request',
      sortable: true,
      render: (request) => (
        <div className="min-w-0">
          <span className="font-mono text-sm text-[var(--text-primary)]">
            {request.trs_number}
          </span>
          <div className="text-xs text-[var(--text-muted)]">{request.trs_date ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'salesman',
      header: 'Salesman',
      sortable: true,
      render: (request) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">
            {request.salesman?.name ?? 'Unassigned'}
          </div>
          <div className="truncate text-xs text-[var(--text-muted)]">
            from {request.source?.name ?? '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'total_qty',
      header: 'Asked for',
      sortable: true,
      align: 'right',
      render: (request) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
          {formatQty(request.total_qty)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (request) => {
        const pill = transferPill(request)
        return <StatusPill status={pill.status} label={pill.label} />
      },
    },
    ...(canIssue
      ? ([
          {
            key: 'actions',
            header: '',
            // Wide enough for both buttons side by side. `w-1` squeezed the cell
            // to its minimum and the labels had nowhere to go.
            width: 'w-[15rem]',
            render: (request: DepotTransfer) => {
              // Nothing to do on a request that has been turned down, or one whose
              // load already exists — the load is the thing to act on then.
              if (request.status === 'CANCELED' || loadedRequestIds.has(request.id)) {
                return <span className="text-xs text-[var(--text-muted)]">—</span>
              }

              return (
                <div
                  className="flex items-center justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* The row's two answers, at the default size rather than `sm`:
                      this is the screen's whole purpose, and a 32px box could not
                      hold "Create load" beside its icon without clipping it. */}
                  {isPendingRequest(request) && (
                    <Button
                      variant="outline"
                      icon={<X size={15} />}
                      onClick={() => handleReject(request)}
                    >
                      Reject
                    </Button>
                  )}
                  <Button
                    icon={<PackagePlus size={15} />}
                    onClick={() => openLoadDrawer(request)}
                  >
                    Create load
                  </Button>
                </div>
              )
            },
          } as Column<DepotTransfer & Record<string, unknown>>,
        ])
      : []),
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Load requests" subtitle="What the salesmen are asking for" />
        <ErrorState
          title="Couldn't load the requests"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Load requests"
        subtitle="What each salesman has asked the warehouse for, and what became of it."
        actions={
          <ExportPdfButton
            variant="outline"
            disabled={isLoading || isError}
            build={() =>
              depotExportDoc(
                shownRows(),
                requests.length,
                debouncedSearch,
                statusFilter && `Status: ${statusFilter}`,
                'requests',
              )
            }
          />
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by request number, salesman or warehouse…"
        activeCount={statusFilter ? 1 : 0}
        onClearFilters={() => setStatusFilter('')}
        filters={
          <div className="w-48">
            <FilterSelect
              label="Status"
              allLabel="Any"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'waiting', label: 'Waiting', count: waiting.length },
                { value: 'answered', label: 'Answered' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
        }
      />

      <DataTable
        onVisibleRows={onVisibleRows}
        columns={columns}
        data={filtered as (DepotTransfer & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        // Opening a row shows what the salesman asked for — the lines, which this
        // table deliberately does not carry.
        onRowClick={(request) =>
          navigate(`/load-requests/${(request as DepotTransfer).id}`)
        }
        emptyIcon={<Inbox size={30} />}
        emptyMessage={
          search || statusFilter
            ? 'No requests match your filters.'
            : 'No requests yet — they appear here as salesmen ask for stock.'
        }
      />

      {formMounted && (
        <DepotTransferFormDrawer
          open={!!loadingFrom}
          onClose={() => setLoadingFrom(null)}
          fromRequest={loadingFrom}
        />
      )}
    </>
  )
}
