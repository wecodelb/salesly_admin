import { listDoc } from '@/features/reports/list-doc'
import { qty, text } from '@/features/reports/report-format'
import type { ReportColumn, ReportGroup } from '@/features/reports/report-types'
import type { Currency, ExchangeRate } from './types'

/**
 * One printed row, whichever of the screen's two tables it came from.
 *
 * The catalog and the rate history are not the same shape, so each group
 * carries its own columns and only ever reads its own fields. Normalising both
 * into one row type keeps that honest without casts — a column cannot
 * accidentally read a field its table does not have.
 */
interface Line {
  key: string
  /** Catalog */
  code?: string
  name?: string
  symbol?: string
  renders?: string
  base?: string
  status?: string
  /** Rate history */
  pair?: string
  inForce?: string
  until?: string
  recorded?: string
}

const CATALOG: ReportColumn<Line>[] = [
  { header: 'Code', value: (l) => text(l.code), width: '13%' },
  { header: 'Currency', value: (l) => text(l.name), width: '30%' },
  { header: 'Symbol', value: (l) => text(l.symbol), width: '12%' },
  { header: 'Renders as', value: (l) => text(l.renders), width: '17%' },
  { header: 'Base', value: (l) => l.base ?? '', width: '13%' },
  { header: 'Status', value: (l) => text(l.status), width: '15%' },
]

const HISTORY: ReportColumn<Line>[] = [
  // Spelled out the way it is entered, so a figure can be read off the page
  // without decoding which side of the pair the column is on.
  { header: 'Rate', value: (l) => text(l.pair), width: '38%' },
  { header: 'In force', kind: 'date', value: (l) => text(l.inForce), width: '17%' },
  { header: 'Until', kind: 'date', value: (l) => text(l.until), width: '17%' },
  { header: 'Recorded', value: (l) => text(l.recorded), width: '28%' },
]

/**
 * The Currencies screen, as a printed page.
 *
 * Both tables, because the screen is both: a catalog is unusable on paper
 * without the rates it converts at, and a rate history means nothing without
 * the currency names beside it. The base currency is marked rather than sorted
 * to the top — every rate is quoted against it, and a page that does not say
 * which one it is cannot be checked against anything.
 */
export function currenciesExportDoc(
  currencies: Currency[],
  rates: ExchangeRate[] = [],
) {
  const base = currencies.find((c) => c.is_base)
  const groups: ReportGroup<Line>[] = [
    {
      key: 'catalog',
      title: 'Currencies',
      caption: `${qty(currencies.length)} · ${qty(currencies.filter((c) => c.is_active).length)} active`,
      columns: CATALOG,
      rows: currencies.map(
        (c): Line => ({
          key: `c${c.id}`,
          code: c.code,
          name: c.name,
          symbol: c.symbol ?? '',
          renders: renders(c),
          base: c.is_base ? 'Base' : '',
          status: c.is_active ? 'Active' : 'Inactive',
        }),
      ),
    },
  ]

  if (rates.length > 0) {
    groups.push({
      key: 'rates',
      title: 'Exchange rates',
      caption: `${qty(rates.length)} recorded · newest first`,
      columns: HISTORY,
      rows: rateLines(rates, currencies, base),
    })
  }

  return listDoc<Line>({
    title: 'Currencies',
    noun: 'currencies',
    rows: currencies.map((c): Line => ({ key: `c${c.id}` })),
    total: currencies.length,
    columns: CATALOG,
    filters: [rates.length > 0 && `${qty(rates.length)} exchange rates`],
    summary: [
      { label: 'Currencies', value: qty(currencies.length) },
      { label: 'Active', value: qty(currencies.filter((c) => c.is_active).length) },
      { label: 'Base', value: text(base?.code) },
      { label: 'Rates recorded', value: qty(rates.length) },
    ],
    groups,
    emptyMessage: 'No currencies yet.',
  })
}

/**
 * The rate history, newest first, with each currency's current rate marked.
 *
 * Position is the only trustworthy signal, exactly as on screen: rows recorded
 * while an end date was still asked for left `effective_to` null, so that field
 * cannot separate the rate in force from the ones it replaced. The first row
 * carrying a currency is what it is worth today; every later one has already
 * been superseded, and its window closes where its successor opens.
 */
function rateLines(
  rates: ExchangeRate[],
  currencies: Currency[],
  base: Currency | undefined,
): Line[] {
  const seen = new Set<number>()
  const supersededBy = new Map<number, ExchangeRate>()
  const lastSeen = new Map<number, ExchangeRate>()

  for (const rate of rates) {
    const newer = lastSeen.get(rate.currency_id)
    if (newer) supersededBy.set(rate.id, newer)
    else seen.add(rate.id)
    lastSeen.set(rate.currency_id, rate)
  }

  const codeOf = (r: ExchangeRate) =>
    r.currency?.code ??
    currencies.find((c) => c.id === r.currency_id)?.code ??
    '—'

  return rates.map((r): Line => {
    const until = supersededBy.get(r.id)?.effective_at ?? r.effective_to
    // Guarded rather than trusted. A rate row with no figure is not supposed to
    // exist, but reading it as `r.rate.toLocaleString()` turns that into an
    // exception thrown inside the Export click — and a click that throws prints
    // nothing at all and says nothing about why.
    const figure = Number.isFinite(r.rate) ? r.rate.toLocaleString() : '—'
    return {
      key: `r${r.id}`,
      pair: `1 ${base?.code ?? 'local'} = ${figure} ${codeOf(r)}${
        seen.has(r.id) ? '  (current)' : ''
      }`,
      inForce: r.effective_at ?? '—',
      until: until ?? 'still in force',
      recorded: [r.created_by_name, r.created_at].filter(Boolean).join(' · ') || '—',
    }
  })
}

/** One unit written the way this currency renders it, symbol side and all. */
function renders(c: Currency): string {
  const decimals = c.decimal_places > 0 ? `.${'0'.repeat(c.decimal_places)}` : ''
  const amount = `1${decimals}`

  return c.symbol_position === 'before'
    ? `${c.symbol ?? ''}${amount}`
    : `${amount}${c.symbol ?? ''}`
}
