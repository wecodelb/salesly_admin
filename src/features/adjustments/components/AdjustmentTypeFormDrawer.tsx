import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { useCreateAdjustmentType, useUpdateAdjustmentType } from '../hooks/use-adjustments'
import type { AdjustmentDirection, AdjustmentType } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Absent means create. */
  type?: AdjustmentType | null
}

interface FormState {
  code: string
  name: string
  direction: AdjustmentDirection
  memo: string
}

const EMPTY: FormState = { code: '', name: '', direction: 'both', memo: '' }

const DIRECTIONS = [
  { value: 'out', label: 'Out only — stock leaves the shelf' },
  { value: 'in', label: 'In only — stock arrives' },
  { value: 'both', label: 'Either way — whoever writes the row decides' },
]

export function AdjustmentTypeFormDrawer({ open, onClose, type }: Props) {
  const isEdit = !!type
  const { run } = useActionProgress()
  const createType = useCreateAdjustmentType()
  const updateType = useUpdateAdjustmentType()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(
      type
        ? { code: type.code, name: type.name, direction: type.direction, memo: type.memo ?? '' }
        : EMPTY,
    )
    setErrors({})
  }, [open, type])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!isEdit && !form.code.trim()) e.code = 'Code is required'
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const name = form.name.trim()
    const memo = form.memo.trim()

    // On edit only what actually moved is sent — `code` is never sent at all,
    // because the server prohibits it and would refuse the whole save.
    const payload: Partial<AdjustmentType> = {}
    if (isEdit && type) {
      if (name !== type.name) payload.name = name
      if (form.direction !== type.direction) payload.direction = form.direction
      if (memo !== (type.memo ?? '')) payload.memo = memo
      if (Object.keys(payload).length === 0) {
        onClose()
        return
      }
    }

    const saved = await run(
      {
        label: isEdit ? 'Saving type' : 'Creating type',
        detail: name,
        success: `${name} has been saved.`,
      },
      async () => {
        if (isEdit && type) await updateType.mutateAsync({ id: type.id, payload })
        else
          await createType.mutateAsync({
            code: form.code.trim(),
            name,
            direction: form.direction,
            memo,
          })
        return true
      },
    )

    if (saved !== null) onClose()
  }

  const saving = createType.isPending || updateType.isPending
  const used = type?.rows_count ?? 0

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit adjustment type' : 'New adjustment type'}
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create type'}
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
          placeholder="Shrinkage"
        />

        <Input
          label="Code"
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          error={errors.code}
          placeholder="theft"
          disabled={isEdit}
        />
        <p className="-mt-1 text-xs text-[var(--text-muted)]">
          {isEdit
            ? 'The code is fixed once the type exists. Changing it after a year of history would split that history in two — half under the old code and half under the new.'
            : 'A short key used to group this type in reports. It has to be unique within your company.'}
        </p>

        <Select
          label="Direction"
          value={form.direction}
          onChange={(e) => set('direction', e.target.value as AdjustmentDirection)}
          options={DIRECTIONS}
        />
        <p className="-mt-1 text-xs text-[var(--text-muted)]">
          Which way stock is allowed to move under this heading. There is no such thing as damaged
          stock arriving, so Damaged is out only — and a type that offered the other way would be
          offering somebody a mistake.
        </p>

        {isEdit && used > 0 && (
          <p className="rounded-[var(--radius-btn)] bg-[var(--accent-amber)]/10 px-3 py-2 text-xs text-[var(--accent-amber)]">
            {used} {used === 1 ? 'row has' : 'rows have'} already been written under this type.
            Changing the direction does not rewrite them — it only governs what can be written next.
          </p>
        )}

        <Input
          label="Note"
          value={form.memo}
          onChange={(e) => set('memo', e.target.value)}
          placeholder="Optional — when to reach for this one"
        />
      </div>
    </SideDrawer>
  )
}
