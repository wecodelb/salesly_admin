import {
  describeTender,
  formatMoney,
  formatQty,
  paymentMethodLabel,
  type Invoice,
} from '../types'
import '@/features/reports/report-print.css'

interface Props {
  invoice: Invoice
  /** The distributor's name, not the app's. */
  companyName: string
  /** Extra classes on the root — `is-print-only` to carry it without showing it. */
  className?: string
}

/**
 * The invoice, as the customer's copy.
 *
 * The console's other view of an invoice answers operational questions — was it
 * signed, where was the van, how does this reconcile. This answers the only
 * question the customer has: what did I buy and what do I still owe. It is the
 * same document the salesman's phone prints, so a copy sent from the office and
 * a copy handed over at the counter are the same piece of paper rather than two
 * accounts of one sale.
 *
 * Built on `.report-doc`, so the print rules that hide the console, repeat the
 * column headings across pages and never split a row are the ones the reports
 * already use — not a second set that drifts from them.
 */
export function InvoiceCard({ invoice, companyName, className }: Props) {
  /**
   * Money, with the currency on it.
   *
   * The console's formatter leaves the symbol off, which is right in a table
   * whose heading already says "Billed" in dollars. It is wrong on a document
   * that leaves the building: a customer holding a page of bare figures cannot
   * tell dollars from lira, and the difference is a factor of ninety thousand.
   */
  const money = (value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value)) return '—'
    const code = (invoice.currency ?? 'USD').toUpperCase()
    const figure = formatMoney(value)

    return code === 'USD' ? `$${figure}` : `${figure} ${code}`
  }

  const rows = invoice.rows ?? []
  const tenders = invoice.payments ?? []
  const due = invoice.due_amount ?? 0
  const settled = due <= 0

  // Spelled out only when the money changed hands in something other than the
  // document's own currency. An invoice showing just the converted total is one
  // the customer cannot check against his own pocket.
  const showTenders = tenders.length > 1 || tenders.some((t) => t.exchange_rate != null)

  return (
    <article className={className ? `report-doc ${className}` : 'report-doc'}>
      <header className="report-masthead">
        <div>
          <p className="report-company">{companyName}</p>
          <h1 className="report-title">Invoice {invoice.trs_number || `#${invoice.id}`}</h1>
          {invoice.trs_date && <p className="report-subtitle">{invoice.trs_date}</p>}
        </div>
        <div className="report-stamp">
          {invoice.currency && <p>{invoice.currency}</p>}
          {/* The rate this document was written at, stamped when it was raised
              rather than looked up now — so a copy printed next month still
              quotes the customer the figure he was given. */}
          {invoice.exchange_rate != null && invoice.exchange_rate > 0 && (
            <p>1 {invoice.currency ?? 'USD'} = {invoice.exchange_rate.toLocaleString()} LBP</p>
          )}
        </div>
      </header>

      <section className="invoice-parties">
        <div className="invoice-party">
          <h3>Billed to</h3>
          <p className="is-name">{invoice.customer || '—'}</p>
          {invoice.customer_address?.trim() && <p>{invoice.customer_address.trim()}</p>}
          {invoice.customer_phone?.trim() && <p>{invoice.customer_phone.trim()}</p>}
        </div>
        <div className="invoice-party">
          <h3>Sold by</h3>
          <p className="is-name">{invoice.salesman?.name || '—'}</p>
          {/* Said on the paper because it changes what the document is: a van
              sale was rung up at the counter, not delivered against an order. */}
          {invoice.is_van_sale && <p>Sold from the van</p>}
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="report-empty">
          This invoice has no lines. Open it from the list to load them.
        </p>
      ) : (
        <table className="report-table">
          <colgroup>
            <col style={{ width: '11%' }} />
            <col style={{ width: '39%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="is-text">Code</th>
              <th className="is-text">Item</th>
              <th className="is-number">Qty</th>
              <th className="is-text">Unit</th>
              <th className="is-money">Price</th>
              <th className="is-money">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="is-text">{row.item_code || '—'}</td>
                <td className="is-text">
                  {row.item_name || '—'}
                  {row.line_memo ? ` — ${row.line_memo}` : ''}
                </td>
                {/* The quantity in the packaging it was sold in — four cases,
                    not forty-eight bottles, because four cases is what the
                    customer agreed to. */}
                <td className="is-number">{formatQty(row.trs_qty)}</td>
                <td className="is-text">{row.uom_name || '—'}</td>
                <td className="is-money">{money(row.price)}</td>
                <td className="is-money">{money(row.price * row.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="invoice-totals">
        <dl>
          <div>
            <dt>Units</dt>
            <dd>{formatQty(invoice.total_qty)}</dd>
          </div>
          <div className="is-grand">
            <dt>Total</dt>
            <dd>{money(invoice.total_price)}</dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd>{money(invoice.paid_amount)}</dd>
          </div>
          <div className={settled ? 'is-settled' : 'is-due'}>
            <dt>{settled ? 'Settled' : 'Balance due'}</dt>
            <dd>{money(due)}</dd>
          </div>
        </dl>
      </section>

      {showTenders && (
        <section className="invoice-tenders">
          <h3>How it was paid</h3>
          <ul>
            {tenders.map((tender, i) => (
              <li key={`${tender.method}-${i}`}>
                <span>
                  {describeTender(tender)}
                  {tender.reference ? ` · ${tender.reference}` : ''}
                </span>
                <span className="is-value">{money(tender.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!showTenders && invoice.payment_method && (
        <p className="invoice-note">
          <strong>Paid by</strong>
          {paymentMethodLabel(invoice.payment_method)}
        </p>
      )}

      {invoice.notes?.trim() && (
        <p className="invoice-note">
          <strong>Note</strong>
          {invoice.notes.trim()}
        </p>
      )}

      <section className="invoice-signature">
        <div>
          {invoice.signature_path ? (
            <>
              <div className="is-rule" />
              <span className="is-signed">Signed for by the customer on delivery.</span>
            </>
          ) : (
            <>
              <div className="is-rule" />
              <span>Customer signature</span>
            </>
          )}
        </div>
        <div>
          <div className="is-rule" />
          <span>For {invoice.salesman?.name || companyName}</span>
        </div>
      </section>

      <footer className="report-footer">
        <span>{companyName}</span>
        <span>Invoice {invoice.trs_number || `#${invoice.id}`}</span>
      </footer>
    </article>
  )
}
