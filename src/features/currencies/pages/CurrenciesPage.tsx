import { useMemo, useState } from 'react'
import { Coins, Eye, MoreVertical, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { currenciesExportDoc } from '../currencies-export'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal/Modal'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { CurrencyFormDrawer } from '../components/CurrencyFormDrawer'
import { CurrencyDetailsDrawer } from '../components/CurrencyDetailsDrawer'
import { ExchangeRateFormDrawer } from '../components/ExchangeRateFormDrawer'
import {
  useAllExchangeRates,
  useCurrencies,
  useDeleteExchangeRate,
} from '../hooks/use-currencies'
import type { Currency, ExchangeRate } from '../types'

/** A worked example of this currency's formatting, for the "Renders as" cell. */
function sample(c: Currency): string {
  const amount = (1234.5).toFixed(c.decimal_places ?? 2)
  const withSeparators = Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: c.decimal_places ?? 2,
    maximumFractionDigits: c.decimal_places ?? 2,
  })
  const symbol = c.symbol || c.code

  return c.symbol_position === 'after'
    ? `${withSeparators} ${symbol}`
    : `${symbol}${withSeparators}`
}

// Admin — the company's currencies. One is flagged local; every other one
// carries a rate read as "1 local = so much of this currency". Rates are
// append-only: recording one applies to every item straight away and pushes
// the one it replaced into the history below, where it stays readable.
export function CurrenciesPage() {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.EXCHANGE_RATES_MANAGE)
  const { run } = useActionProgress()

  const { data: currencies = [], isLoading, isError, refetch } = useCurrencies()
  const deleteRate = useDeleteExchangeRate()

  const { data: rates = [], isLoading: ratesLoading } = useAllExchangeRates()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Currency | null>(null)
  const [viewing, setViewing] = useState<Currency | null>(null)
  const [addingRate, setAddingRate] = useState(false)
  // Set when the rate drawer is opened from one currency's card, so it comes
  // up already pointed at that currency instead of asking again for something
  // the click already said.
  const [rateForCurrency, setRateForCurrency] = useState<number | null>(null)
  const [deletingRate, setDeletingRate] = useState<ExchangeRate | null>(null)

  const base = currencies.find((c) => c.is_base)
  // Nothing to convert while the only currency is the local one.
  const hasConvertible = currencies.some((c) => !c.is_base)

  const confirmDeleteRate = async () => {
    if (!deletingRate) return
    const target = deletingRate
    // Closed first: leaving the confirm modal under the progress dialog would
    // put two overlays on screen at once.
    setDeletingRate(null)
    await run(
      {
        label: 'Deleting exchange rate',
        detail: target.currency?.code ?? undefined,
        success: 'The entry was removed from the history.',
      },
      () => deleteRate.mutateAsync(target.id),
    )
  }

  // The endpoint hands rates back newest first (effective_at then id, both
  // descending), so the first row carrying a currency is what that currency is
  // worth today and every later one has already been superseded. Position is
  // the only trustworthy signal: entries recorded while an end date was still
  // asked for left `effective_to` null, so that column can't separate the rate
  // in force from the ones it replaced.
  const { currentIds, replacedBy } = useMemo(() => {
    const currentIds = new Set<number>()
    // A superseded row's id → the row that took over from it, which is where
    // its window closes.
    const replacedBy = new Map<number, ExchangeRate>()
    const lastSeen = new Map<number, ExchangeRate>()

    for (const rate of rates) {
      const newer = lastSeen.get(rate.currency_id)
      if (newer) replacedBy.set(rate.id, newer)
      else currentIds.add(rate.id)
      lastSeen.set(rate.currency_id, rate)
    }

    return { currentIds, replacedBy }
  }, [rates])

  // The list endpoint embeds the currency, but a row can arrive without it —
  // the company's own list still knows the code.
  const codeOf = (r: ExchangeRate) =>
    r.currency?.code ?? currencies.find((c) => c.id === r.currency_id)?.code ?? '—'

  const rateColumns: Column<ExchangeRate & Record<string, unknown>>[] = [
    {
      key: 'rate',
      header: 'Rate',
      sortable: true,
      // Spelled out the same way it is entered, so a figure can be read off
      // the table without decoding which side of the pair the column is on.
      // The pill is what separates the rate being charged from the ones it
      // replaced — they share a table because they are the same history, read
      // newest first.
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-[var(--text-primary)]">
            1 {base?.code ?? 'local'} = {r.rate.toLocaleString()} {codeOf(r)}
          </span>
          {currentIds.has(r.id) && <StatusPill status="active" label="Current" />}
        </div>
      ),
    },
    {
      key: 'effective_at',
      header: 'In force',
      sortable: true,
      // A superseded row's window closes on the day its successor started; the
      // row's own end date only fills in for entries that carried one. The
      // current rate has no end — that is what makes it current.
      render: (r) => {
        const until = replacedBy.get(r.id)?.effective_at ?? r.effective_to
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-[var(--text-secondary)]">{r.effective_at ?? '—'}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {until ? `until ${until}` : 'still in force'}
            </span>
          </div>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Recorded',
      render: (r) =>
        r.created_by_name || r.created_at ? (
          <div className="flex flex-col gap-0.5">
            {r.created_by_name && (
              <span className="text-sm text-[var(--text-secondary)]">{r.created_by_name}</span>
            )}
            {r.created_at && (
              <span className="text-xs text-[var(--text-muted)]">{r.created_at}</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">—</span>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            width: 'w-1',
            render: (r: ExchangeRate) => (
              <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <button
                  title="Delete this entry"
                  onClick={() => setDeletingRate(r)}
                  className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ),
          } as Column<ExchangeRate & Record<string, unknown>>,
        ]
      : []),
  ]

  const stats = useMemo(() => {
    const base = currencies.find((c) => c.is_base)
    return [
      { label: 'Currencies', value: currencies.length, icon: <Coins size={15} /> },
      { label: 'Active', value: currencies.filter((c) => c.is_active).length },
      { label: 'Local', value: base?.code ?? '—', tone: base ? ('default' as const) : ('warn' as const) },
    ]
  }, [currencies])

  const columns: Column<Currency & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Currency',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[var(--radius-btn)] bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-[var(--accent-primary)]">
              {c.symbol || c.code.slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[var(--text-primary)] truncate">{c.name}</div>
            <div className="text-xs font-mono text-[var(--text-muted)]">{c.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'decimal_places',
      header: 'Renders as',
      // The raw settings ("2 decimals, symbol before") are abstract; showing a
      // formatted sample makes the effect obvious at a glance.
      render: (c) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm text-[var(--text-primary)]">{sample(c)}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {c.decimal_places} {c.decimal_places === 1 ? 'decimal' : 'decimals'} · symbol{' '}
            {c.symbol_position === 'after' ? 'after' : 'before'}
          </span>
        </div>
      ),
    },
    {
      key: 'is_base',
      header: 'Status',
      render: (c) =>
        c.is_base ? (
          <StatusPill status="active" label="Local currency" />
        ) : c.is_active ? (
          <StatusPill status="inactive" label="Available" />
        ) : (
          <StatusPill status="error" label="Inactive" />
        ),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-1',
      render: (c) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer">
                <MoreVertical size={15} />
              </button>
            }
            items={[
              { label: 'View details', icon: <Eye size={14} />, onClick: () => setViewing(c) },
              ...(canManage
                ? [{ label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(c) }]
                : []),
              // Where "set the rate for this one" lives now that the rates
              // panel lists only what has actually been recorded.
              ...(canManage && !c.is_base
                ? [
                    {
                      label: 'Record rate',
                      icon: <TrendingUp size={14} />,
                      onClick: () => setRateForCurrency(c.id),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ),
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Currencies" subtitle="Local currency, formatting & exchange rates" />
        <ErrorState
          title="Couldn't load currencies"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Currencies"
        subtitle={
          base
            ? `Local currency: ${base.name} (${base.code}). Every other currency converts against it.`
            : 'No local currency set yet — mark one to start converting rates.'
        }
        // Export only. Each panel below carries its own "New …" button, and a
        // third one up here would be ambiguous about which it adds to —
        // exporting the catalog is not, because there is only one catalog.
        actions={
          <ExportPdfButton
            variant="outline"
            disabled={isLoading || isError}
            build={() => currenciesExportDoc(currencies, currencies.length)}
          />
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      {/* Two panels side by side from xl up, stacked below it: what a currency
          *is* on the left, what it's worth on the right. `items-start` keeps
          the shorter panel from stretching to match the taller one. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <section className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                Currencies
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Code, symbol and how amounts are rendered.
              </p>
            </div>
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New currency
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={currencies as (Currency & Record<string, unknown>)[]}
            keyField="id"
            loading={isLoading}
            onRowClick={(c) => setViewing(c as Currency)}
            emptyIcon={<Coins size={30} />}
            emptyMessage="No currencies yet."
          />
        </section>

        <section className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                Exchange rates
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {base
                  ? `What one ${base.code} buys, newest first — older entries are history.`
                  : 'Set a local currency to start recording rates.'}
              </p>
            </div>
            {canManage && (
              <Button
                icon={<Plus size={16} />}
                disabled={!hasConvertible}
                onClick={() => setAddingRate(true)}
              >
                New rate
              </Button>
            )}
          </div>

          {/* Only rates that were actually recorded. A currency nobody has
              priced yet has nothing to say here — listing all twenty seeded
              codes as empty "set a rate" rows buried the two or three figures
              the screen exists for. */}
          <DataTable
            columns={rateColumns}
            data={rates as (ExchangeRate & Record<string, unknown>)[]}
            keyField="id"
            loading={ratesLoading}
            emptyIcon={<TrendingUp size={30} />}
            emptyMessage={
              hasConvertible
                ? 'No rates recorded yet.'
                : 'Every currency is the local one — nothing to convert.'
            }
            emptyAction={
              canManage && hasConvertible ? (
                <Button icon={<Plus size={16} />} onClick={() => setAddingRate(true)}>
                  Record the first rate
                </Button>
              ) : undefined
            }
          />
        </section>
      </div>

      <CurrencyFormDrawer open={creating} onClose={() => setCreating(false)} />
      <CurrencyFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        currency={editing}
      />
      <ExchangeRateFormDrawer
        open={addingRate || rateForCurrency !== null}
        onClose={() => {
          setAddingRate(false)
          setRateForCurrency(null)
        }}
        currencies={currencies}
        baseCode={base?.code}
        currencyId={rateForCurrency}
      />
      <CurrencyDetailsDrawer
        currency={viewing}
        onClose={() => setViewing(null)}
        onEdit={(c) => {
          setViewing(null)
          setEditing(c)
        }}
        canManage={canManage}
        baseCode={base?.code}
      />

      <Modal
        open={!!deletingRate}
        onClose={() => setDeletingRate(null)}
        title="Delete exchange rate"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingRate(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteRate.isPending} onClick={confirmDeleteRate}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Remove the{' '}
          <span className="font-medium text-[var(--text-primary)]">
            {deletingRate?.currency?.code} rate of {deletingRate?.rate.toLocaleString()}
          </span>{' '}
          effective {deletingRate?.effective_at}? Anything already priced at it keeps its figures,
          but the history loses this entry.
        </p>
      </Modal>
    </>
  )
}
