import { useState } from 'react'
import { Modal } from '@/shared/components/Modal/Modal'
import { Button } from '@/shared/components/Button'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { useToast } from '@/shared/hooks/use-toast'
import { apiErrorMessage } from '@/features/users/hooks/use-users'
import { usePriceLists } from '@/features/price-lists/hooks/use-price-lists'
import { useAssignPriceList } from '../hooks/use-customers'
import type { AdminCustomer } from '../types'

interface Props {
  customer: AdminCustomer | null
  onClose: () => void
}

/** Assign an existing price list to a customer — the customer-side entry
 *  point for the same relationship a price list's "Add customers" panel
 *  manages from the other direction. */
export function AssignPriceListModal({ customer, onClose }: Props) {
  const toast = useToast()
  const { data: priceLists = [] } = usePriceLists()
  const assign = useAssignPriceList()
  const [priceListId, setPriceListId] = useState('')

  const alreadyAssigned = new Set((customer?.price_lists ?? []).map((l) => l.id))
  const options = priceLists
    .filter((l) => !alreadyAssigned.has(l.id))
    .map((l) => ({ value: String(l.id), label: l.is_default ? `${l.name} (default)` : l.name }))

  const submit = () => {
    if (!customer || !priceListId) return
    assign.mutate(
      { customerId: customer.id, priceListId: Number(priceListId) },
      {
        onSuccess: () => {
          toast.success('Price list assigned', `${customer.name} now benefits from this list.`)
          setPriceListId('')
          onClose()
        },
        onError: (err) => toast.error('Assign failed', apiErrorMessage(err)),
      },
    )
  }

  return (
    <Modal
      open={!!customer}
      onClose={onClose}
      title="Assign price list"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={assign.isPending} disabled={!priceListId} onClick={submit}>
            Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Give{' '}
          <span className="font-medium text-[var(--text-primary)]">{customer?.name}</span> special
          pricing from an existing list. This is on top of the company's default list.
        </p>
        <SearchableSelect
          label="Price list"
          value={priceListId}
          onChange={setPriceListId}
          options={options}
          placeholder={options.length ? 'Select a price list' : 'No more lists to assign'}
          searchPlaceholder="Search price lists…"
        />
      </div>
    </Modal>
  )
}
