import { useMemo, useState } from 'react'
import { AlertTriangle, Banknote, Coins, Receipt, Store, Users, Wallet } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useCustomers, useSalesmen } from '@/features/customers/hooks/use-customers'
import { parseApiDate } from '@/features/reports/report-format'
import { collectionsExportDoc } from '../collections-export'
import { useCollections } from '../hooks/use-collections'
import {
  describeMethod,
  describeTender,
  formatMoney,
  isMixed,
  allocationsOf,
  tendersOf,
  totalsOf,
  type Collection,
} from '../types'

/** The methods the collect screen offers, for the filter. */
const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'whish', label: 'Whish' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'transfer', label: 'Transfer' },
]

/**
 * Every collection the company has taken.
 *
 * The strip leads with what came in rather than how many receipts wrote it:
 * the money is the thing anybody opens this screen to reconcile, and the count
 * only qualifies it.
 *
 * Both ways money arrives are here: taken against a customer's whole balance,
 * or against one invoice. The second used to write no receipt at all, so this
 * screen would have been short by however much was collected that way — a total
 * silently wrong is the kind of figure somebody acts on and then cannot account
 * for. The Against column is what tells them apart.
 */
export function CollectionsPage() {
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [salesmanId, setSalesmanId] = useState('')
  const [method, setMethod] = useState('')
  const [source, setSource] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const debouncedSearch = useDebounce(search, 250)

  const { data: customers = [] } = useCustomers()
  const { data: salesmen = [] } = useSalesmen()

  const { data, isLoading, isError, refetch } = useCollections({
    customerId: customerId ? Number(customerId) : null,
    salesmanId: salesmanId ? Number(salesmanId) : null,
    paymentMethod: method || null,
    source: source || null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  })

  const collections = data?.collections ?? []
  const truncated = data?.truncated ?? false

  // Search is applied here rather than sent as well: the endpoint does search,
  // but re-sending on every keystroke would refetch the whole book to narrow a
  // list already in hand.
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return collections

    return collections.filter(
      (c) =>
        c.trs_number.toLowerCase().includes(q) ||
        c.customer.toLowerCase().includes(q) ||
        (c.salesman?.name ?? '').toLowerCase().includes(q),
    )
  }, [collections, debouncedSearch])

  // Totalled over what the table is showing, so the strip and the rows beneath
  // it always describe the same set.
  const totals = useMemo(() => totalsOf(filtered), [filtered])

  const stats = useMemo(
    () => [
      { label: 'Collected', value: formatMoney(totals.collected), icon: <Coins size={15} /> },
      { label: 'Receipts', value: totals.count, icon: <Banknote size={15} /> },
      { label: 'Customers', value: totals.customers, icon: <Store size={15} /> },
      { label: 'Mixed tender', value: totals.mixed, icon: <Wallet size={15} /> },
      { label: 'Against invoice', value: totals.againstInvoice, icon: <Receipt size={15} /> },
    ],
    [totals],
  )

  const activeFilters =
    (customerId ? 1 : 0) +
    (salesmanId ? 1 : 0) +
    (method ? 1 : 0) +
    (source ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  // Said in words on the printed page, where the filter bar is not there to be
  // looked at.
  const exportFilters = useMemo(
    () => [
      debouncedSearch.trim() && `Search “${debouncedSearch.trim()}”`,
      customerId &&
        `Customer: ${customers.find((c) => String(c.id) === customerId)?.name ?? customerId}`,
      salesmanId &&
        `Salesman: ${salesmen.find((s) => String(s.id) === salesmanId)?.name ?? salesmanId}`,
      method && `Method: ${METHODS.find((m) => m.value === method)?.label ?? method}`,
      source && (source === 'invoice' ? 'Against one invoice' : 'Against a balance'),
      dateFrom && `From ${dateFrom}`,
      dateTo && `To ${dateTo}`,
      truncated && 'Partial read — most recent receipts only',
    ],
    [debouncedSearch, customerId, salesmanId, method, source, dateFrom, dateTo, truncated, customers, salesmen],
  )

  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<Collection & Record<string, unknown>>[] = [
    {
      key: 'trs_number',
      header: 'Receipt',
      sortable: true,
      render: (c) => (
        <div className="min-w-0">
          <span className="font-mono text-sm text-[var(--text-primary)]">
            {c.trs_number || `#${c.id}`}
          </span>
          <div className="text-xs text-[var(--text-muted)]">{c.trs_date ?? '—'}</div>
        </div>
      ),
      // `d/m/Y H:i` compared as text puts the 3rd of November before the 2nd of
      // January, so the column sorts on a real date.
      sortValue: (c) => parseApiDate(c.trs_date)?.getTime() ?? 0,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      render: (c) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">{c.customer || '—'}</div>
          <div className="truncate text-xs text-[var(--text-muted)]">
            {c.salesman?.name ?? 'Unassigned'}
          </div>
        </div>
      ),
    },
    {
      key: 'payment_method',
      header: 'How',
      // Not sortable: what it says for a mixed receipt is a sentence, and
      // sorting shops by the alphabet of their tender mix means nothing.
      render: (c) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[var(--text-secondary)]">{describeMethod(c)}</span>
            {isMixed(c) && <StatusPill status="pending" label="Mixed" />}
          </div>
          {/* What the customer actually held — 500,000 LBP, not its dollar
              worth — because that is what gets counted against the tin. */}
          {tendersOf(c).length > 0 && (
            <div className="truncate text-xs text-[var(--text-muted)]">
              {tendersOf(c).map(describeTender).join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Against',
      sortable: true,
      render: (c) => (
        <span className="text-sm text-[var(--text-secondary)]">
          {c.source === 'invoice' ? 'One invoice' : 'Balance'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Collected',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-sm font-medium tabular-nums text-[var(--accent-green)]">
          {formatMoney(c.amount)}
        </span>
      ),
    },
    {
      key: 'balance_after',
      header: 'Balance after',
      sortable: true,
      align: 'right',
      // What the shop still owed when the salesman walked out.
      render: (c) => (
        <span
          className={[
            'font-mono text-sm tabular-nums',
            (c.balance_after ?? 0) > 0
              ? 'text-[var(--accent-amber)]'
              : 'text-[var(--text-muted)]',
          ].join(' ')}
        >
          {formatMoney(c.balance_after)}
        </span>
      ),
    },
    {
      key: 'allocations',
      header: 'Settled',
      align: 'right',
      render: (c) => (
        <span className="text-sm text-[var(--text-secondary)]">
          {allocationsOf(c).length === 0
            ? '—'
            : `${allocationsOf(c).length} ${allocationsOf(c).length === 1 ? 'invoice' : 'invoices'}`}
        </span>
      ),
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Collections" subtitle="Money taken against what customers owe" />
        <ErrorState
          title="Couldn't load collections"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle="Money taken against what customers owe, and where it landed"
        actions={
          <ExportPdfButton
            variant="outline"
            disabled={isLoading || isError}
            build={() => collectionsExportDoc(shownRows(), collections.length, exportFilters)}
          />
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      {truncated && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/8 px-4 py-3">
          <AlertTriangle size={15} aria-hidden className="mt-0.5 text-[var(--accent-amber)]" />
          <p className="text-xs text-[var(--text-secondary)]">
            Only the most recent receipts were loaded, so the totals above cover
            part of the period. Narrow by date or salesman for exact figures.
          </p>
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by receipt number, customer or salesman…"
        activeCount={activeFilters}
        onClearFilters={() => {
          setCustomerId('')
          setSalesmanId('')
          setMethod('')
          setSource('')
          setDateFrom('')
          setDateTo('')
        }}
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <FilterSelect
                label="Customer"
                allLabel="All customers"
                icon={<Store size={14} />}
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
                icon={<Users size={14} />}
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
                label="Method"
                allLabel="All methods"
                icon={<Wallet size={14} />}
                value={method}
                onChange={setMethod}
                options={METHODS}
              />
            </div>
            <div className="w-44">
              <FilterSelect
                label="Against"
                allLabel="Balance & invoice"
                icon={<Receipt size={14} />}
                value={source}
                onChange={setSource}
                options={[
                  { value: 'balance', label: 'A balance' },
                  { value: 'invoice', label: 'One invoice' },
                ]}
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
        data={filtered as (Collection & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        emptyIcon={<Banknote size={28} />}
        emptyMessage={
          activeFilters > 0 || debouncedSearch
            ? 'No collections match these filters.'
            : 'No collections yet — they appear here as salesmen take money against a balance.'
        }
      />
    </>
  )
}
