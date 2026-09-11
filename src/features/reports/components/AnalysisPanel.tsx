import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  ChevronRight,
  FilterX,
  Layers,
  Plus,
  SearchX,
  Truck,
  Undo2,
  X,
} from 'lucide-react'

import { Button } from '@/shared/components/Button'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton/LoadingSkeleton'
import { useSalesmen } from '@/features/customers/hooks/use-customers'
import { useCustomerGroups } from '@/features/customer-groups/hooks/use-customer-groups'
import { useAreas } from '@/features/areas/hooks/use-areas'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useBrands } from '@/features/brands/hooks/use-brands'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import type { Compare, InventoryGroup, MovementGroup, SalesDimension } from '../api/reports-api'
import {
  DIMENSION_LABELS,
  PERIOD_LABELS,
  SECTIONS,
  VIEWS,
  findView,
  groupingsFor,
  presetRange,
  type PeriodPreset,
  type ReportView,
  type SectionKey,
} from '../catalog'
import { useServerReport, type ReportRequest } from '../hooks/use-server-report'
import { columnsFor, serverReportDoc } from '../server-report-doc'
import { ExportButton } from './ExportButton'
import { KpiBand } from './KpiBand'
import { ReportTable } from './ReportTable'

const SECTION_ICONS: Record<SectionKey, ReactNode> = {
  sales: <BarChart3 size={15} />,
  advanced: <Layers size={15} />,
  inventory: <Boxes size={15} />,
  loads: <Truck size={15} />,
  unloads: <Undo2 size={15} />,
}

const COMPARE_LABELS: Record<Compare, string> = {
  previous_period: 'Previous period',
  previous_year: 'Same period last year',
  none: 'No comparison',
}

const TOP_OPTIONS = [0, 10, 20, 50]

type FilterKey = 'salesman' | 'channel' | 'region' | 'category' | 'brand' | 'warehouse'

const FILTER_LABELS: Record<FilterKey, string> = {
  salesman: 'Salesman',
  channel: 'Channel',
  region: 'Region',
  category: 'Category',
  brand: 'Brand',
  warehouse: 'Warehouse',
}

/** Which filters narrow which report — only the ones the server applies. */
const FILTERS_BY_ENGINE: Record<ReportView['engine'], FilterKey[]> = {
  sales: ['salesman', 'channel', 'region', 'category', 'brand', 'warehouse'],
  inventory: ['warehouse', 'category', 'brand'],
  loads: ['salesman', 'warehouse'],
  unloads: ['salesman', 'warehouse'],
}

const EMPTY_FILTERS: Record<FilterKey, string> = {
  salesman: '',
  channel: '',
  region: '',
  category: '',
  brand: '',
  warehouse: '',
}

interface Named {
  id: number
  name: string
}

const selectClass =
  'h-9 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  )
}

/**
 * The analysis side of Reports: pick a question from the catalogue, narrow
 * it, and read the answer — figures on top, the rows that make them up below.
 */
export function AnalysisPanel() {
  const [search, setSearch] = useSearchParams()
  const view = findView(search.get('view'))

  const [levels, setLevels] = useState<string[]>(view.levels)
  const [preset, setPreset] = useState<PeriodPreset>('this_month')
  const [custom, setCustom] = useState(() => presetRange('this_month'))
  const [compare, setCompare] = useState<Compare>('previous_period')
  const [includeReturns, setIncludeReturns] = useState(true)
  const [top, setTop] = useState(0)
  const [onlyInStock, setOnlyInStock] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const salesmen = useSalesmen()
  const channels = useCustomerGroups()
  const regions = useAreas()
  const categories = useCategories()
  const brands = useBrands()
  const warehouses = useWarehouses()

  const lookups: Record<FilterKey, Named[]> = {
    salesman: (salesmen.data ?? []) as Named[],
    channel: (channels.data ?? []) as Named[],
    region: (regions.data ?? []) as Named[],
    category: (categories.data ?? []) as Named[],
    brand: (brands.data ?? []) as Named[],
    warehouse: (warehouses.data ?? []) as Named[],
  }

  const pick = (next: ReportView) => {
    const params = new URLSearchParams(search)
    params.set('view', next.id)
    setSearch(params, { replace: true })
    // The grouping belongs to the question. Carried over, "by salesman"
    // would silently turn Inventory into something it does not group by.
    setLevels(next.levels)
    setTop(0)
  }

  const range = preset === 'custom' ? custom : presetRange(preset)
  const active = FILTERS_BY_ENGINE[view.engine]
  const ids = (key: FilterKey) =>
    active.includes(key) && filters[key] ? [Number(filters[key])] : undefined

  const request: ReportRequest = useMemo(() => {
    if (view.engine === 'sales') {
      return {
        engine: 'sales',
        params: {
          from: range.from,
          to: range.to,
          group_by: levels as SalesDimension[],
          include_returns: includeReturns,
          compare,
          top: top || null,
          salesman_id: ids('salesman'),
          customer_group_id: ids('channel'),
          area_id: ids('region'),
          category_id: ids('category'),
          brand_id: ids('brand'),
          warehouse_id: ids('warehouse'),
        },
      }
    }
    if (view.engine === 'inventory') {
      return {
        engine: 'inventory',
        params: {
          group_by: levels[0] as InventoryGroup,
          only_in_stock: onlyInStock,
          warehouse_id: ids('warehouse'),
          category_id: ids('category'),
          brand_id: ids('brand'),
        },
      }
    }
    return {
      engine: view.engine,
      params: {
        from: range.from,
        to: range.to,
        group_by: levels[0] as MovementGroup,
        salesman_id: ids('salesman'),
        warehouse_id: ids('warehouse'),
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.engine, range.from, range.to, levels, includeReturns, compare, top, onlyInStock, filters])

  const report = useServerReport(request)
  // A previous answer is kept while the next loads — but never one from a
  // different kind of report, laid out under this one's title.
  const result = report.data && report.data.engine === view.engine ? report.data : undefined
  const layout = result ? columnsFor(result, view) : null

  const notes = active
    .filter((key) => filters[key])
    .map((key) => {
      const name = lookups[key].find((o) => String(o.id) === filters[key])?.name ?? filters[key]
      return `${FILTER_LABELS[key]}: ${name}`
    })

  const filtered = notes.length > 0
  const setLevel = (i: number, dim: string) => setLevels((l) => l.map((d, j) => (j === i ? dim : d)))
  const removeLevel = (i: number) => setLevels((l) => l.filter((_, j) => j !== i))
  const addLevel = () =>
    setLevels((l) => {
      const next = groupingsFor('sales').find((d) => !l.includes(d))
      return next && l.length < 3 ? [...l, next] : l
    })

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* The catalogue. */}
      <nav aria-label="Report catalogue" className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        {SECTIONS.map((section) => (
          <div key={section.key}>
            <p className="mb-1.5 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <span className="text-[var(--accent-primary)]">{SECTION_ICONS[section.key]}</span>
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {VIEWS.filter((v) => v.section === section.key).map((v) => {
                const current = v.id === view.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => pick(v)}
                    aria-current={current ? 'page' : undefined}
                    title={v.description}
                    className={[
                      'group relative rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                      current
                        ? 'bg-[var(--accent-primary)]/10 font-semibold text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]',
                    ].join(' ')}
                  >
                    {current && (
                      <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--accent-primary)]" />
                    )}
                    {v.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        {/* Title and export. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{view.name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{view.description}</p>
          </div>
          <ExportButton
            variant="outline"
            disabled={!result || report.isError}
            build={() => serverReportDoc(result!, { view, filters: notes }, range)}
          />
        </div>

        {/* Controls. */}
        <section
          aria-label="Report settings"
          className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-wrap items-end gap-3">
            {view.dated && (
              <>
                <Field label="Period">
                  <select
                    aria-label="Period"
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as PeriodPreset)}
                    className={selectClass}
                  >
                    {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
                      <option key={p} value={p}>
                        {PERIOD_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                {preset === 'custom' && (
                  <>
                    <Field label="From">
                      <input
                        type="date"
                        aria-label="From"
                        value={custom.from}
                        max={custom.to}
                        onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                        className={selectClass}
                      />
                    </Field>
                    <Field label="To">
                      <input
                        type="date"
                        aria-label="To"
                        value={custom.to}
                        min={custom.from}
                        onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                        className={selectClass}
                      />
                    </Field>
                  </>
                )}
              </>
            )}

            {view.engine === 'sales' && (
              <>
                <Field label="Compare with">
                  <select
                    aria-label="Compare with"
                    value={compare}
                    onChange={(e) => setCompare(e.target.value as Compare)}
                    className={selectClass}
                  >
                    {(Object.keys(COMPARE_LABELS) as Compare[]).map((c) => (
                      <option key={c} value={c}>
                        {COMPARE_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Show">
                  <select
                    aria-label="Show"
                    value={top}
                    onChange={(e) => setTop(Number(e.target.value))}
                    className={selectClass}
                  >
                    {TOP_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'All rows' : `Top ${n}`}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-1 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={includeReturns}
                    onChange={(e) => setIncludeReturns(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent-primary)]"
                  />
                  Net of returns
                </label>
              </>
            )}

            {view.engine === 'inventory' && (
              <label className="flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-1 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-primary)]"
                />
                Only what is in stock
              </label>
            )}
          </div>

          {/* Grouping. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Group by
            </span>
            {levels.map((dim, i) => (
              <Fragment key={i}>
                {i > 0 && <ChevronRight size={14} aria-hidden className="text-[var(--text-muted)]" />}
                <span className="inline-flex items-center rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/[0.06]">
                  <select
                    aria-label={`Group level ${i + 1}`}
                    value={dim}
                    onChange={(e) => setLevel(i, e.target.value)}
                    className="h-8 cursor-pointer bg-transparent pl-2.5 pr-1 text-sm font-medium text-[var(--accent-primary)] outline-none"
                  >
                    {groupingsFor(view.engine)
                      .filter((d) => d === dim || !levels.includes(d))
                      .map((d) => (
                        <option key={d} value={d}>
                          {DIMENSION_LABELS[d] ?? d}
                        </option>
                      ))}
                  </select>
                  {levels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLevel(i)}
                      aria-label={`Stop grouping by ${DIMENSION_LABELS[dim] ?? dim}`}
                      className="mr-1 flex h-6 w-6 items-center justify-center rounded text-[var(--accent-primary)]/70 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              </Fragment>
            ))}
            {view.engine === 'sales' && levels.length < 3 && (
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={addLevel}>
                Add level
              </Button>
            )}
          </div>

          {/* Filters. */}
          <div className="flex flex-wrap items-end gap-3 border-t border-[var(--border-subtle)] pt-4">
            {active.map((key) => (
              <Field key={key} label={FILTER_LABELS[key]}>
                <select
                  aria-label={FILTER_LABELS[key]}
                  value={filters[key]}
                  onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                  className={`${selectClass} min-w-[150px] max-w-[220px]`}
                >
                  <option value="">All</option>
                  {lookups[key].map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            {filtered && (
              <Button size="sm" variant="ghost" icon={<FilterX size={14} />} onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        {report.isError && !result ? (
          <ErrorState
            title="Couldn't load this report"
            message="The figures could not be read. Try again in a moment."
            onRetry={() => report.refetch()}
          />
        ) : !result || !layout ? (
          <LoadingSkeleton />
        ) : (
          <>
            <KpiBand result={result} />

            {result.data.rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-14 text-center">
                <SearchX size={28} className="text-[var(--text-muted)]" />
                <p className="font-semibold text-[var(--text-primary)]">Nothing recorded here</p>
                <p className="max-w-sm text-sm text-[var(--text-muted)]">
                  {view.dated
                    ? 'No figures for this period and these filters. Try a wider period, or clear a filter.'
                    : 'No stock matches these filters.'}
                </p>
              </div>
            ) : (
              <>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)]">
                  <span>
                    {result.data.rows.length} row{result.data.rows.length === 1 ? '' : 's'}
                  </span>
                  <span aria-hidden>·</span>
                  <span>Click a heading to sort</span>
                  {report.isFetching && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-[var(--accent-primary)]">Updating…</span>
                    </>
                  )}
                </p>
                <ReportTable
                  rows={result.data.rows}
                  levels={layout.levels}
                  keyColumns={layout.keyColumns}
                  measures={layout.measures}
                  groupHeading={DIMENSION_LABELS[layout.levels[0]]}
                  refreshing={report.isFetching}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
