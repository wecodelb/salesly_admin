import { useState } from 'react'
import { Modal } from '@/shared/components/Modal/Modal'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { useOrderActions } from '../hooks/use-orders'
import { serverMessage } from '../orders-logic'
import type { Order } from '../types'

interface Props {
  order: Order | null
  open: boolean
  onClose: () => void
  /** After the rejection is saved, so the drawer behind can close too. */
  onRejected?: () => void
}

/** Turning an order down. The reason is required: it is what the salesman reads on his phone. */
export function RejectOrderModal({ order, open, onClose, onRejected }: Props) {
  const { reject } = useOrderActions()
  const toast = useToast()
  const [reason, setReason] = useState('')

  const submit = async () => {
    if (!order) return
    try {
      await reject.mutateAsync({ id: order.id, reason: reason.trim() })
      toast.success(`Order ${order.trs_number} rejected`)
      setReason('')
      onClose()
      onRejected?.()
    } catch (error) {
      toast.error('Not done', serverMessage(error))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject this order"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button variant="danger" disabled={!reason.trim()} loading={reject.isPending} onClick={submit}>
            Reject order
          </Button>
        </div>
      }
    >
      <label className="block text-sm text-[var(--text-secondary)]">
        The salesman reads this on his phone.
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="e.g. The shop must pay its open invoices first."
          className="mt-2 w-full rounded-[var(--radius-btn)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-sm text-[var(--text-primary)]"
        />
      </label>
    </Modal>
  )
}
