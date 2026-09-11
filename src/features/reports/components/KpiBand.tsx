import type { ReactNode } from 'react'
import {
  BadgePercent,
  Boxes,
  CircleDollarSign,
  FileText,
  Layers,
  MapPin,
  Package,
  Percent,
  Receipt,
  RotateCcw,
  Truck,
  Undo2,
  Users,
} from 'lucide-react'

import { money, qty } from '../report-format'
import { pct, type ReportResult } from '../server-report-doc'

interface Tile {
  label: string
  value: string
  icon: ReactNode
  /** A change against the comparison window, in percent. */
  change?: number | null
  hint?: string
  /** The one figure the report is about, drawn larger. */
  lead?: boolean
}

function tilesFor(result: ReportResult): Tile[] {
  if (result.engine === 'sales') {
    const k = result.data.kpis
    const comparing = result.data.compare !== 'none'
    return [
      {
        label: 'Net sales',
        value: money(k.net_sales),
        icon: <CircleDollarSign size={18} />,
        change: comparing ? k.growth_pct : undefined,
        hint: comparing ? `vs ${money(k.prior_net_sales)}` : undefined,
        lead: true,
      },
      { label: 'Gross margin', value: pct(k.margin_pct), icon: <Percent size={18} />, hint: money(k.gross_margin) },
      { label: 'Qty sold', value: qty(k.qty), icon: <Package size={18} />, hint: `${qty(k.lines_count)} lines` },
      { label: 'Returns', value: money(k.returns_value), icon: <RotateCcw size={18} />, hint: `${qty(k.returns_qty)} units back` },
      { label: 'Invoices', value: qty(k.invoice_count), icon: <Receipt size={18} /> },
      { label: 'Active SKUs', value: qty(k.active_skus), icon: <Layers size={18} /> },
      { label: 'Billed customers', value: qty(k.billed_customers), icon: <Users size={18} /> },
    ]
  }

  if (result.engine === 'inventory') {
    const k = result.data.kpis
    return [
      { label: 'Value at cost', value: money(k.cost_value), icon: <CircleDollarSign size={18} />, lead: true },
      { label: 'Value at price', value: money(k.sale_value), icon: <BadgePercent size={18} /> },
      { label: 'Units on hand', value: qty(k.units), icon: <Boxes size={18} /> },
      { label: 'SKUs', value: qty(k.skus), icon: <Package size={18} /> },
      { label: 'Locations', value: qty(k.locations), icon: <MapPin size={18} /> },
    ]
  }

  const k = result.data.kpis
  const unloads = result.engine === 'unloads'
  return [
    {
      label: unloads ? 'Qty back' : 'Qty loaded',
      value: qty(k.qty),
      icon: unloads ? <Undo2 size={18} /> : <Truck size={18} />,
      lead: true,
    },
    ...(unloads && k.unload_ratio_pct !== undefined
      ? [{ label: 'Unload ratio', value: pct(k.unload_ratio_pct), icon: <Percent size={18} />, hint: `of ${qty(k.loaded_qty)} loaded` }]
      : []),
    { label: 'Value at cost', value: money(k.cost_value), icon: <CircleDollarSign size={18} /> },
    { label: 'Value at price', value: money(k.sale_value), icon: <BadgePercent size={18} /> },
    { label: 'Documents', value: qty(k.documents), icon: <FileText size={18} />, hint: `${qty(k.lines)} lines` },
  ]
}

function Change({ value }: { value: number | null | undefined }) {
  if (value === undefined) return null
  if (value === null) {
    return <span className="text-xs font-medium text-[var(--text-muted)]">new</span>
  }
  const up = value >= 0
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
        up
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      ].join(' ')}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

/** The whole window's figures, above the rows that make them up. */
export function KpiBand({ result }: { result: ReportResult }) {
  const tiles = tilesFor(result)

  return (
    <section
      aria-label="Key figures"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7"
    >
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={[
            'relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]',
            tile.lead ? 'col-span-2 sm:col-span-1' : '',
          ].join(' ')}
        >
          {tile.lead && (
            <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-teal)]" />
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {tile.label}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              {tile.icon}
            </span>
          </div>
          <p
            className={[
              'mt-2 font-bold tabular-nums text-[var(--text-primary)]',
              tile.lead ? 'text-2xl' : 'text-xl',
            ].join(' ')}
          >
            {tile.value}
          </p>
          <div className="mt-1 flex min-h-5 items-center gap-2">
            <Change value={tile.change} />
            {tile.hint && <span className="truncate text-xs text-[var(--text-muted)]">{tile.hint}</span>}
          </div>
        </div>
      ))}
    </section>
  )
}
