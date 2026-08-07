import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { useCreateCustomerGroup, useUpdateCustomerGroup } from '../hooks/use-customer-groups'
import type { CustomerGroup, UpdateCustomerGroupPayload } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  group?: CustomerGroup | null // null/undefined = create mode
  /** Position pre-filled on create — the end of the current list. */
  nextOrder?: number
}

interface FormState {
  name: string
  order: string
}

const EMPTY: FormState = { name: '', order: '' }

export function CustomerGroupFormDrawer({ open, onClose, group, nextOrder }: Props) {
  const isEdit = !!group
  const { run } = useActionProgress()
  const createGroup = useCreateCustomerGroup()
  const updateGroup = useUpdateCustomerGroup()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(
      group
        ? { name: group.name, order: String(group.sort_order) }
        : { ...EMPTY, order: nextOrder !== undefined ? String(nextOrder) : '' },
    )
    setErrors({})
  }, [open, group, nextOrder])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (form.order.trim() !== '') {
      const n = Number(form.order)
      if (!Number.isInteger(n) || n < 0) e.order = 'Order must be a whole number, 0 or more'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const name = form.name.trim()
    // Left blank on create, the backend appends it to the end of the list.
    const order = form.order.trim() === '' ? undefined : Number(form.order)

    const payload: UpdateCustomerGroupPayload = { name, ...(order !== undefined ? { sort_order: order } : {}) }

    const saved = await run(
      {
        label: isEdit ? 'Saving group' : 'Creating group',
        detail: name,
        success: `${name} has been saved.`,
      },
      async () => {
        if (isEdit && group) await updateGroup.mutateAsync({ id: group.id, payload })
        else await createGroup.mutateAsync({ name, ...(order !== undefined ? { sort_order: order } : {}) })
        return true
      },
    )

    if (saved !== null) onClose()
  }

  const saving = createGroup.isPending || updateGroup.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit customer group' : 'New customer group'}
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create group'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          placeholder="VIP"
        />
        <Input
          label="Order"
          type="number"
          min={0}
          step={1}
          value={form.order}
          onChange={(e) => set('order', e.target.value)}
          error={errors.order}
          placeholder="1"
        />
        <p className="-mt-2 text-xs text-[var(--text-muted)]">
          The order decides where this group sits in every list and picker — 1 comes first. Two
          groups sharing a number fall back to alphabetical.
        </p>
      </div>
    </SideDrawer>
  )
}
