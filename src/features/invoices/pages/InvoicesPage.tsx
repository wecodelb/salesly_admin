import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Coins, FileText, Receipt, Truck, Wallet } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useCustomers, useSalesmen } from '@/features/customers/hooks/use-customers'
import { useInvoices } from '../hooks/use-invoices'
import {
  formatMoney,
  formatQty,
  invoicePill,
  isSettled,
  totalsOf,
  type Invoice,
} from '../types'

/**
 * Every invoice the company has raised, and what has been collected against them.
 *
 * The strip leads with what is still owed rather than what was billed. Billed is
 * history and nobody acts on it; outstanding is a list of customers somebody has
 * to go and see, and it is the only figure here that can still be changed.
 *
 * Customer and salesman are filtered server-side and the whole filtered set is
 * read, because the strip has to total what the reader is looking at — figures
 * folded over one page of fifty would describe a page rather than the book.
 */
export function InvoicesPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [salesmanId, setSalesmanId] = useState('')
  const [settlement, setSettlement] = useState('')

  const debouncedSearch = useDebounce(search, 250)

  const { data: customers = [] } = useCustomers()
  const { data: salesmen = [] } = useSalesmen()

  const { data, isLoading, isError, refetch } = useInvoices({
    customerId: customerId ? Number(customerId) : null,
    salesmanId: salesmanId ? Number(salesmanId) : null,
  })

  const invoices = data?.invoices ?? []
  const truncated = data?.truncated ?? false

  // Search and settlement are applied here rather than sent: the endpoint has no
  // text search, and settlement is derived from two figures it does not filter on.
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()

    return invoices.filter((invoice) => {
      const matchesQuery =
        !q ||
        invoice.trs_number.toLowerCase().includes(q) ||
        invoice.customer.toLowerCase().includes(q) ||
        (invoice.salesman?.name ?? '').toLowerCase().includes(q)

      const matchesSettlement =
        !settlement ||
        (settlement === 'paid' ? isSettled(invoice) : !isSettled(invoice))

      return matchesQuery && matchesSettlement
    })
  }, [invoices, debouncedSearch, settlement])

  // Totalled over what the table is showing, so the strip and the rows beneath it
  // always describe the same set.
  const totals = useMemo(() => totalsOf(filtered), [filtered])

  const stats = useMemo(
    () => [
      {
        label: 'Still owed',
        value: formatMoney(totals.outstanding),
        tone: totals.outstanding > 0 ? ('warn' as const) : undefined,
        icon: <Wallet size={15} />,
      },
      { label: 'Collected', value: formatMoney(totals.collected), icon: <Coins size={15} /> },
      { label: 'Billed', value: formatMoney(totals.billed), icon: <Receipt size={15} /> },
      {
        label: 'Unsettled',
        value: totals.unpaidCount,
        tone: totals.unpaidCount > 0 ? ('warn' as const) : undefined,
        icon: <FileText size={15} />,
      },
    ],
    [totals],
  )

  const activeFilters =
    (customerId ? 1 : 0) + (salesmanId ? 1 : 0) + (settlement ? 1 : 0)

  const columns: Column<Invoice & Record<string, unknown>>[] = [
    {
      key: 'trs_number',
      header: 'Invoice',
      sortable: true,
      render: (invoice) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-[var(--text-primary)]">
              {invoice.trs_number || `#${invoice.id}`}
            </span>
            {/* Only on a van sale. An invoice off an order is the ordinary case
                and does not need a badge saying so. */}
            {invoice.is_van_sale && (
              <span
                title="Sold straight off the van, with no order behind it"
                className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--accent-primary)]/12 px-2 py-0.5 text-xs font-medium text-[var(--accent-primary)]"
              >
                <Truck size={11} aria-hidden /> Van
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--text-muted)]">{invoice.trs_date ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      render: (invoice) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">
            {invoice.customer || '—'}
          </div>
          <div className="truncate text-xs text-[var(--text-muted)]">
            {invoice.salesman?.name ?? 'Unassigned'}
          </div>
        </div>
      ),
    },
    {
      key: 'total_qty',
      header: 'Units',
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatQty(invoice.total_qty)}
        </span>
      ),
    },
    {
      key: 'total_price',
      header: 'Billed',
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
          {formatMoney(invoice.total_price)}
        </span>
      ),
    },
    {
      key: 'paid_amount',
      header: 'Collected',
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatMoney(invoice.paid_amount)}
        </span>
      ),
    },
    {
      key: 'due_amount',
      header: 'Still owed',
      sortable: true,
      align: 'right',
      // The loudest column on the row: it is the only figure here anybody can
      // still do something about.
      render: (invoice) => (
        <span
          className={[
            'font-mono text-sm font-medium tabular-nums',
            invoice.due_amount > 0
              ? 'text-[var(--accent-amber)]'
              : 'text-[var(--text-muted)]',
          ].join(' ')}
        >
          {invoice.due_amount > 0 ? formatMoney(invoice.due_amount) : '—'}
        </span>
      ),
    },
    {
      key: 'settlement',
      header: '',
      render: (invoice) => {
        const pill = invoicePill(invoice)
        return <StatusPill status={pill.status} label={pill.label} />
      },
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Invoices" subtitle="What was sold, and what has been collected" />
        <ErrorState
          title="Couldn't load invoices"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Every invoice raised — off an order, or straight off a van — with what has been collected against each."
      />

      <StatStrip stats={stats} loading={isLoading} />

      {/* Said out loud rather than left to be discovered. The totals above are
          folded over what was actually read, so a capped read means they describe
          part of the book and somebody reconciling a month would be out. */}
      {truncated && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/8 px-4 py-3">
          <AlertTriangle size={15} aria-hidden className="mt-0.5 text-[var(--accent-amber)]" />
          <p className="text-xs text-[var(--text-secondary)]">
            Only the most recent invoices were loaded, so the totals above cover
            part of the period. Narrow by customer or salesman for exact figures.
          </p>
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by invoice number, customer or salesman…"
        activeCount={activeFilters}
        onClearFilters={() => {
          setCustomerId('')
          setSalesmanId('')
          setSettlement('')
        }}
        filters={
          <div className="flex flex-wrap gap-3">
            <div className="w-56">
              <FilterSelect
                label="Customer"
                allLabel="All customers"
                value={customerId}
                onChange={setCustomerId}
                searchPlaceholder="Search customers…"
                options={customers.map((customer) => ({
                  value: String(customer.id),
                  label: customer.name,
                }))}
              />
            </div>
            <div className="w-52">
              <FilterSelect
                label="Salesman"
                allLabel="All salesmen"
                icon={<Truck size={14} />}
                value={salesmanId}
                onChange={setSalesmanId}
                searchPlaceholder="Search salesmen…"
                options={salesmen.map((salesman) => ({
                  value: String(salesman.id),
                  label: salesman.name,
                }))}
              />
            </div>
            <div className="w-44">
              <FilterSelect
                label="Settlement"
                allLabel="Any"
                value={settlement}
                onChange={setSettlement}
                options={[
                  { value: 'unpaid', label: 'Still owed' },
                  { value: 'paid', label: 'Paid' },
                ]}
              />
            </div>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={filtered as (Invoice & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(invoice) => navigate(`/invoices/${(invoice as Invoice).id}`)}
        emptyIcon={<Receipt size={30} />}
        emptyMessage={
          activeFilters || search
            ? 'No invoices match your filters.'
            : 'No invoices yet — they appear here as salesmen sell.'
        }
      />
    </>
  )
}
