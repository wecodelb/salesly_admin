import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { apiErrorMessage } from '@/features/users/hooks/use-users'
import { useCreateCategory, useUpdateCategory } from '../hooks/use-categories'
import type { Category, UpdateCategoryPayload } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  category?: Category | null // null/undefined = create mode
}

interface FormState {
  name: string
  code: string
}

const EMPTY: FormState = { name: '', code: '' }

export function CategoryFormDrawer({ open, onClose, category }: Props) {
  const isEdit = !!category
  const toast = useToast()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(category ? { name: category.name, code: category.code ?? '' } : EMPTY)
    setErrors({})
  }, [open, category])

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

    const name = form.name.trim()
    const code = form.code.trim()

    try {
      if (isEdit && category) {
        const payload: UpdateCategoryPayload = {}
        if (name !== category.name) payload.name = name
        if (code !== (category.code ?? '')) payload.code = code || null

        // Nothing typed over — skip the round trip rather than PATCH an empty body.
        if (Object.keys(payload).length === 0) {
          onClose()
          return
        }
        await updateCategory.mutateAsync({ id: category.id, payload })
      } else {
        await createCategory.mutateAsync({ name, ...(code ? { code } : {}) })
      }

      toast.success(isEdit ? 'Category updated' : 'Category created', `${name} has been saved.`)
      onClose()
    } catch (err) {
      toast.error(isEdit ? 'Update failed' : 'Create failed', apiErrorMessage(err))
    }
  }

  const saving = createCategory.isPending || updateCategory.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit category' : 'New category'}
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create category'}
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
          placeholder="Beverages"
        />
        <Input
          label="Code (optional)"
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          error={errors.code}
          placeholder="BEV"
        />
        <p className="text-xs text-[var(--text-muted)]">
          Categories group products together — a product picks one when it's created or edited.
        </p>
      </div>
    </SideDrawer>
  )
}
