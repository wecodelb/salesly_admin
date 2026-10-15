import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { useCustomers, useSalesmen } from '@/features/customers/hooks/use-customers'
import { useVisitPlanActions } from '../hooks/use-routes'
import { WEEKDAYS, toggleWeekday } from '../routes-logic'
import type { VisitPlan } from '../types'

interface Props {
  open: boolean
  /** The plan being changed; null plans a new customer. */
  plan: VisitPlan | null
  onClose: () => void
}

function messageOf(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string; data?: Record<string, string[]> } } })?.response?.data
  const first = data?.data ? Object.values(data.data).flat()[0] : undefined
  return first ?? data?.message ?? 'Something went wrong.'
}

/**
 * Plan when a customer is visited. The salesman defaults to the one whose book
 * the customer is in; choosing another moves the shop onto his round. The
 * weeks are counted from the week of "starting", so "every 2 weeks" from this
 * week and from next week are the two alternating halves of a round.
 */
export function VisitPlanDrawer({ open, plan, onClose }: Props) {
  const customers = useCustomers()
  const salesmen = useSalesmen()
  const { save } = useVisitPlanActions()
  const toast = useToast()

  const [customerId, setCustomerId] = useState('')
  const [salesmanId, setSalesmanId] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [everyWeeks, setEveryWeeks] = useState(1)
  const [startsOn, setStartsOn] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setCustomerId(plan ? String(plan.customer.id) : '')
    setSalesmanId(plan?.salesman.id ? String(plan.salesman.id) : '')
    setWeekdays(plan?.weekdays ?? [])
    setEveryWeeks(plan?.every_weeks ?? 1)
    setStartsOn(plan?.starts_on ?? '')
    setActive(plan?.is_active ?? true)
  }, [open, plan])

  // A new customer picked: their own salesman, unless one was already chosen.
  const pickCustomer = (value: string) => {
    setCustomerId(value)
    const owner = customers.data?.find((c) => String(c.id) === value)?.salesman_id
    if (!salesmanId && owner) setSalesmanId(String(owner))
  }

  const submit = async () => {
    try {
      await save.mutateAsync({
        customer_id: Number(customerId),
        salesman_id: salesmanId ? Number(salesmanId) : null,
        weekdays,
        every_weeks: everyWeeks,
        starts_on: startsOn || null,
        is_active: active,
      })
      toast.success('Visit plan saved')
      onClose()
    } catch (error) {
      toast.error('Not saved', messageOf(error))
    }
  }

  const input = 'mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]'

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={plan ? `Visits to ${plan.customer.name ?? 'customer'}` : 'Plan a customer'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button loading={save.isPending} disabled={!customerId || weekdays.length === 0} onClick={submit}>
            Save plan
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {!plan && (
          <SearchableSelect
            label="Customer"
            value={customerId}
            onChange={pickCustomer}
            options={(customers.data ?? []).map((c) => ({ value: String(c.id), label: `${c.name}${c.code ? ` · ${c.code}` : ''}` }))}
            placeholder="Choose a customer"
            searchPlaceholder="Name or code"
          />
        )}

        <SearchableSelect
          label="Salesman"
          value={salesmanId}
          onChange={setSalesmanId}
          options={(salesmen.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
          placeholder="The customer's own salesman"
        />

        <fieldset>
          <legend className="font-semibold text-[var(--text-primary)]">Visit on</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = weekdays.includes(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setWeekdays(toggleWeekday(weekdays, d.value))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    on
                      ? 'border-[#0A3D8F] bg-[#0A3D8F] text-white'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                  }`}
                >
                  {d.short}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-semibold text-[var(--text-primary)]">Every</span>
            <select value={everyWeeks} onChange={(e) => setEveryWeeks(Number(e.target.value))} className={input}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'week' : `${n} weeks`}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-semibold text-[var(--text-primary)]">Starting</span>
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={input} />
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#0A3D8F]" />
          <span className="text-[var(--text-primary)]">Active — paused plans keep their days but show on no route</span>
        </label>
      </div>
    </SideDrawer>
  )
}
