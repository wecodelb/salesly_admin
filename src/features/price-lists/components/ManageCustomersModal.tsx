import { useState } from 'react'
import { X } from 'lucide-react'
import { Modal } from '@/shared/components/Modal/Modal'
import { Button } from '@/shared/components/Button'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { useToast } from '@/shared/hooks/use-toast'
import { apiErrorMessage } from '@/features/users/hooks/use-users'
import { useAssignPriceList, useUnassignPriceList } from '@/features/customers/hooks/use-customers'
import { useCustomerOptions } from '../hooks/use-price-lists'
import type { PriceList } from '../types'

interface Props {
  priceList: PriceList | null
  onClose: () => void
}

/** View + manage the customers benefiting from one price list — the mirror
 *  image of a customer's "Assign price list" action, from this side. */
export function ManageCustomersModal({ priceList, onClose }: Props) {
  const toast = useToast()
  const { data: customerOptions = [] } = useCustomerOptions()
  const assign = useAssignPriceList()
  const unassign = useUnassignPriceList()
  const [addingId, setAddingId] = useState('')

  const assigned = priceList?.customers ?? []
  const assignedIds = new Set(assigned.map((c) => c.id))
  const options = customerOptions
    .filter((c) => !assignedIds.has(c.id))
    .map((c) => ({ value: String(c.id), label: c.name }))

  const addCustomer = () => {
    if (!priceList || !addingId) return
    assign.mutate(
      { customerId: Number(addingId), priceListId: priceList.id },
      {
        onSuccess: () => {
          toast.success('Customer added', 'They now benefit from this list.')
          setAddingId('')
        },
        onError: (err) => toast.error('Add failed', apiErrorMessage(err)),
      },
    )
  }

  const removeCustomer = (customerId: number, name: string) => {
    if (!priceList) return
    unassign.mutate(
      { customerId, priceListId: priceList.id },
      {
        onSuccess: () => toast.success('Customer removed', `${name} no longer benefits from this list.`),
        onError: (err) => toast.error('Remove failed', apiErrorMessage(err)),
      },
    )
  }

  return (
    <Modal
      open={!!priceList}
      onClose={onClose}
      title={priceList ? `Customers — ${priceList.name}` : 'Customers'}
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SearchableSelect
              label="Add a customer"
              value={addingId}
              onChange={setAddingId}
              options={options}
              placeholder={options.length ? 'Select a customer' : 'All customers already added'}
              searchPlaceholder="Search customers…"
            />
          </div>
          <Button onClick={addCustomer} disabled={!addingId} loading={assign.isPending}>
            Add
          </Button>
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
            Currently benefiting ({assigned.length})
          </p>
          {assigned.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No customers assigned yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {assigned.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-btn)] border border-[var(--border-subtle)] px-3 py-2"
                >
                  <span className="text-sm text-[var(--text-primary)]">{c.name}</span>
                  <button
                    title="Remove"
                    onClick={() => removeCustomer(c.id, c.name)}
                    className="p-1 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
