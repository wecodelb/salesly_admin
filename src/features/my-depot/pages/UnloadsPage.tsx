import { useMemo, useState } from 'react'
import { PackageCheck, Undo2, X } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { unloadsExportDoc } from '../unloads-export'
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
import { ApproveUnloadDrawer } from '../components/ApproveUnloadDrawer'
import { useRejectUnload, useUnloads } from '../hooks/use-my-depot'
import { formatQty, isPendingUnload, unloadPill, type DepotTransfer } from '../types'

/**
 * What the salesmen are sending back.
 *
 * The other end of the day from Load Requests. He fills his depot in the
 * morning, works the round, and at night sends back what did not sell — and
 * until somebody here answers, none of it has moved: the goods are set aside
 * on his van, still counted as his and no longer sellable.
 *
 * That waiting is the whole reason this screen exists. An unload nobody
 * answers is stock frozen on a van, which is why the pending count is on the
 * sidebar rather than only here.
 *
 * The queue and the history in one table, like the requests screen beside it:
 * an unload waiting and one taken back on Tuesday are the same document at two
 * points in its life.
 */
export function UnloadsPage() {
  const { can } = usePermissions()
  const canIssue = can(PERMISSIONS.DEPOT_ISSUE)
  const { run } = useActionProgress()

  const { data: unloads = [], isLoading, isError, refetch } = useUnloads()
  const rejectUnload = useRejectUnload()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [answering, setAnswering] = useState<DepotTransfer | null>(null)
  const [drawerMounted, setDrawerMounted] = useState(false)

  const debouncedSearch = useDebounce(search, 250)

  const waiting = useMemo(() => unloads.filter(isPendingUnload), [unloads])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()

    return unloads.filter((unload) => {
      const matchesQuery =
        !q ||
        unload.trs_number.toLowerCase().includes(q) ||
        (unload.salesman?.name ?? '').toLowerCase().includes(q) ||
        (unload.source?.name ?? '').toLowerCase().includes(q)

      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'waiting'
          ? isPendingUnload(unload)
          : statusFilter === 'taken'
            ? unload.status === 'COMPLETED' || unload.status === 'CONFIRMED'
            : unload.status === 'CANCELED')

      return matchesQuery && matchesStatus
    })
  }, [unloads, debouncedSearch, statusFilter])

  const stats = useMemo(
    () => [
      {
        label: 'Waiting on you',
        value: waiting.length,
        tone: waiting.length > 0 ? ('warn' as const) : undefined,
        icon: <Undo2 size={15} />,
      },
      {
        label: 'Taken back',
        value: unloads.filter((u) => u.status === 'COMPLETED').length,
        icon: <PackageCheck size={15} />,
      },
      {
        // What is frozen: units sitting on vans that nobody can sell and the
        // warehouse has not got either.
        label: 'Units held on vans',
        value: formatQty(waiting.reduce((sum, u) => sum + (u.total_qty ?? 0), 0)),
        tone: waiting.length > 0 ? ('warn' as const) : ('muted' as const),
      },
      { label: 'Unloads', value: unloads.length },
    ],
    [waiting, unloads],
  )

  const openDrawer = (unload: DepotTransfer) => {
    setAnswering(unload)
    setDrawerMounted(true)
  }

  const handleReject = (unload: DepotTransfer) =>
    run(
      {
        label: 'Refusing the unload',
        detail: unload.trs_number,
        success: `${unload.trs_number} was refused — the stock stays on the van.`,
      },
      () => rejectUnload.mutateAsync(unload.id),
    )

  // What the table is actually showing, in the order it shows them. DataTable
  // owns the sort, so this is the page's only honest source for the printed page.
  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<DepotTransfer & Record<string, unknown>>[] = [
    {
      key: 'trs_number',
      header: 'Unload',
      sortable: true,
      render: (unload) => (
        <div className="min-w-0">
          <span className="font-mono text-sm text-[var(--text-primary)]">{unload.trs_number}</span>
          <div className="text-xs text-[var(--text-muted)]">{unload.trs_date ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'salesman',
      header: 'Salesman',
      sortable: true,
      render: (unload) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">
            {unload.salesman?.name ?? 'Unassigned'}
          </div>
          <div className="truncate text-xs text-[var(--text-muted)]">
            from {unload.source?.name ?? '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'total_qty',
      header: 'Sending back',
      sortable: true,
      align: 'right',
      render: (unload) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
          {formatQty(unload.total_qty)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (unload) => {
        const pill = unloadPill(unload)
        return <StatusPill status={pill.status} label={pill.label} />
      },
    },
    ...(canIssue
      ? ([
          {
            key: 'actions',
            header: '',
            width: 'w-[15rem]',
            render: (unload: DepotTransfer) => {
              // Only a waiting unload has anything to answer. One already taken
              // back or refused is history.
              if (!isPendingUnload(unload)) {
                return <span className="text-xs text-[var(--text-muted)]">—</span>
              }

              return (
                <div
                  className="flex items-center justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    icon={<X size={15} />}
                    onClick={() => handleReject(unload)}
                  >
                    Refuse
                  </Button>
                  <Button icon={<PackageCheck size={15} />} onClick={() => openDrawer(unload)}>
                    Take back
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
        <PageHeader title="Unloads" subtitle="What the salesmen are sending back" />
        <ErrorState
          title="Couldn't load the unloads"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Unloads"
        subtitle="Stock coming back off the vans. Nothing moves until you take it back."
        actions={
          <ExportPdfButton
            variant="outline"
            disabled={isLoading || isError}
            build={() =>
              unloadsExportDoc(
                shownRows(),
                unloads.length,
                debouncedSearch,
                statusFilter && `Status: ${statusFilter}`,
              )
            }
          />
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by unload number, salesman or depot…"
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
                { value: 'taken', label: 'Taken back' },
                { value: 'refused', label: 'Refused' },
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
        // The row opens what he is sending, which this table deliberately does
        // not carry — and for a waiting one that is also where it is answered.
        onRowClick={canIssue ? (unload) => openDrawer(unload as DepotTransfer) : undefined}
        emptyIcon={<Undo2 size={30} />}
        emptyMessage={
          search || statusFilter
            ? 'No unloads match your filters.'
            : 'Nothing coming back yet — unloads appear here as salesmen send stock in.'
        }
      />

      {drawerMounted && (
        <ApproveUnloadDrawer unload={answering} onClose={() => setAnswering(null)} />
      )}
    </>
  )
}
