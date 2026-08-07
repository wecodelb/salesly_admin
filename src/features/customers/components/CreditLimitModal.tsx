import { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import { Modal } from '@/shared/components/Modal/Modal'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { useSetCreditLimit } from '../hooks/use-customers'
import { formatMoney, type AdminCustomer } from '../types'

interface Props {
  customer: AdminCustomer | null
  onClose: () => void
}

/** Set (or clear) a customer's credit limit. The Flutter app flags the
 *  customer "over limit" when the balance exceeds it. */
export function CreditLimitModal({ customer, onClose }: Props) {
  const { run } = useActionProgress()
  const setLimit = useSetCreditLimit()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setValue(customer?.credit_limit != null ? String(customer.credit_limit) : '')
    setError('')
  }, [customer])

  const submit = async () => {
    if (!customer) return
    const trimmed = value.trim()
    const creditLimit = trimmed === '' ? null : Number(trimmed)
    if (creditLimit !== null && (Number.isNaN(creditLimit) || creditLimit < 0)) {
      setError('Enter a positive amount, or leave empty for no limit.')
      return
    }
    // Closed first so the modal isn't left stacked under the progress dialog.
    onClose()
    await run(
      {
        label: 'Setting credit limit',
        detail: customer.name,
        success:
          creditLimit === null
            ? `${customer.name} has no credit limit now.`
            : `${customer.name} is capped at ${formatMoney(creditLimit)}.`,
      },
      () => setLimit.mutateAsync({ id: customer.id, creditLimit }),
    )
  }

  return (
    <Modal
      open={!!customer}
      onClose={onClose}
      title="Set credit limit"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={setLimit.isPending} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Maximum outstanding balance allowed for{' '}
          <span className="font-medium text-[var(--text-primary)]">{customer?.name}</span>. Leave
          empty for no limit. Current balance:{' '}
          <span className="font-mono font-medium text-[var(--text-primary)]">
            {customer ? formatMoney(customer.balance) : '—'}
          </span>
        </p>
        <Input
          label="Credit limit"
          type="number"
          min={0}
          step="any"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          leftIcon={<DollarSign size={15} />}
          placeholder="No limit"
          error={error || undefined}
        />
      </div>
    </Modal>
  )
}
