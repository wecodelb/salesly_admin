import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ReportDocument } from './ReportDocument'
import type { ReportDocument as Doc } from '../report-types'

/**
 * The printed document's structure.
 *
 * Most of what makes a PDF readable is structural rather than visual, and it is
 * exactly the part that breaks silently: a table built from divs still looks
 * right on screen and loses its headings on page two. These assert the elements
 * the print stylesheet needs to be there — a real `thead`, a real `tfoot`, a
 * masthead and a footer — because none of that is visible in a screenshot of
 * page one.
 */

interface Row {
  name: string
  amount: number
}

const doc = (over: Partial<Doc<Row>> = {}): Doc<Row> => ({
  title: 'Customer book',
  subtitle: 'By salesman',
  columns: [
    { header: 'Customer', value: (r) => r.name },
    {
      header: 'Balance',
      kind: 'money',
      value: (r) => `$${r.amount.toFixed(2)}`,
      total: (r) => r.amount,
    },
  ],
  groups: [
    {
      key: 'ahmad',
      title: 'Ahmad',
      caption: '2 customers',
      rows: [
        { name: 'Alpha', amount: 100 },
        { name: 'Beta', amount: 250 },
      ],
    },
  ],
  summary: [{ label: 'Total owed', value: '$350.00' }],
  ...over,
})

const at = new Date('2026-03-15T14:32:00Z')

const renderDoc = (d: Doc<Row>) =>
  render(<ReportDocument doc={d} companyName="Nestle" generatedAt={at} />)

describe('the masthead', () => {
  it('names the company, the report and when it was run', () => {
    // A page found loose in a folder has to say what it is and whose it is.
    // Scoped to the masthead: the company and title deliberately appear again
    // in the footer, which is the next test.
    const { container } = renderDoc(doc())
    const masthead = within(container.querySelector('.report-masthead') as HTMLElement)

    expect(masthead.getByText('Nestle')).toBeInTheDocument()
    expect(masthead.getByText('Customer book')).toBeInTheDocument()
    expect(masthead.getByText('By salesman')).toBeInTheDocument()
    expect(masthead.getByText(/15 Mar 2026/)).toBeInTheDocument()
  })

  it('repeats the company and title in a footer for later pages', () => {
    const { container } = renderDoc(doc())
    const footer = container.querySelector('.report-footer')

    expect(footer).not.toBeNull()
    expect(footer!.textContent).toContain('Nestle')
    expect(footer!.textContent).toContain('Customer book')
  })
})

describe('the summary strip', () => {
  it('prints the headline figures above the table', () => {
    // Scoped to the strip: $350.00 is also the column total in the tfoot, and
    // the two agreeing is the point rather than a collision.
    const { container } = renderDoc(doc())
    const strip = within(container.querySelector('.report-summary') as HTMLElement)

    expect(strip.getByText('Total owed')).toBeInTheDocument()
    expect(strip.getByText('$350.00')).toBeInTheDocument()
  })

  it('agrees with the column total it sits above', () => {
    // If these two ever disagree the report is worthless, and it is exactly the
    // kind of drift nobody notices until a month end.
    const { container } = renderDoc(doc())
    const strip = container.querySelector('.report-summary')!.textContent
    const foot = container.querySelector('.report-table tfoot')!.textContent

    expect(strip).toContain('$350.00')
    expect(foot).toContain('$350.00')
  })

  it('is left out entirely when a report has no figures worth topping', () => {
    const { container } = renderDoc(doc({ summary: [] }))

    expect(container.querySelector('.report-summary')).toBeNull()
  })
})

describe('the table', () => {
  it('uses a real thead, which is what repeats the headings on every page', () => {
    // Built from divs this would look identical on screen and lose its
    // headings from page two onward.
    const { container } = renderDoc(doc())
    const thead = container.querySelector('.report-table thead')

    expect(thead).not.toBeNull()
    expect(within(thead as HTMLElement).getByText('Customer')).toBeInTheDocument()
    expect(within(thead as HTMLElement).getByText('Balance')).toBeInTheDocument()
  })

  it('prints every row of every group', () => {
    renderDoc(doc())

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('totals the columns that carry a total, in a real tfoot', () => {
    const { container } = renderDoc(doc())
    const tfoot = container.querySelector('.report-table tfoot')

    expect(tfoot).not.toBeNull()
    expect(tfoot!.textContent).toContain('$350.00')
    // The first cell labels the row rather than leaving a bare figure floating.
    expect(tfoot!.textContent).toContain('Total')
  })

  it('has no tfoot at all when nothing is worth adding up', () => {
    const { container } = renderDoc(
      doc({ columns: [{ header: 'Customer', value: (r) => r.name }] }),
    )

    expect(container.querySelector('.report-table tfoot')).toBeNull()
  })

  it('marks money and number cells so they align right on paper', () => {
    // Figures that do not line up under one another cannot be scanned down a
    // column, which is most of what a printed table is for.
    const { container } = renderDoc(doc())

    expect(container.querySelector('td.is-money')).not.toBeNull()
    expect(container.querySelector('th.is-money')).not.toBeNull()
  })

  it('gives each column its width hint so the layout survives printing', () => {
    const { container } = renderDoc(
      doc({
        columns: [
          { header: 'Customer', value: (r) => r.name, width: '60%' },
          { header: 'Balance', kind: 'money', value: (r) => `$${r.amount}`, width: '40%' },
        ],
      }),
    )

    const cols = container.querySelectorAll('colgroup col')
    expect(cols).toHaveLength(2)
    expect((cols[0] as HTMLElement).style.width).toBe('60%')
  })
})

describe('groups', () => {
  it('heads each group and captions it', () => {
    renderDoc(doc())

    expect(screen.getByText('Ahmad')).toBeInTheDocument()
    expect(screen.getByText('2 customers')).toBeInTheDocument()
  })

  it('prints no heading for a single unnamed group', () => {
    // A flat list with a heading saying nothing is worse than no heading.
    const { container } = renderDoc(
      doc({ groups: [{ key: 'all', title: '', rows: [{ name: 'Alpha', amount: 1 }] }] }),
    )

    expect(container.querySelector('.report-group-head')).toBeNull()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('leaves out a group that has no rows', () => {
    const { container } = renderDoc(
      doc({
        groups: [
          { key: 'a', title: 'Ahmad', rows: [{ name: 'Alpha', amount: 1 }] },
          { key: 'b', title: 'Empty', rows: [] },
        ],
      }),
    )

    expect(screen.queryByText('Empty')).toBeNull()
    expect(container.querySelectorAll('.report-table')).toHaveLength(1)
  })
})

describe('nothing to print', () => {
  it('says so instead of showing an empty table', () => {
    renderDoc(doc({ groups: [], emptyMessage: 'No customers on the book.' }))

    expect(screen.getByText('No customers on the book.')).toBeInTheDocument()
    expect(document.querySelector('.report-table')).toBeNull()
  })

  it('falls back to a sentence when the report supplied none', () => {
    renderDoc(doc({ groups: [], emptyMessage: undefined }))

    expect(screen.getByText(/Nothing matches these filters/)).toBeInTheDocument()
  })

  it('treats a group of no rows as nothing to print', () => {
    renderDoc(doc({ groups: [{ key: 'a', title: 'Ahmad', rows: [] }], emptyMessage: 'Empty.' }))

    expect(screen.getByText('Empty.')).toBeInTheDocument()
  })
})
