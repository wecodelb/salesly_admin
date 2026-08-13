import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Send, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useDepotTransfers } from '../hooks/use-my-depot'
import { formatQty, transferPill, type DepotTransfer } from '../types'

/**
 * The loads the warehouse has raised — what actually went out, against what was
 * asked for.
 *
 * A row appears here the moment somebody answers a request in the load-requests
 * screen, and it is the document the salesman signs for. Opening one shows the
 * comparison that matters: what he asked for beside what the warehouse actually
 * put on the vehicle, because those two are rarely identical and the difference is
 * the only thing worth arguing about later.
 */
export function LoadIssuesPage() {
  const navigate = useNavigate()

  const { data: transfers = [], isLoading, isError, refetch } = useDepotTransfers()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const debouncedSearch = useDebounce(search, 250)

  const issues = useMemo(
    () => transfers.filter((t) => t.trs_type === 'LI'),
    [transfers],
  )

  // Which loads have been signed for. Read off the acceptances — an acceptance
  // names the load it answers — rather than the load's own status, so "received"
  // always means a salesman actually signed rather than a flag being set.
  const receivedIds = useMemo(
    () =>
      new Set(
        transfers
          .filter((t) => t.trs_type === 'TRI' && t.src_id)
          .map((t) => t.src_id),
      ),
    [transfers],
  )

  const onTheRoad = useMemo(
    () => issues.filter((i) => i.is_in_transit && !receivedIds.has(i.id)),
    [issues, receivedIds],
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()

    return issues.filter((issue) => {
      const matchesQuery =
        !q ||
        issue.trs_number.toLowerCase().includes(q) ||
        (issue.salesman?.name ?? '').toLowerCase().includes(q) ||
        (issue.destination?.name ?? '').toLowerCase().includes(q)

      const received = receivedIds.has(issue.id) || issue.status === 'COMPLETED'
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'received' ? received : !received)

      return matchesQuery && matchesStatus
    })
  }, [issues, debouncedSearch, statusFilter, receivedIds])

  const stats = useMemo(
    () => [
      {
        label: 'Awaiting signature',
        value: onTheRoad.length,
        tone: onTheRoad.length > 0 ? ('warn' as const) : undefined,
        icon: <Send size={15} />,
      },
      {
        label: 'Received',
        value: issues.filter(
          (i) => receivedIds.has(i.id) || i.status === 'COMPLETED',
        ).length,
        icon: <CheckCircle2 size={15} />,
      },
      { label: 'Loads', value: issues.length, icon: <Truck size={15} /> },
    ],
    [onTheRoad, issues, receivedIds],
  )

  const columns: Column<DepotTransfer & Record<string, unknown>>[] = [
    {
      key: 'trs_number',
      header: 'Load',
      sortable: true,
      render: (issue) => (
        <div className="min-w-0">
          <span className="font-mono text-sm text-[var(--text-primary)]">
            {issue.trs_number}
          </span>
          <div className="text-xs text-[var(--text-muted)]">{issue.trs_date ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'salesman',
      header: 'To',
      sortable: true,
      render: (issue) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">
            {issue.salesman?.name ?? issue.destination?.name ?? '—'}
          </div>
          <div className="truncate text-xs text-[var(--text-muted)]">
            from {issue.source?.name ?? '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'src_id',
      header: 'Against',
      // Which request this answers, so the two screens read as one chain rather
      // than two lists that happen to share names.
      render: (issue) =>
        issue.source_document?.trs_number ? (
          <span className="font-mono text-xs text-[var(--text-secondary)]">
            {issue.source_document.trs_number}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">Raised directly</span>
        ),
    },
    {
      key: 'total_qty',
      header: 'Issued',
      sortable: true,
      align: 'right',
      render: (issue) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
          {formatQty(issue.total_qty)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (issue) => {
        // An acceptance exists, so it is in his depot whatever the load's own
        // status column still says.
        if (receivedIds.has(issue.id)) {
          return <StatusPill status="success" label="Received" />
        }
        const pill = transferPill(issue)
        return <StatusPill status={pill.status} label={pill.label} />
      },
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Load issues" subtitle="What the warehouse has sent out" />
        <ErrorState
          title="Couldn't load the issues"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Load issues"
        subtitle="Every load the warehouse raised — what went out, and whether the salesman has signed for it."
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by load number, salesman or warehouse…"
        activeCount={statusFilter ? 1 : 0}
        onClearFilters={() => setStatusFilter('')}
        filters={
          <div className="w-52">
            <FilterSelect
              label="Status"
              allLabel="Any"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'open', label: 'Not received', count: onTheRoad.length },
                { value: 'received', label: 'Received' },
              ]}
            />
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={filtered as (DepotTransfer & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(issue) => navigate(`/load-issues/${(issue as DepotTransfer).id}`)}
        emptyIcon={<Truck size={30} />}
        emptyMessage={
          search || statusFilter
            ? 'No loads match your filters.'
            : 'No loads raised yet — answer a request to create one.'
        }
      />
    </>
  )
}
