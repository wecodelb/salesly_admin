import { useMemo, useState } from 'react'
import { Coins, Eye, MoreVertical, Pencil, Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { CurrencyFormDrawer } from '../components/CurrencyFormDrawer'
import { CurrencyDetailsDrawer } from '../components/CurrencyDetailsDrawer'
import { useCurrencies } from '../hooks/use-currencies'
import type { Currency } from '../types'

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

  const { data: currencies = [], isLoading, isError, refetch } = useCurrencies()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Currency | null>(null)
  const [viewing, setViewing] = useState<Currency | null>(null)

  const base = currencies.find((c) => c.is_base)

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
        actions={
          canManage ? (
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New currency
            </Button>
          ) : undefined
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <DataTable
        columns={columns}
        data={currencies as (Currency & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(c) => setViewing(c as Currency)}
        emptyIcon={<Coins size={30} />}
        emptyMessage="No currencies yet."
      />

      <CurrencyFormDrawer
        open={creating}
        onClose={() => setCreating(false)}
        baseCode={base?.code}
      />
      <CurrencyFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        currency={editing}
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
    </>
  )
}
