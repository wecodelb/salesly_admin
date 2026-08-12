import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, PenLine, Receipt, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useInvoice } from '../hooks/use-invoices'
import { formatMoney, formatQty, invoicePill, type InvoiceRow } from '../types'

/**
 * One invoice: what the customer took, what they paid, and what they still owe.
 *
 * Read-only, and deliberately so. An invoice exists because goods changed hands
 * and somebody signed for it; offering an edit here would imply the document can
 * be rewritten after the fact, which is the one thing it must not be.
 */
export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const invoiceId = id ? Number(id) : null
  const { data: invoice, isLoading, isError, refetch } = useInvoice(invoiceId)

  const back = (
    <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => navigate('/invoices')}>
      Back
    </Button>
  )

  if (isError) {
    return (
      <>
        <PageHeader title="Invoice" subtitle="What was sold and what is owed" actions={back} />
        <ErrorState
          title="Couldn't open this invoice"
          message="It may have been cancelled, or it belongs to another company. Go back to the list, or retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  const pill = invoice ? invoicePill(invoice) : null

  const stats = [
    { label: 'Billed', value: formatMoney(invoice?.total_price ?? 0) },
    { label: 'Collected', value: formatMoney(invoice?.paid_amount ?? 0) },
    {
      label: 'Still owed',
      value: formatMoney(invoice?.due_amount ?? 0),
      tone: (invoice?.due_amount ?? 0) > 0 ? ('warn' as const) : undefined,
    },
    { label: 'Units', value: formatQty(invoice?.total_qty ?? 0) },
  ]

  const columns: Column<InvoiceRow & Record<string, unknown>>[] = [
    {
      key: 'item_name',
      header: 'Product',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">{row.item_name}</div>
          <div className="font-mono text-xs text-[var(--text-muted)]">{row.item_code}</div>
        </div>
      ),
    },
    {
      key: 'trs_qty',
      header: 'Sold',
      align: 'right',
      // In the packaging it was sold in, with the base quantity underneath: the
      // first is what the customer agreed to, the second is what left the van.
      render: (row) => (
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            {formatQty(row.trs_qty)} {row.uom_name}
          </span>
          {row.qty !== row.trs_qty && (
            <span className="text-xs text-[var(--text-muted)]">
              {formatQty(row.qty)} base
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Unit price',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatMoney(row.price)}
        </span>
      ),
    },
    {
      key: 'line_total',
      header: 'Line total',
      align: 'right',
      // Recomputed from the two figures beside it rather than read off a field,
      // so the arithmetic on screen is visibly the arithmetic of the row.
      render: (row) => (
        <span className="font-mono text-sm font-medium tabular-nums text-[var(--text-primary)]">
          {formatMoney(row.qty * row.price)}
        </span>
      ),
    },
  ]

  const rows = invoice?.rows ?? []

  return (
    <>
      <PageHeader
        title={invoice?.trs_number || (invoice ? `#${invoice.id}` : 'Invoice')}
        subtitle={[
          invoice?.customer,
          invoice?.salesman?.name,
          invoice?.trs_date,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            {invoice?.is_van_sale && (
              <span
                title="Sold straight off the van, with no order behind it"
                className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--accent-primary)]/12 px-2.5 py-1 text-xs font-medium text-[var(--accent-primary)]"
              >
                <Truck size={12} aria-hidden /> Van sale
              </span>
            )}
            {pill && <StatusPill status={pill.status} label={pill.label} />}
            {back}
          </div>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      {/* How it was settled and what proves it. Both facts are stated even when
          absent — "no signature on this document" and "no location was taken" are
          worth knowing, and a row that vanished would read as never having been
          asked for. */}
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Fact label="Paid by" value={invoice?.payment_method || '—'} />
        <Fact
          label="Signature"
          value={invoice?.signature_path ? 'Signed for' : 'Not signed'}
          good={!!invoice?.signature_path}
          icon={<PenLine size={13} />}
        />
        <Fact
          label="Location"
          value={
            invoice?.latitude != null && invoice?.longitude != null
              ? `${invoice.latitude.toFixed(5)}, ${invoice.longitude.toFixed(5)}`
              : 'No fix taken'
          }
          good={invoice?.latitude != null}
          icon={<MapPin size={13} />}
        />
      </section>

      <DataTable
        columns={columns}
        data={rows as (InvoiceRow & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        emptyIcon={<Receipt size={30} />}
        emptyMessage="This invoice has no lines."
      />

      {invoice?.notes && (
        <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          {invoice.notes}
        </p>
      )}
    </>
  )
}

function Fact({
  label,
  value,
  good,
  icon,
}: {
  label: string
  value: string
  good?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div
        className={[
          'mt-1 flex items-center gap-1.5 text-sm font-medium',
          good === false ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]',
        ].join(' ')}
      >
        {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
        {value}
      </div>
    </div>
  )
}
