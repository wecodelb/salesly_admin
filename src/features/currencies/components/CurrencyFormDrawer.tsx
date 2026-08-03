import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { useCreateCurrency, useUpdateCurrency } from '../hooks/use-currencies'
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
}

interface FormState {
  code: string
  name: string
  symbol: string
  decimalPlaces: string
  symbolPosition: SymbolPosition
  isBase: boolean
}

const EMPTY: FormState = {
  code: '',
  name: '',
  symbol: '',
  decimalPlaces: '2',
  symbolPosition: 'before',
  isBase: false,
}

export function CurrencyFormDrawer({ open, onClose, currency }: Props) {
  const isEdit = !!currency
  const { run } = useActionProgress()
  const createCurrency = useCreateCurrency()
  const updateCurrency = useUpdateCurrency()

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
      })
    } else {
      setForm(EMPTY)
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
        if (isEdit && currency) {
          await updateCurrency.mutateAsync({
            id: currency.id,
            payload: shared as UpdateCurrencyPayload,
          })
          return currency.id
        }

        const created = await createCurrency.mutateAsync({
          ...shared,
          code: form.code.trim().toUpperCase(),
        } as CreateCurrencyPayload)
        return created.id
      },
    )

    if (saved !== null) onClose()
  }

  const saving = createCurrency.isPending || updateCurrency.isPending

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
          // Rates live in their own section on the Currencies screen, not in
          // here: a rate is a dated entry in a history that keeps growing,
          // while this drawer describes what the currency *is* — one is edited
          // once in a while, the other every time the market moves.
          <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border-default)] pt-4">
            Exchange rates are set in the Exchange rates panel on the Currencies screen, where each
            new rate is added to this currency’s history.
          </p>
        )}
      </div>
    </SideDrawer>
  )
}
