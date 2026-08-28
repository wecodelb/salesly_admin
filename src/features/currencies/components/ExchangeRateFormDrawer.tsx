import { useEffect, useId, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { useCreateExchangeRate } from '../hooks/use-currencies'
import type { Currency } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** The company's currencies; the local one can't have a rate against itself. */
  currencies: Currency[]
  baseCode?: string
  /** Pre-selects a currency when the panel is opened from a specific row. */
  currencyId?: number | null
}

interface FormState {
  currencyId: string
  rate: string
  effectiveFrom: string
}

const today = () => new Date().toISOString().slice(0, 10)

const empty = (currencyId?: number | null): FormState => ({
  currencyId: currencyId != null ? String(currencyId) : '',
  rate: '',
  effectiveFrom: today(),
})

/**
 * Records one exchange rate.
 *
 * Rates are append-only — a new entry never overwrites a past one, so an old
 * invoice can always be reprinted at the rate that produced it. The newest
 * entry is the one being applied and it holds until the next replaces it,
 * which is why only a start date is asked for. That is also why this is its
 * own drawer rather than a field on the currency: the currency is edited
 * rarely, its rate as often as the market moves.
 */
export function ExchangeRateFormDrawer({ open, onClose, currencies, baseCode, currencyId }: Props) {
  const { run } = useActionProgress()
  const createRate = useCreateExchangeRate()
  const rateErrorId = useId()

  const [form, setForm] = useState<FormState>(empty())
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(empty(currencyId))
    setErrors({})
  }, [open, currencyId])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  // The local currency is always 1:1 with itself, so it isn't offered.
  const options = currencies
    .filter((c) => !c.is_base)
    .map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` }))

  const selected = currencies.find((c) => String(c.id) === form.currencyId)

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.currencyId) e.currencyId = 'Pick a currency'
    if (form.rate.trim() === '' || Number.isNaN(Number(form.rate)) || Number(form.rate) <= 0)
      e.rate = 'Enter a positive rate'
    if (!form.effectiveFrom) e.effectiveFrom = 'Pick the day it applies from'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const saved = await run(
      {
        label: 'Recording exchange rate',
        detail: selected ? `${baseCode ?? 'Local'} → ${selected.code}` : undefined,
        success: 'The new rate applies to every item straight away.',
      },
      () =>
        createRate.mutateAsync({
          currency_id: Number(form.currencyId),
          rate: Number(form.rate),
          effective_at: form.effectiveFrom,
        }),
    )

    if (saved !== null) onClose()
  }

  // The local currency is what the figure is quoted against, so it opens the
  // expression whether or not one has been marked yet.
  const localCode = baseCode ?? 'local'

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="New exchange rate"
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createRate.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createRate.isPending}>
            Record rate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SearchableSelect
          label="Currency"
          value={form.currencyId}
          onChange={(v) => set('currencyId', v)}
          options={options}
          error={errors.currencyId}
          placeholder={options.length ? 'Select a currency' : 'Add a non-local currency first'}
          searchPlaceholder="Search currencies…"
        />

        {/* The rate is written out as the sentence it is — local currency, the
            number, then what one of it buys — so there is never a question of
            which way round the figure goes. The expression is the field's
            label, hence the aria-label carrying the same reading for anyone
            who can't see the row. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-[var(--text-primary)] whitespace-nowrap">
              1 {localCode}
            </span>
            <span className="font-mono text-sm text-[var(--text-muted)]">=</span>
            <div className="flex-1 min-w-0">
              <Input
                type="number"
                min={0}
                step="any"
                value={form.rate}
                onChange={(e) => set('rate', e.target.value)}
                // A number typed before a currency is picked converts into
                // nothing, and the half-written expression beside it would
                // read as nonsense.
                disabled={!selected}
                aria-label={`1 ${localCode} = ? ${selected?.code ?? 'currency'}`}
                aria-describedby={errors.rate ? rateErrorId : undefined}
                placeholder="89500"
                className={[
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  errors.rate ? 'border-[var(--accent-red)]' : '',
                ].join(' ')}
              />
            </div>
            <span
              className={[
                'font-mono text-sm whitespace-nowrap',
                selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
              ].join(' ')}
            >
              {selected?.code ?? 'currency'}
            </span>
          </div>
          {errors.rate && (
            <p id={rateErrorId} className="text-xs text-[var(--accent-red)]">
              {errors.rate}
            </p>
          )}
        </div>

        <Input
          label="As of"
          type="date"
          value={form.effectiveFrom}
          onChange={(e) => set('effectiveFrom', e.target.value)}
          error={errors.effectiveFrom}
        />

        <p className="text-xs text-[var(--text-muted)]">
          A rate stays in force until the next one replaces it, so there is no end date to pick —
          recording a new one moves the current rate into the history. Past entries are never
          rewritten; they are what old documents are reprinted from.
        </p>
      </div>
    </SideDrawer>
  )
}
