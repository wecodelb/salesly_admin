import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { useCreateBrand, useUpdateBrand } from '../hooks/use-brands'
import type { Brand } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  brand?: Brand | null // null/undefined = create mode
}

interface FormState {
  code: string
  name: string
}

const EMPTY: FormState = { code: '', name: '' }

export function BrandFormDrawer({ open, onClose, brand }: Props) {
  const isEdit = !!brand
  const { run } = useActionProgress()
  const createBrand = useCreateBrand()
  const updateBrand = useUpdateBrand()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(brand ? { code: brand.code ?? '', name: brand.name } : EMPTY)
    setErrors({})
  }, [open, brand])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
    }

    const saved = await run(
      {
        label: isEdit ? 'Saving brand' : 'Creating brand',
        detail: payload.name,
        success: `${payload.name} has been saved.`,
      },
      async () => {
        if (isEdit && brand) await updateBrand.mutateAsync({ id: brand.id, payload })
        else await createBrand.mutateAsync(payload)
        return true
      },
    )

    if (saved !== null) onClose()
  }

  const saving = createBrand.isPending || updateBrand.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit brand' : 'New brand'}
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create brand'}
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
          placeholder="Nestlé"
        />
        <Input
          label="Code (optional)"
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          error={errors.code}
          placeholder="NST"
        />
        <p className="text-xs text-[var(--text-muted)]">
          A short code makes the brand easier to spot in product lists and imports.
        </p>
      </div>
    </SideDrawer>
  )
}
