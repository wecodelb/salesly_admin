import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useAuthStore } from '@/core/auth/auth-store'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { Button } from '@/shared/components/Button'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton/LoadingSkeleton'
import { useCustomers } from '@/features/customers/hooks/use-customers'
import { useProducts } from '@/features/products/hooks/use-products'
import { useInvoices } from '@/features/invoices/hooks/use-invoices'
import { ReportDocument } from '../components/ReportDocument'
import { buildReport, REPORTS } from '../build-reports'
import { FAMILY_LABELS, type ReportFamily } from '../report-types'
import '../report-print.css'

/**
 * Reports, and the PDF they turn into.
 *
 * Every report is composed from the same reads the screens use rather than
 * from endpoints of its own, so a figure here can never disagree with the
 * figure on the page it was run from.
 *
 * Export is the browser's own print-to-PDF rather than a generated file. That
 * is a deliberate trade: it costs one extra click, and it buys real vector text
 * somebody can search and copy, table headings that repeat on every page, and a
 * document that looks like the console rather than a second layout maintained
 * separately and drifting from it.
 */
export function ReportsPage() {
  const [reportId, setReportId] = useState(REPORTS[0].id)
  const [breakdown, setBreakdown] = useState(REPORTS[0].breakdowns[0].value)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const report = REPORTS.find((r) => r.id === reportId) ?? REPORTS[0]

  // The distributor's name, not the app's. Falls back only for a session that
  // predates the login storing it.
  const company = useAuthStore((s) => s.user?.company)

  const customers = useCustomers()
  const products = useProducts()
  // The whole book: a report has to total what it is showing, and a page of
  // invoices summed from page one would be a number that looks right.
  const invoices = useInvoices({ perPage: 500 })

  const loading = customers.isLoading || products.isLoading || invoices.isLoading
  const failed = customers.isError || products.isError || invoices.isError

  const doc = useMemo(
    () =>
      buildReport({
        reportId: report.id,
        breakdown,
        from,
        to,
        customers: customers.data ?? [],
        products: products.data ?? [],
        invoices: invoices.data?.invoices ?? [],
      }),
    [report.id, breakdown, from, to, customers.data, products.data, invoices.data],
  )

  const pick = (id: string) => {
    const next = REPORTS.find((r) => r.id === id)
    if (!next) return
    setReportId(id)
    // Reset rather than carry: "by category" means nothing on a customer list,
    // and a stale breakdown silently produces a flat one.
    setBreakdown(next.breakdowns[0].value)
  }

  const families = [...new Set(REPORTS.map((r) => r.family))] as ReportFamily[]

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Run a report, then print or save it as PDF"
        actions={
          <Button
            icon={<Printer size={16} />}
            onClick={() => window.print()}
            disabled={loading || failed}
          >
            Export PDF
          </Button>
        }
      />

      {/* Controls. Hidden on paper — see report-print.css, which hides
          everything that is not the document itself. */}
      <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap gap-4">
          {families.map((family) => (
            <div key={family} className="min-w-[190px] flex-1">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {FAMILY_LABELS[family]}
              </p>
              <div className="flex flex-col gap-1">
                {REPORTS.filter((r) => r.family === family).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => pick(r.id)}
                    className={[
                      'rounded-lg border px-3 py-2 text-left transition',
                      r.id === report.id
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'border-[var(--border-default)] hover:bg-[var(--bg-hover)]',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-semibold text-[var(--text-primary)]">
                      {r.name}
                    </span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {r.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4 border-t border-[var(--border-default)] pt-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Break down</span>
            <select
              value={breakdown}
              onChange={(e) => setBreakdown(e.target.value)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {report.breakdowns.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          {/* Only where a date narrows anything. A catalog is what it is today;
              offering a range would imply a history it does not keep. */}
          {report.dated && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>
              {(from || to) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFrom('')
                    setTo('')
                  }}
                >
                  Clear dates
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {failed ? (
        <ErrorState
          title="Couldn't build the report"
          message="One of the reads behind it failed. Try again in a moment."
          onRetry={() => {
            customers.refetch()
            products.refetch()
            invoices.refetch()
          }}
        />
      ) : loading ? (
        <LoadingSkeleton />
      ) : (
        <ReportDocument doc={doc} companyName={company || 'Salesly'} generatedAt={new Date()} />
      )}
    </>
  )
}
