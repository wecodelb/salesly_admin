import { useMemo, useState } from 'react'
import { Coins, Eye, MoreVertical, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
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
// carries a rate typed in as "1 local = ___ of this currency". Rates are
// append-only: changing one adds a history entry and applies to every item
// straight away, while past entries stay readable in the details panel.
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

  const rateColumns: Column<ExchangeRate & Record<string, unknown>>[] = [
    {
      key: 'currency',
      header: 'Currency',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--text-primary)]">
            {r.currency?.code ?? currencies.find((c) => c.id === r.currency_id)?.code ?? '—'}
          </span>
          {base && (
            <span className="text-xs text-[var(--text-muted)]">from {base.code}</span>
          )}
        </div>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-sm text-[var(--text-primary)]">
          {r.rate.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'effective_at',
      header: 'In force',
      sortable: true,
      // An open-ended entry is the one currently applied, which is worth
      // saying outright rather than leaving as a blank cell.
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-[var(--text-secondary)]">{r.effective_at ?? '—'}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {r.effective_to ? `until ${r.effective_to}` : 'until replaced'}
          </span>
        </div>
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
        // No action here: each panel below carries its own "New …" button, and
        // a third one up here would be ambiguous about which it adds to.
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
              <Button
                variant="secondary"
                icon={<Plus size={15} />}
                onClick={() => setCreating(true)}
              >
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
                  ? `What one ${base.code} buys, newest first.`
                  : 'Set a local currency to start recording rates.'}
              </p>
            </div>
            {canManage && (
              <Button
                variant="secondary"
                icon={<Plus size={15} />}
                disabled={!hasConvertible}
                onClick={() => setAddingRate(true)}
              >
                New rate
              </Button>
            )}
          </div>

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
                <Button
                  variant="secondary"
                  icon={<Plus size={15} />}
                  onClick={() => setAddingRate(true)}
                >
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
        open={addingRate}
        onClose={() => setAddingRate(false)}
        currencies={currencies}
        baseCode={base?.code}
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
