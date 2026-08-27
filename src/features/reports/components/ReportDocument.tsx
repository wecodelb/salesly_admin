import type { ReportDocument as Doc } from '../report-types'

interface Props<Row> {
  doc: Doc<Row>
  /** Printed in the masthead — the distributor's name, not the app's. */
  companyName: string
  /** When it was run. Stamped so a filed page says how old it is. */
  generatedAt: Date
  /** Extra classes on the document root — `is-print-only` for a screen that
   *  carries its export without showing it. */
  className?: string
}

/**
 * The report itself — the thing that becomes the PDF.
 *
 * Deliberately plain HTML with print-aware classes rather than the console's
 * card components. A report is read on paper: it wants hairlines and repeating
 * table headers, not shadows and rounded corners, and every millimetre of
 * padding is a row that does not fit on the page.
 *
 * The masthead, the summary strip and the column headings all repeat on every
 * printed page (see report-print.css). That is not decoration — a page four
 * found loose in a folder has to say what it is, whose it is and what the
 * columns mean, or it is waste paper.
 */
export function ReportDocument<Row>({
  doc,
  companyName,
  generatedAt,
  className,
}: Props<Row>) {
  const hasRows = doc.groups.some((g) => g.rows.length > 0)

  return (
    <article className={className ? `report-doc ${className}` : 'report-doc'}>
      <header className="report-masthead">
        <div>
          <p className="report-company">{companyName}</p>
          <h1 className="report-title">{doc.title}</h1>
          {doc.subtitle && <p className="report-subtitle">{doc.subtitle}</p>}
        </div>
        <div className="report-stamp">
          <p>
            Generated{' '}
            {generatedAt.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <p>
            {generatedAt.toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </header>

      {doc.summary && doc.summary.length > 0 && (
        <section className="report-summary">
          {doc.summary.map((item) => (
            <div key={item.label} className="report-summary-item">
              <span className="report-summary-label">{item.label}</span>
              <span className="report-summary-value">{item.value}</span>
            </div>
          ))}
        </section>
      )}

      {!hasRows ? (
        <p className="report-empty">
          {doc.emptyMessage ?? 'Nothing matches these filters.'}
        </p>
      ) : (
        doc.groups
          .filter((group) => group.rows.length > 0)
          .map((group) => {
            // A group may carry its own columns, for a document that prints two
            // tables of different shapes under one masthead.
            const cols = group.columns ?? doc.columns

            return (
            <section key={group.key} className="report-group">
              {/* Omitted when a report has one unnamed group — an ungrouped
                  list should not carry a heading that says nothing. */}
              {group.title && (
                <div className="report-group-head">
                  <h2 className="report-group-title">{group.title}</h2>
                  {group.caption && (
                    <span className="report-group-caption">{group.caption}</span>
                  )}
                </div>
              )}

              <table className="report-table">
                <colgroup>
                  {cols.map((col, i) => (
                    <col key={i} style={col.width ? { width: col.width } : undefined} />
                  ))}
                </colgroup>
                {/* thead, not a styled div: it is what makes the browser repeat
                    the headings at the top of every printed page. */}
                <thead>
                  <tr>
                    {cols.map((col, i) => (
                      <th key={i} className={`is-${col.kind ?? 'text'}`}>
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, r) => (
                    <tr key={r}>
                      {cols.map((col, i) => (
                        <td key={i} className={`is-${col.kind ?? 'text'}`}>
                          {col.value(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {cols.some((c) => c.total) && (
                  <tfoot>
                    <tr>
                      {cols.map((col, i) => (
                        <td key={i} className={`is-${col.kind ?? 'text'}`}>
                          {col.total
                            ? formatTotal(totalOf(group.rows, col.total), col.kind)
                            : i === 0
                              ? 'Total'
                              : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </section>
            )
          })
      )}

      <footer className="report-footer">
        <span>{companyName}</span>
        <span>{doc.title}</span>
      </footer>
    </article>
  )
}

/**
 * Adds a column down a group, skipping what cannot be added.
 *
 * A column's `total` is typed as returning a number, and on a row with a hole
 * in it — a figure the endpoint left out — it returns undefined instead. Added
 * naively that makes the whole column total NaN, which prints in the footer as
 * the word "NaN" and reads as a broken system to whoever is holding the page.
 * Skipping the bad rows totals what could be totalled, which is both the honest
 * answer and the one somebody can act on.
 */
function totalOf<Row>(rows: Row[], total: (row: Row) => number): number {
  return rows.reduce((sum, row) => {
    const value = total(row)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)
}

function formatTotal(value: number, kind: string | undefined): string {
  if (kind === 'money') {
    return `$${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`
  }

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}
