import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { useProducts } from '@/features/products/hooks/use-products'
import {
  useCreatePriceList,
  usePriceList,
  useUpdatePriceList,
} from '../hooks/use-price-lists'
import type { CreatePriceListPayload, PriceList, UpdatePriceListPayload } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  priceList?: PriceList | null
}

interface Row {
  itemId: string
  price: string
}

export function PriceListFormDrawer({ open, onClose, priceList }: Props) {
  const isEdit = !!priceList
  const { run } = useActionProgress()
  const { data: products = [] } = useProducts()
  // On edit, pull the detail (with override rows) to seed the form.
  const { data: detail } = usePriceList(open && priceList ? priceList.id : null)
  const createPriceList = useCreatePriceList()
  const updatePriceList = useUpdatePriceList()

  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    if (priceList) {
      setName(priceList.name)
      setIsDefault(priceList.is_default)
      setIsActive(priceList.is_active)
    } else {
      setName('')
      setIsDefault(false)
      setIsActive(true)
      setRows([])
    }
    setErrors({})
  }, [open, priceList])

  // Seed override rows once the detail resolves (edit mode).
  useEffect(() => {
    if (open && detail?.items) {
      setRows(detail.items.map((r) => ({ itemId: String(r.item_id), price: String(r.price) })))
    }
  }, [open, detail])

  const addRow = () => setRows((r) => [...r, { itemId: '', price: '' }])
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const setRow = (i: number, key: keyof Row, val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    rows.forEach((row, i) => {
      if (!row.itemId) e[`row-${i}-item`] = 'Choose a product'
      if (row.price === '' || Number.isNaN(Number(row.price)) || Number(row.price) < 0)
        e[`row-${i}-price`] = 'Invalid price'
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const items = rows
      .filter((r) => r.itemId)
      .map((r) => ({ item_id: Number(r.itemId), price: Number(r.price) }))

    const base = {
      name: name.trim(),
      is_default: isDefault,
      is_active: isActive,
      items,
    }

    const saved =
      isEdit && priceList
        ? await run(
            { label: 'Saving price list', detail: name, success: `${name} has been saved.` },
            () =>
              updatePriceList.mutateAsync({
                id: priceList.id,
                payload: base as UpdatePriceListPayload,
              }),
          )
        : await run(
            { label: 'Creating price list', detail: name, success: `${name} is ready to assign.` },
            () => createPriceList.mutateAsync(base as CreatePriceListPayload),
          )

    if (saved !== null) onClose()
  }

  const saving = createPriceList.isPending || updatePriceList.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit price list' : 'New price list'}
      width="w-[560px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create price list'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="VIP Wholesale"
          />
          <Select
            label="Default list — applies to any customer with none of their own"
            value={isDefault ? 'yes' : 'no'}
            onChange={(e) => setIsDefault(e.target.value === 'yes')}
            options={[
              { value: 'no', label: 'No — attach it to specific customers instead' },
              { value: 'yes', label: 'Yes — make this the company default' },
            ]}
          />
          <Select
            label="Status"
            value={isActive ? 'active' : 'inactive'}
            onChange={(e) => setIsActive(e.target.value === 'active')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
              Price overrides
            </h3>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              <Plus size={13} /> Add product
            </button>
          </div>

          {rows.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">
              No overrides yet — add a product and its special USD price for this list.
            </p>
          )}

          {rows.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  value={row.itemId}
                  onChange={(e) => setRow(i, 'itemId', e.target.value)}
                  error={errors[`row-${i}-item`]}
                  placeholder="Select a product"
                  options={products.map((p) => ({
                    value: String(p.id),
                    label: `${p.name} (${p.code})`,
                  }))}
                />
              </div>
              <div className="w-28">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={row.price}
                  onChange={(e) => setRow(i, 'price', e.target.value)}
                  error={errors[`row-${i}-price`]}
                  placeholder="USD"
                />
              </div>
              <button
                type="button"
                title="Remove"
                onClick={() => removeRow(i)}
                className="mb-1 p-2 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
      </div>
    </SideDrawer>
  )
}
