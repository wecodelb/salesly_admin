import { Pencil } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Timeline } from '@/shared/components/Timeline/Timeline'
import { useExchangeRates } from '../hooks/use-currencies'
import type { Currency } from '../types'

interface Props {
  currency: Currency | null
  onClose: () => void
  onEdit: (currency: Currency) => void
  canManage: boolean
  /** Code of the company's local currency, for the "1 USD = …" rate lines. */
  baseCode?: string
}

/** Read panel for one currency: identity, how it renders, its current rate,
 *  and the full history of rate changes. */
export function CurrencyDetailsDrawer({ currency, onClose, onEdit, canManage, baseCode }: Props) {
  const { data: rates = [], isLoading } = useExchangeRates(currency?.id ?? null)
  const current = rates[0]

  const formatRate = (value: number) =>
    `1 ${baseCode ?? 'local'} = ${value.toLocaleString()} ${currency?.code ?? ''}`

  return (
    <SideDrawer
      open={!!currency}
      onClose={onClose}
      title="Currency"
      width="w-[460px]"
      footer={
        canManage && currency ? (
          <Button variant="outline" icon={<Pencil size={15} />} onClick={() => onEdit(currency)}>
            Edit currency
          </Button>
        ) : undefined
      }
    >
      {currency && (
        <div className="flex flex-col gap-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-[var(--accent-primary)]">
                {currency.symbol || currency.code.slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-[var(--text-primary)] font-heading truncate">
                {currency.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-[var(--text-muted)]">{currency.code}</span>
                <StatusPill
                  status={currency.is_base ? 'active' : currency.is_active ? 'inactive' : 'error'}
                  label={
                    currency.is_base
                      ? 'Local currency'
                      : currency.is_active
                        ? 'Available'
                        : 'Inactive'
                  }
                />
              </div>
            </div>
          </div>

          {/* Display settings */}
          <div>
            <p className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-2" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
              Display
            </p>
            <div className="flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center justify-between">
                <span>Decimal places</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {currency.decimal_places}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Symbol position</span>
                <span className="text-[var(--text-primary)]">
                  {currency.symbol_position === 'after' ? 'After the amount' : 'Before the amount'}
                </span>
              </div>
            </div>
          </div>

          {/* Current rate */}
          {!currency.is_base && (
            <div>
              <p className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-2" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
                Current rate
              </p>
              {current ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-4">
                  <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                    {formatRate(current.rate)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {current.effective_to
                      ? `${current.effective_at} → ${current.effective_to}`
                      : `From ${current.effective_at}`}
                  </p>
                </div>
              ) : (
                <span className="text-sm text-[var(--text-muted)]">
                  No rate recorded yet — add one from Edit.
                </span>
              )}
            </div>
          )}

          {/* Rate history */}
          {!currency.is_base && (
            <div>
              <p className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
                Rate history
              </p>
              {isLoading ? (
                <div className="flex flex-col gap-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-10 rounded-[var(--radius-btn)] bg-[var(--bg-surface-raised)] animate-pulse" />
                  ))}
                </div>
              ) : (
                <Timeline
                  emptyMessage="No rate changes recorded yet."
                  items={rates.map((r) => ({
                    id: r.id,
                    title: formatRate(r.rate),
                    subtitle: r.effective_to
                      ? `${r.effective_at} → ${r.effective_to}`
                      : `From ${r.effective_at}`,
                    meta: [r.created_by_name, r.created_at].filter(Boolean).join(' · ') || undefined,
                  }))}
                />
              )}
            </div>
          )}
        </div>
      )}
    </SideDrawer>
  )
}
