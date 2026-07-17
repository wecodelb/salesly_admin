import { useEffect, useState } from 'react'
import { Modal } from '@/shared/components/Modal/Modal'
import { Button } from '@/shared/components/Button'
import { Select } from '@/shared/components/Select'
import { useToast } from '@/shared/hooks/use-toast'
import { apiErrorMessage } from '@/features/users/hooks/use-users'
import { useAssignSalesman, useSalesmen } from '../hooks/use-customers'
import type { AdminCustomer } from '../types'

interface Props {
  customer: AdminCustomer | null
  onClose: () => void
}

/** Assign (or unassign) a customer to a salesman. Assignment is what makes
 *  the customer appear in that salesman's Flutter app. */
export function AssignSalesmanModal({ customer, onClose }: Props) {
  const toast = useToast()
  const { data: salesmen = [], isLoading } = useSalesmen()
  const assign = useAssignSalesman()
  const [selected, setSelected] = useState('')

  useEffect(() => {
    setSelected(customer?.salesman_id ? String(customer.salesman_id) : '')
  }, [customer])

  const submit = () => {
    if (!customer) return
    const salesmanId = selected ? Number(selected) : null
    const salesmanName = salesmen.find((s) => s.id === salesmanId)?.name
    assign.mutate(
      { id: customer.id, salesmanId },
      {
        onSuccess: () => {
          toast.success(
            salesmanId ? 'Customer assigned' : 'Customer unassigned',
            salesmanId
              ? `${customer.name} now appears in ${salesmanName}'s app.`
              : `${customer.name} is no longer assigned to a salesman.`,
          )
          onClose()
        },
        onError: (err) => toast.error('Assignment failed', apiErrorMessage(err)),
      },
    )
  }

  return (
    <Modal
      open={!!customer}
      onClose={onClose}
      title="Assign salesman"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={assign.isPending} onClick={submit}>
            {selected ? 'Assign' : 'Unassign'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Choose who works{' '}
          <span className="font-medium text-[var(--text-primary)]">{customer?.name}</span>. The
          customer appears in that salesman's mobile app under "My customers".
        </p>
        <Select
          label="Salesman"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          placeholder={isLoading ? 'Loading salesmen…' : 'Unassigned'}
          options={salesmen.map((s) => ({ value: String(s.id), label: s.name }))}
        />
      </div>
    </Modal>
  )
}
