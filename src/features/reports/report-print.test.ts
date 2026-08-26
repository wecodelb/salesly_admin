// Node types for this file alone. tsconfig.app.json is deliberately
// browser-only, and a test that reads a file off disk is the one exception
// rather than a reason to hand the whole app `process` and `Buffer`.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Read rather than import: vitest stubs CSS imports (including `?raw`), so an
// import here would quietly assert against an empty string and pass forever.
const css = readFileSync(join(__dirname, 'report-print.css'), 'utf8')

/**
 * The rules that only exist on paper.
 *
 * Asserting on stylesheet text is a blunt instrument, and normally not worth
 * doing. It earns its place here because every rule below is invisible on
 * screen: delete any of them and the console looks identical, the tests pass,
 * and the defect only appears on page two of a PDF nobody generates until a
 * month end. A grep is a poor test of styling and a fair test of "is the thing
 * that makes multi-page tables readable still here".
 */
/** The @media print block, where all of this has to live to have any effect. */
const printBlock = css.slice(css.indexOf('@media print'))

describe('the print stylesheet', () => {
  it('exists and has a print block at all', () => {
    expect(css).toContain('@media print')
    expect(printBlock.length).toBeGreaterThan(100)
  })

  it('repeats table headings on every page', () => {
    // Without this a table running to three pages carries its column headings
    // only on the first, and pages two and three are columns of bare figures.
    expect(printBlock).toMatch(/thead\s*\{[^}]*display:\s*table-header-group/)
  })

  it('repeats the totals row as a footer group', () => {
    expect(printBlock).toMatch(/tfoot\s*\{[^}]*display:\s*table-footer-group/)
  })

  it('never splits a row across a page break', () => {
    // Half a customer at the bottom of one page and half at the top of the
    // next is the single ugliest thing a printed table can do.
    expect(printBlock).toMatch(/tr\s*\{[^}]*break-inside:\s*avoid/)
  })

  it('keeps a group heading with the rows it introduces', () => {
    // A heading stranded at the foot of a page reads as an empty section.
    expect(printBlock).toMatch(/report-group-head\s*\{[^}]*break-after:\s*avoid/)
  })

  it('hides everything that is not the document', () => {
    // The sidebar, the filters and the Export button itself have no business
    // on the page.
    expect(printBlock).toMatch(/body\s*\*\s*\{[^}]*visibility:\s*hidden/)
    expect(printBlock).toMatch(/report-doc[^{]*\{[^}]*visibility:\s*visible/)
  })

  it('sets a real page size and margins', () => {
    expect(printBlock).toMatch(/@page\s*\{[^}]*size:\s*A4/)
    expect(printBlock).toMatch(/@page\s*\{[^}]*margin:/)
  })

  it('drops zebra striping, which costs toner and buys nothing on paper', () => {
    expect(printBlock).toMatch(/nth-child\(even\)\s*\{[^}]*background:\s*transparent/)
  })

  it('shows a screen-carried document only on paper', () => {
    // The list screens carry their export hidden. If the print rule that
    // reveals it goes missing, every Export PDF button in the console prints a
    // blank page and nothing on screen looks any different.
    expect(css).toMatch(/\.report-doc\.is-print-only\s*\{\s*display:\s*none/)
    expect(printBlock).toMatch(/report-doc\.is-print-only\s*\{[^}]*display:\s*block/)
  })

  it('shows the running footer that is hidden on screen', () => {
    // Hidden in the screen rules, shown in the print ones — a page found loose
    // has to name its company and report.
    expect(css).toMatch(/\.report-footer\s*\{\s*display:\s*none/)
    expect(printBlock).toMatch(/report-footer\s*\{[^}]*display:\s*flex/)
  })
})

describe('the screen stylesheet', () => {
  it('aligns figures right so a column can be scanned down', () => {
    expect(css).toMatch(/is-money[^{]*\{[^}]*text-align:\s*right/)
  })

  it('uses tabular figures so digits line up under one another', () => {
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/)
  })
})
