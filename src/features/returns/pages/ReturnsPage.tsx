import { useMemo, useState } from 'react'
import { AlertTriangle, PackageCheck, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { returnsExportDoc } from '../returns-export'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useReturns } from '../hooks/use-returns'
import { ReturnDetailDrawer } from '../components/ReturnDetailDrawer'
import {
  formatMoney,
  formatQty,
  owesRefund,
  returnPill,
  totalsOf,
  type SalesReturn,
} from '../types'

/**
 * Goods customers have handed back.
 *
 * A record rather than a queue. A return is taken at the counter with the shop
 * standing there and the crates already in the salesman's hands, so there is
 * nothing here for the office to approve — which is why this screen has no
 * action buttons and no sidebar badge.
 *
 * What it is for is the two questions the office actually asks: what came back
 * off which round, and whether anybody is owed money for it. The second is the
 * one that matters, and it has its own column and its own figure in the strip,
 * because a shop that returned goods it had already paid for is owed a refund
 * nobody will chase if it is netted into a credit total.
 */
export function ReturnsPage() {
  const { data, isLoading, isError, refetch } = useReturns()
  const returns = useMemo(() => data?.returns ?? [], [data])
  const truncated = data?.truncated ?? false

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [opened, setOpened] = useState<SalesReturn | null>(null)

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()

    return returns.filter((document) => {
      const matchesQuery =
        !q ||
        String(document.trs_number).includes(q) ||
        (document.customer?.name ?? '').toLowerCase().includes(q) ||
        (document.salesman?.name ?? '').toLowerCase().includes(q)

      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'owing' ? owesRefund(document) : !owesRefund(document))

      return matchesQuery && matchesStatus
    })
  }, [returns, debouncedSearch, statusFilter])

  const totals = useMemo(() => totalsOf(returns), [returns])
  const owingCount = useMemo(() => returns.filter(owesRefund).length, [returns])

  const stats = useMemo(
    () => [
      { label: 'Returns', value: totals.count, icon: <RotateCcw size={15} /> },
      { label: 'Units back', value: formatQty(totals.units) },
      {
        label: 'Credited',
        value: formatMoney(totals.credited),
        icon: <PackageCheck size={15} />,
      },
      {
        // The one figure on this screen anybody has to act on.
        label: 'Refunds owing',
        value: formatMoney(totals.owed),
        tone: totals.owed > 0 ? ('warn' as const) : ('muted' as const),
        icon: totals.owed > 0 ? <AlertTriangle size={15} /> : undefined,
      },
    ],
    [totals],
  )

  // What the table is actually showing, in the order it shows them. DataTable
  // owns the sort, so this is the page's only honest source for the print.
  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<SalesReturn & Record<string, unknown>>[] = [
    {
      key: 'trs_number',
      header: 'Return',
      sortable: true,
      render: (document) => (
        <div className="min-w-0">
          <span className="font-mono text-sm text-[var(--text-primary)]">
            #{document.trs_number}
          </span>
          <div className="text-xs text-[var(--text-muted)]">{document.trs_date ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      render: (document) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">
            {document.customer?.name ?? '—'}
          </div>
          <div className="truncate text-xs text-[var(--text-muted)]">
            {document.salesman?.name ?? 'Unassigned'}
          </div>
        </div>
      ),
    },
    {
      key: 'total_qty',
      header: 'Units',
      sortable: true,
      align: 'right',
      render: (document) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
          {formatQty(document.total_qty)}
        </span>
      ),
    },
    {
      key: 'credit_applied',
      header: 'Credited',
      sortable: true,
      align: 'right',
      render: (document) => (
        <span className="font-mono text-sm tabular-nums text-[var(--accent-green)]">
          {formatMoney(document.credit_applied)}
        </span>
      ),
    },
    {
      key: 'credit_excess',
      header: 'Refund owing',
      sortable: true,
      align: 'right',
      // Its own column rather than a footnote on the credit: the shop paid for
      // these goods and has handed them back, so somebody owes them money.
      render: (document) =>
        owesRefund(document) ? (
          <span className="font-mono text-sm font-medium tabular-nums text-[var(--accent-amber)]">
            {formatMoney(document.credit_excess)}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (document) => {
        const pill = returnPill(document)
        return <StatusPill status={pill.status} label={pill.label} />
      },
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Sales returns" subtitle="Goods customers have handed back" />
        <ErrorState
          title="Couldn't load the returns"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Sales returns"
        subtitle="Goods handed back at the counter, and the credit that went with them."
        actions={
          <ExportPdfButton
            variant="outline"
            disabled={isLoading || isError}
            build={() =>
              returnsExportDoc(
                shownRows(),
                returns.length,
                debouncedSearch,
                statusFilter && `Status: ${statusFilter}`,
              )
            }
          />
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      {truncated && (
        <p className="mb-3 rounded-[var(--radius-card)] bg-[var(--accent-amber)]/10 px-3.5 py-2.5 text-sm text-[var(--accent-amber)]">
          Showing the most recent returns only — narrow the search to see the rest. The
          totals above cover what is on screen.
        </p>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by return number, customer or salesman…"
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
                { value: 'owing', label: 'Refund owing', count: owingCount },
                { value: 'credited', label: 'Credited in full' },
              ]}
            />
          </div>
        }
      />

      <DataTable
        onVisibleRows={onVisibleRows}
        columns={columns}
        data={filtered as (SalesReturn & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        // Opening a row shows what came back — the lines, which this table
        // deliberately does not carry.
        onRowClick={(document) => setOpened(document as SalesReturn)}
        emptyIcon={<RotateCcw size={30} />}
        emptyMessage={
          search || statusFilter
            ? 'No returns match your filters.'
            : 'Nothing returned yet — returns appear here as salesmen take them at the counter.'
        }
      />

      <ReturnDetailDrawer document={opened} onClose={() => setOpened(null)} />
    </>
  )
}
