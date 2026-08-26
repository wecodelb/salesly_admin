/**
 * What a report is, in this console.
 *
 * A report is a title, a set of columns, and rows derived from data the app
 * already fetches — never its own endpoint. Everything here is composed from
 * /customers, /users, /items and /deliveries/invoices, which are the same reads
 * the screens use, so a report can never disagree with the screen it was run
 * from. That matters more than it sounds: a "total outstanding" that differs by
 * a dollar between the Customers page and the customers report is a morning
 * lost to finding out which one lied.
 */

/** How a cell is rendered and, just as importantly, how it is aligned. */
export type ColumnKind = 'text' | 'money' | 'number' | 'date' | 'badge'

export interface ReportColumn<Row> {
  /** Column heading, printed on every page. */
  header: string
  kind?: ColumnKind
  /** The value, already formatted for display. */
  value: (row: Row) => string
  /** A raw number for the footer total, when this column is worth totalling. */
  total?: (row: Row) => number
  /** Narrow columns keep a printed table readable; widths are hints, not rules. */
  width?: string
}

/** A run of rows under a heading — how "by category", "by salesman" etc. print. */
export interface ReportGroup<Row> {
  key: string
  title: string
  /** A line under the title: counts, subtotals, whatever the group is about. */
  caption?: string
  rows: Row[]
}

export interface ReportDocument<Row> {
  title: string
  /** What was asked for, printed under the title so a filed page explains itself. */
  subtitle?: string
  columns: ReportColumn<Row>[]
  groups: ReportGroup<Row>[]
  /** Figures for the summary strip at the top of the document. */
  summary?: { label: string; value: string }[]
  /** Shown instead of a table when the filters match nothing. */
  emptyMessage?: string
}

/** The dimension a report is broken down by. */
export interface ReportBreakdown {
  value: string
  label: string
}

export interface ReportDefinition {
  id: string
  /** What the picker calls it. */
  name: string
  /** One line in the picker saying what it answers. */
  description: string
  /** Which family it sits under: customers, salesmen, products, invoices. */
  family: ReportFamily
  /** How it can be grouped. The first is the default. */
  breakdowns: ReportBreakdown[]
  /** Whether a date range narrows it — false for a standing list like a catalog. */
  dated: boolean
}

export type ReportFamily = 'customers' | 'salesmen' | 'products' | 'invoices'

export const FAMILY_LABELS: Record<ReportFamily, string> = {
  customers: 'Customers',
  salesmen: 'Salesmen',
  products: 'Products',
  invoices: 'Invoices',
}
