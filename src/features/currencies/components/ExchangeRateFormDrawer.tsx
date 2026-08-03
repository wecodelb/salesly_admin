import { useEffect, useState } from 'react'
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
  effectiveTo: string
}

const today = () => new Date().toISOString().slice(0, 10)

const empty = (currencyId?: number | null): FormState => ({
  currencyId: currencyId != null ? String(currencyId) : '',
  rate: '',
  effectiveFrom: today(),
  effectiveTo: '',
})

/**
 * Records one exchange rate.
 *
 * Rates are append-only — a new entry never overwrites a past one, so an old
 * invoice can always be reprinted at the rate that produced it. That is why
 * this is its own drawer rather than a field on the currency: the currency is
 * edited rarely, its rate as often as the market moves.
 */
export function ExchangeRateFormDrawer({ open, onClose, currencies, baseCode, currencyId }: Props) {
  const { run } = useActionProgress()
  const createRate = useCreateExchangeRate()

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
    if (!form.effectiveFrom) e.effectiveFrom = 'Pick a start date'
    if (form.effectiveTo && form.effectiveTo < form.effectiveFrom)
      e.effectiveTo = 'Must be on or after the start date'
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
          effective_to: form.effectiveTo || null,
        }),
    )

    if (saved !== null) onClose()
  }

  const rateLabel = `1 ${baseCode ?? 'local currency'} = ___ ${selected?.code ?? 'selected currency'}`

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

        <Input
          label={rateLabel}
          type="number"
          min={0}
          step="any"
          value={form.rate}
          onChange={(e) => set('rate', e.target.value)}
          error={errors.rate}
          placeholder="89500"
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              label="From"
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => set('effectiveFrom', e.target.value)}
              error={errors.effectiveFrom}
            />
          </div>
          <div className="flex-1">
            <Input
              label="To (optional)"
              type="date"
              value={form.effectiveTo}
              onChange={(e) => set('effectiveTo', e.target.value)}
              error={errors.effectiveTo}
            />
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          Leave the end date empty for a rate that stays in force until the next one replaces it.
          Past entries are never rewritten — they are what old documents are reprinted from.
        </p>
      </div>
    </SideDrawer>
  )
}
