import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { apiErrorMessage } from '@/features/users/hooks/use-users'
import { useCreateCurrency, useCreateExchangeRate, useUpdateCurrency } from '../hooks/use-currencies'
import type {
  CreateCurrencyPayload,
  Currency,
  SymbolPosition,
  UpdateCurrencyPayload,
} from '../types'

interface Props {
  open: boolean
  onClose: () => void
  currency?: Currency | null // null/undefined = create mode
  /** Code of the company's local currency, for the "1 USD = ___" rate label. */
  baseCode?: string
}

interface FormState {
  code: string
  name: string
  symbol: string
  decimalPlaces: string
  symbolPosition: SymbolPosition
  isBase: boolean
  rate: string
  effectiveFrom: string
  effectiveTo: string
}

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY: FormState = {
  code: '',
  name: '',
  symbol: '',
  decimalPlaces: '2',
  symbolPosition: 'before',
  isBase: false,
  rate: '',
  effectiveFrom: '',
  effectiveTo: '',
}

export function CurrencyFormDrawer({ open, onClose, currency, baseCode }: Props) {
  const isEdit = !!currency
  const toast = useToast()
  const { run } = useActionProgress()
  const createCurrency = useCreateCurrency()
  const updateCurrency = useUpdateCurrency()
  const createRate = useCreateExchangeRate()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    if (currency) {
      setForm({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol ?? '',
        decimalPlaces: String(currency.decimal_places ?? 2),
        symbolPosition: currency.symbol_position ?? 'before',
        isBase: currency.is_base,
        // A rate typed here is always a new history entry, never an edit of an
        // existing one — so it starts blank even in edit mode.
        rate: '',
        effectiveFrom: today(),
        effectiveTo: '',
      })
    } else {
      setForm({ ...EMPTY, effectiveFrom: today() })
    }
    setErrors({})
  }, [open, currency])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!isEdit && !form.code.trim()) e.code = 'Code is required'
    if (!isEdit && form.code.trim() && form.code.trim().length !== 3)
      e.code = 'Use the 3-letter code, e.g. USD'
    if (!form.name.trim()) e.name = 'Name is required'

    const dp = Number(form.decimalPlaces)
    if (form.decimalPlaces.trim() === '' || Number.isNaN(dp) || dp < 0 || dp > 6)
      e.decimalPlaces = 'Enter a number between 0 and 6'

    if (!form.isBase) {
      const wantsRate = !isEdit || form.rate.trim() !== ''
      if (wantsRate) {
        if (form.rate.trim() === '' || Number.isNaN(Number(form.rate)) || Number(form.rate) <= 0)
          e.rate = 'Enter a positive rate'
        if (!form.effectiveFrom) e.effectiveFrom = 'Pick a start date'
      }
      if (form.effectiveTo && form.effectiveFrom && form.effectiveTo < form.effectiveFrom)
        e.effectiveTo = 'Must be on or after the start date'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const shared = {
      name: form.name.trim(),
      symbol: form.symbol.trim() || null,
      decimal_places: Number(form.decimalPlaces),
      symbol_position: form.symbolPosition,
      is_base: form.isBase,
    }

    const saved = await run(
      {
        label: isEdit ? 'Saving currency' : 'Creating currency',
        detail: form.name,
        success: `${form.name} has been saved.`,
      },
      async () => {
        let currencyId: number
        if (isEdit && currency) {
          await updateCurrency.mutateAsync({
            id: currency.id,
            payload: shared as UpdateCurrencyPayload,
          })
          currencyId = currency.id
        } else {
          const created = await createCurrency.mutateAsync({
            ...shared,
            code: form.code.trim().toUpperCase(),
          } as CreateCurrencyPayload)
          currencyId = created.id
        }

        // The rate is a second write against a currency that already exists,
        // so losing it doesn't undo the save — it's a warning, not a failure.
        if (!form.isBase && form.rate.trim() !== '') {
          try {
            await createRate.mutateAsync({
              currency_id: currencyId,
              rate: Number(form.rate),
              effective_at: form.effectiveFrom,
              effective_to: form.effectiveTo || null,
            })
          } catch (rateErr) {
            toast.warning(
              'Rate not saved',
              `${form.name} was saved, but its rate could not be recorded: ${apiErrorMessage(rateErr)}`,
            )
          }
        }

        return currencyId
      },
    )

    if (saved !== null) onClose()
  }

  const saving = createCurrency.isPending || updateCurrency.isPending || createRate.isPending
  const rateLabel = `1 ${baseCode ?? 'local currency'} = ___ ${form.code.trim().toUpperCase() || 'this currency'}`

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit currency' : 'New currency'}
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create currency'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Identity
          </h3>
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            error={errors.code}
            placeholder="USD"
            maxLength={3}
            disabled={isEdit}
          />
          {isEdit && (
            <p className="-mt-3 text-xs text-[var(--text-muted)]">
              The code is fixed once the currency exists.
            </p>
          )}
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            placeholder="US Dollar"
          />
          <Input
            label="Symbol"
            value={form.symbol}
            onChange={(e) => set('symbol', e.target.value)}
            placeholder="$"
          />
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Display
          </h3>
          <Input
            label="Decimal places"
            type="number"
            min={0}
            max={6}
            step={1}
            value={form.decimalPlaces}
            onChange={(e) => set('decimalPlaces', e.target.value)}
            error={errors.decimalPlaces}
            placeholder="2"
          />
          <Select
            label="Symbol position"
            value={form.symbolPosition}
            onChange={(e) => set('symbolPosition', e.target.value as SymbolPosition)}
            options={[
              { value: 'before', label: `Before the amount — ${form.symbol || '$'}100` },
              { value: 'after', label: `After the amount — 100${form.symbol || '$'}` },
            ]}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Local currency
          </h3>
          <Select
            label="Is this the company's local currency?"
            value={form.isBase ? 'yes' : 'no'}
            onChange={(e) => set('isBase', e.target.value === 'yes')}
            options={[
              { value: 'no', label: 'No — it converts against the local currency' },
              { value: 'yes', label: 'Yes — everything else converts against it' },
            ]}
          />
          {form.isBase && (
            <p className="-mt-2 text-xs text-[var(--text-muted)]">
              Only one currency can be local. Setting this one takes the flag off the current one.
            </p>
          )}
        </section>

        {!form.isBase && (
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
              Exchange rate
            </h3>
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
              {isEdit
                ? 'Leave the rate blank to keep the current one. A new rate applies to every item straight away and is added to this currency’s history — it never overwrites a past rate.'
                : 'The rate applies to every item straight away and is kept as the first entry in this currency’s history.'}
            </p>
          </section>
        )}
      </div>
    </SideDrawer>
  )
}
