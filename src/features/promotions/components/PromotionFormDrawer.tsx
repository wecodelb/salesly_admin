import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { useCategories, useProducts } from '@/features/products/hooks/use-products'
import { useCreatePromotion, useUpdatePromotion } from '../hooks/use-promotions'
import type { CreatePromotionPayload, Promotion, UpdatePromotionPayload } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  promotion?: Promotion | null
}

type Target = 'all' | 'item' | 'category'

interface FormState {
  name: string
  type: 'percent' | 'amount'
  value: string
  target: Target
  itemId: string
  categoryId: string
  startsAt: string
  endsAt: string
  isActive: boolean
}

const EMPTY: FormState = {
  name: '',
  type: 'percent',
  value: '',
  target: 'all',
  itemId: '',
  categoryId: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
}

export function PromotionFormDrawer({ open, onClose, promotion }: Props) {
  const isEdit = !!promotion
  const { run } = useActionProgress()
  const { data: products = [] } = useProducts()
  const { data: categories = [] } = useCategories()
  const createPromotion = useCreatePromotion()
  const updatePromotion = useUpdatePromotion()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    if (promotion) {
      setForm({
        name: promotion.name,
        type: promotion.type,
        value: String(promotion.value),
        target: promotion.item_id ? 'item' : promotion.category_id ? 'category' : 'all',
        itemId: promotion.item_id != null ? String(promotion.item_id) : '',
        categoryId: promotion.category_id != null ? String(promotion.category_id) : '',
        startsAt: promotion.starts_at ?? '',
        endsAt: promotion.ends_at ?? '',
        isActive: promotion.is_active,
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, promotion])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    const v = Number(form.value)
    if (form.value === '' || Number.isNaN(v) || v <= 0) e.value = 'Enter a positive discount'
    if (form.type === 'percent' && v > 100) e.value = 'A percentage cannot exceed 100'
    if (form.target === 'item' && !form.itemId) e.itemId = 'Choose an item'
    if (form.target === 'category' && !form.categoryId) e.categoryId = 'Choose a category'
    if (form.startsAt && form.endsAt && form.endsAt < form.startsAt)
      e.endsAt = 'End date is before the start date'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const base = {
      name: form.name.trim() || undefined,
      type: form.type,
      value: Number(form.value),
      item_id: form.target === 'item' ? Number(form.itemId) : null,
      category_id: form.target === 'category' ? Number(form.categoryId) : null,
      starts_at: form.startsAt || null,
      ends_at: form.endsAt || null,
      is_active: form.isActive,
    }

    const saved =
      isEdit && promotion
        ? await run(
            {
              label: 'Saving promotion',
              detail: base.name,
              success: 'Changes are live for the salesmen.',
            },
            () =>
              updatePromotion.mutateAsync({
                id: promotion.id,
                payload: base as UpdatePromotionPayload,
              }),
          )
        : await run(
            {
              label: 'Creating promotion',
              detail: base.name,
              success: 'Salesmen will see it in the app.',
            },
            () => createPromotion.mutateAsync(base as CreatePromotionPayload),
          )

    if (saved !== null) onClose()
  }

  const saving = createPromotion.isPending || updatePromotion.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit promotion' : 'New promotion'}
      width="w-[520px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create promotion'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4">
          <Input
            label="Name (optional)"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Summer sale"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Discount type"
              value={form.type}
              onChange={(e) => set('type', e.target.value as 'percent' | 'amount')}
              options={[
                { value: 'percent', label: 'Percentage (%)' },
                { value: 'amount', label: 'Flat amount ($)' },
              ]}
            />
            <Input
              label={form.type === 'percent' ? 'Percent off' : 'Amount off (USD)'}
              type="number"
              min={0}
              step="any"
              value={form.value}
              onChange={(e) => set('value', e.target.value)}
              error={errors.value}
              placeholder={form.type === 'percent' ? '10' : '0.50'}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Applies to
          </h3>
          <Select
            label="Target"
            value={form.target}
            onChange={(e) => set('target', e.target.value as Target)}
            options={[
              { value: 'all', label: 'All products' },
              { value: 'item', label: 'A specific product' },
              { value: 'category', label: 'A whole category' },
            ]}
          />
          {form.target === 'item' && (
            <Select
              label="Product"
              value={form.itemId}
              onChange={(e) => set('itemId', e.target.value)}
              error={errors.itemId}
              placeholder="Select a product"
              options={products.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))}
            />
          )}
          {form.target === 'category' && (
            <Select
              label="Category"
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
              error={errors.categoryId}
              placeholder="Select a category"
              options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            />
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Window
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Starts (optional)"
              type="date"
              value={form.startsAt}
              onChange={(e) => set('startsAt', e.target.value)}
            />
            <Input
              label="Ends (optional)"
              type="date"
              value={form.endsAt}
              onChange={(e) => set('endsAt', e.target.value)}
              error={errors.endsAt}
            />
          </div>
          <Select
            label="Status"
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(e) => set('isActive', e.target.value === 'active')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </section>
      </div>
    </SideDrawer>
  )
}
