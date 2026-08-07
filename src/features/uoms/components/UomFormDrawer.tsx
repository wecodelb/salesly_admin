import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { useCreateUom, useUpdateUom } from '../hooks/use-uoms'
import type { UpdateUomPayload, Uom } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  uom?: Uom | null // null/undefined = create mode
}

interface FormState {
  code: string
  name: string
}

const EMPTY: FormState = { code: '', name: '' }

export function UomFormDrawer({ open, onClose, uom }: Props) {
  const isEdit = !!uom
  const { run } = useActionProgress()
  const createUom = useCreateUom()
  const updateUom = useUpdateUom()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(uom ? { code: uom.code, name: uom.name } : EMPTY)
    setErrors({})
  }, [open, uom])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Code is required'
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const code = form.code.trim()
    const name = form.name.trim()

    const payload: UpdateUomPayload = {}
    if (isEdit && uom) {
      if (code !== uom.code) payload.code = code
      if (name !== uom.name) payload.name = name
      // Nothing actually changed — skip the round trip.
      if (Object.keys(payload).length === 0) {
        onClose()
        return
      }
    }

    const saved = await run(
      {
        label: isEdit ? 'Saving unit' : 'Creating unit',
        detail: name,
        success: `${name} has been saved.`,
      },
      async () => {
        if (isEdit && uom) await updateUom.mutateAsync({ id: uom.id, payload })
        else await createUom.mutateAsync({ code, name })
        return true
      },
    )

    if (saved !== null) onClose()
  }

  const saving = createUom.isPending || updateUom.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit unit' : 'New unit'}
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create unit'}
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
          placeholder="Piece"
        />
        <Input
          label="Code"
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          error={errors.code}
          placeholder="PCS"
        />
        <p className="-mt-1 text-xs text-[var(--text-muted)]">
          The code is the short label shown on price lists and invoices. It has to be unique across
          your units.
        </p>
      </div>
    </SideDrawer>
  )
}
