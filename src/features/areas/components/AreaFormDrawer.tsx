import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { useCreateArea, useUpdateArea } from '../hooks/use-areas'
import type { Area, UpdateAreaPayload } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  area?: Area | null // null/undefined = create mode
}

interface FormState {
  name: string
  code: string
}

const EMPTY: FormState = { name: '', code: '' }

export function AreaFormDrawer({ open, onClose, area }: Props) {
  const isEdit = !!area
  const { run } = useActionProgress()
  const createArea = useCreateArea()
  const updateArea = useUpdateArea()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(area ? { name: area.name, code: area.code } : EMPTY)
    setErrors({})
  }, [open, area])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.code.trim()) e.code = 'Code is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const name = form.name.trim()
    const code = form.code.trim()

    // Only what actually moved goes up, so an untouched code is never
    // re-submitted against the per-company uniqueness rule.
    const payload: UpdateAreaPayload = {}
    if (isEdit && area) {
      if (name !== area.name) payload.name = name
      if (code !== area.code) payload.code = code
      if (Object.keys(payload).length === 0) {
        onClose()
        return
      }
    }

    const saved = await run(
      {
        label: isEdit ? 'Saving area' : 'Creating area',
        detail: name,
        success: `${name} has been saved.`,
      },
      () =>
        isEdit && area
          ? updateArea.mutateAsync({ id: area.id, payload })
          : createArea.mutateAsync({ name, code }),
    )

    if (saved !== null) onClose()
  }

  const saving = createArea.isPending || updateArea.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit area' : 'New area'}
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create area'}
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
          placeholder="Beirut North"
        />
        <Input
          label="Code"
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          error={errors.code}
          placeholder="BEI-N"
        />
        <p className="-mt-2 text-xs text-[var(--text-muted)]">
          The code is the short tag used on routes and reports. It has to be unique across your
          company, and can be changed later.
        </p>
      </div>
    </SideDrawer>
  )
}
