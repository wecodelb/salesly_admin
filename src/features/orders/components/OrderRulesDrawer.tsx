import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { useOrderRules, useSaveOrderRules } from '../hooks/use-orders'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * The company's approval rules. An order that passes them is approved the
 * moment it is taken; one that does not waits on the Orders screen with the
 * reasons. Leaving a field empty switches that rule off.
 */
export function OrderRulesDrawer({ open, onClose }: Props) {
  const { data: rules, isLoading } = useOrderRules(open)
  const save = useSaveOrderRules()
  const toast = useToast()

  const [autoApprove, setAutoApprove] = useState(true)
  const [maxTotal, setMaxTotal] = useState('')
  const [overdueDays, setOverdueDays] = useState('')

  useEffect(() => {
    if (!open || !rules) return
    setAutoApprove(rules.auto_approve)
    setMaxTotal(rules.max_auto_approve_total == null ? '' : String(rules.max_auto_approve_total))
    setOverdueDays(rules.overdue_days == null ? '' : String(rules.overdue_days))
  }, [open, rules])

  const submit = async () => {
    try {
      await save.mutateAsync({
        auto_approve: autoApprove,
        max_auto_approve_total: maxTotal.trim() === '' ? null : Number(maxTotal),
        overdue_days: overdueDays.trim() === '' ? null : Number(overdueDays),
      })
      toast.success('Approval rules saved')
      onClose()
    } catch {
      toast.error('Not saved', 'Check the values and try again.')
    }
  }

  const input = 'mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]'

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Order approval rules"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button loading={save.isPending} disabled={isLoading || !rules} onClick={submit}>Save rules</Button>
        </div>
      }
    >
      {isLoading || !rules ? (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
      <div className="space-y-5 text-sm">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#0A3D8F]"
          />
          <span>
            <span className="font-semibold text-[var(--text-primary)]">Approve automatically</span>
            <span className="block text-xs text-[var(--text-muted)]">
              Orders that pass the rules below are approved as they are taken. Off: every order waits for a manager.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="font-semibold text-[var(--text-primary)]">Maximum order value</span>
          <span className="block text-xs text-[var(--text-muted)]">Orders worth more than this wait. Empty: no cap.</span>
          <input type="number" min={0} step="0.01" value={maxTotal} onChange={(e) => setMaxTotal(e.target.value)} placeholder="No cap" className={input} />
        </label>

        <label className="block">
          <span className="font-semibold text-[var(--text-primary)]">Unpaid invoice older than (days)</span>
          <span className="block text-xs text-[var(--text-muted)]">
            A shop with an invoice unpaid longer than this has its new orders held. Empty: off.
          </span>
          <input type="number" min={1} step="1" value={overdueDays} onChange={(e) => setOverdueDays(e.target.value)} placeholder="Off" className={input} />
        </label>

        <p className="rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] p-3 text-xs text-[var(--text-muted)]">
          Always checked as well: whether the warehouse has the stock. The credit limit is not an approval rule — an
          order is a promise, not a debt. It is checked at delivery, when the salesman puts part of the invoice on account.
        </p>
      </div>
      )}
    </SideDrawer>
  )
}
