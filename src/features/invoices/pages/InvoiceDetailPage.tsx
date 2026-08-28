import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, PenLine, Printer } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useAuthStore } from '@/core/auth/auth-store'
import { InvoiceCard } from '../components/InvoiceCard'
import { useInvoice } from '../hooks/use-invoices'
import {
  formatMoney,
  formatQty,
  invoicePill,
  paymentMethodLabel,
} from '../types'

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
  // The distributor's name on the printed copy, not the app's.
  const company = useAuthStore((state) => state.user?.company)

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
            {pill && <StatusPill status={pill.status} label={pill.label} />}
            {/* The card below is already the only `.report-doc` on the page, and
                the print rules hide everything that is not one — so this needs
                no hidden second copy, only the browser's own dialog. */}
            <Button
              variant="outline"
              icon={<Printer size={16} />}
              onClick={() => window.print()}
              disabled={isLoading || isError || !invoice}
            >
              Print invoice
            </Button>
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
        <Fact label="Paid by" value={paymentMethodLabel(invoice?.payment_method)} />
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

      {/* The customer's copy. Everything above it is the console's own view
          of the sale — was it signed, where was the van — and everything in
          it is what the customer was handed at the counter. */}
      {invoice && (
        <InvoiceCard invoice={invoice} companyName={company || 'Salesly'} />
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
