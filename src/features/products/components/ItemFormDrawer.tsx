import { useEffect, useMemo, useState } from 'react'
import { Barcode, Boxes, DollarSign, Package, Plus, Trash2 } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { FormRow, FormSection } from '@/shared/components/FormSection/FormSection'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { SelectOrCreate } from '@/shared/components/SelectOrCreate/SelectOrCreate'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { ItemUomEditor } from './ItemUomEditor'
import {
  useBrands,
  useCategories,
  useCreateBrand,
  useCreateCategory,
  useCreateItem,
  useCurrencies,
  useUoms,
  useUpdateItem,
} from '../hooks/use-products'
import type {
  AdminItem,
  AdminItemUom,
  CreateItemPayload,
  UpdateItemPayload,
} from '../types'

interface Props {
  open: boolean
  onClose: () => void
  item?: AdminItem | null // null/undefined = create mode
}

interface FormState {
  code: string
  name: string
  categoryId: string
  brandId: string
  uomId: string
  weight: string
  volume: string
  barcodes: string[]
  currencyId: string
  price1: string
  price2: string
  price3: string
  cost: string
  variants: AdminItemUom[]
}

const EMPTY: FormState = {
  code: '',
  name: '',
  categoryId: '',
  brandId: '',
  uomId: '',
  weight: '',
  volume: '',
  // One line by default — a product almost always has at least one barcode.
  barcodes: [''],
  currencyId: '',
  price1: '',
  price2: '',
  price3: '',
  cost: '',
  variants: [],
}

export function ItemFormDrawer({ open, onClose, item }: Props) {
  const isEdit = !!item
  const { run } = useActionProgress()
  const { data: categories = [] } = useCategories()
  const { data: brands = [] } = useBrands()
  const { data: uoms = [] } = useUoms()
  const { data: currencies = [] } = useCurrencies()
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const createCategory = useCreateCategory()
  const createBrand = useCreateBrand()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    if (item) {
      setForm({
        code: item.code,
        name: item.name,
        categoryId: item.category_id != null ? String(item.category_id) : '',
        brandId: item.brand_id != null ? String(item.brand_id) : '',
        uomId: item.uom_id != null ? String(item.uom_id) : '',
        weight: item.weight != null ? String(item.weight) : '',
        volume: item.volume != null ? String(item.volume) : '',
        barcodes: item.barcodes?.length ? item.barcodes : [''],
        currencyId: item.currency_id != null ? String(item.currency_id) : '',
        price1: String(item.price_1 ?? item.price_usd ?? item.price ?? ''),
        price2: String(item.price_2 ?? ''),
        price3: String(item.price_3 ?? ''),
        cost: String(item.cost ?? ''),
        // Packaging only. The base variant mirrors the unit named at the top of
        // this form, so listing it here would show "Piece" as Packaging 1 and
        // invite somebody to edit the product's own unit through a row that
        // looks like an extra.
        variants: (item.uoms ?? []).filter((v) => !v.is_base),
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, item])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const addBarcode = () => set('barcodes', [...form.barcodes, ''])
  const removeBarcode = (i: number) =>
    set('barcodes', form.barcodes.filter((_, idx) => idx !== i))
  const setBarcode = (i: number, val: string) =>
    set('barcodes', form.barcodes.map((b, idx) => (idx === i ? val : b)))

  const currencyCode = useMemo(
    () => currencies.find((c) => String(c.id) === form.currencyId)?.code,
    [currencies, form.currencyId],
  )

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Code is required'
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.uomId) e.uomId = 'Unit of measure is required'
    if (form.cost === '' || Number.isNaN(Number(form.cost)) || Number(form.cost) < 0)
      e.cost = 'Enter a valid cost'

    // Tiers default to 0 when blank — only reject genuinely invalid entries.
    ;(['price1', 'price2', 'price3', 'weight', 'volume'] as const).forEach((key) => {
      const v = form[key]
      if (v.trim() !== '' && (Number.isNaN(Number(v)) || Number(v) < 0)) {
        e[key] = 'Must be a positive number'
      }
    })

    form.variants.forEach((variant, i) => {
      if (!variant.uom_id) e[`uoms.${i}.uom_id`] = 'Pick a unit'
      if (!(variant.unit > 0)) e[`uoms.${i}.unit`] = 'Must be greater than 0'
    })

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const barcodes = form.barcodes.map((b) => b.trim()).filter(Boolean)
    const price1 = form.price1.trim() === '' ? 0 : Number(form.price1)
    const num = (v: string) => (v.trim() === '' ? 0 : Number(v))

    const base = {
      code: form.code.trim(),
      name: form.name.trim(),
      uom_id: Number(form.uomId),
      cost: Number(form.cost),
      // `price` mirrors the retail tier — sync, item_uoms and transactions all
      // read that single figure.
      price: price1,
      category_id: form.categoryId === '' ? null : Number(form.categoryId),
      brand_id: form.brandId === '' ? null : Number(form.brandId),
      currency_id: form.currencyId === '' ? null : Number(form.currencyId),
      price_1: price1,
      price_2: num(form.price2),
      price_3: num(form.price3),
      weight: num(form.weight),
      volume: num(form.volume),
      barcodes,
      // Only send variants when the packaging box was actually used; omitting
      // the key leaves whatever the item already has untouched.
      //
      // The base goes first and says so. The packaging list describes what sits
      // *on top of* the product's own unit, so sending only those rows left the
      // server to guess which was the base — it took the first, which meant
      // naming Piece up here and adding one Box below came back as a Box-based
      // product with the Piece silently gone.
      ...(form.variants.length > 0
        ? {
            uoms: [
              {
                uom_id: Number(form.uomId),
                unit: 1,
                is_base: true,
                cost: Number(form.cost),
                price_1: price1,
                price_2: num(form.price2),
                price_3: num(form.price3),
                weight: num(form.weight),
                volume: num(form.volume),
                // Left empty: the form's own Barcode section is already sent as
                // `barcodes` and the server attaches those to the base. Sending
                // them twice would ask it to insert each code two times.
                barcodes: [] as string[],
              },
              ...form.variants.map((v) => ({
                ...(v.id ? { id: v.id } : {}),
                uom_id: v.uom_id,
                unit: v.unit,
                is_base: false,
                cost: v.cost,
                price_1: v.price_1,
                price_2: v.price_2,
                price_3: v.price_3,
                weight: v.weight,
                volume: v.volume,
                barcodes: v.barcodes.map((b) => b.trim()).filter(Boolean),
              })),
            ],
          }
        : {}),
    }

    const saved =
      isEdit && item
        ? await run(
            {
              label: 'Saving product',
              detail: form.name,
              success: `${form.name} has been saved.`,
            },
            () => updateItem.mutateAsync({ id: item.id, payload: base as UpdateItemPayload }),
          )
        : await run(
            {
              label: 'Creating product',
              detail: form.name,
              success: `${form.name} is now in the catalog.`,
            },
            () =>
              createItem.mutateAsync({
                uuid: crypto.randomUUID(),
                ...base,
              } as CreateItemPayload),
          )

    if (saved !== null) onClose()
  }

  // Both resolve with the new row's id so SelectOrCreate can select it — you
  // added it because you wanted to use it here. They go through `run` like
  // every other write: adding a category from inside the product form is still
  // a save, and it should say so rather than happening invisibly behind an
  // open drawer. `run` yields null when it fails, so nothing gets selected.
  const addCategory = async (name: string) => {
    const created = await run(
      { label: 'Creating category', detail: name, success: `"${name}" is ready to use.` },
      () => createCategory.mutateAsync(name),
    )
    return created?.id
  }

  const addBrand = async (name: string) => {
    const created = await run(
      { label: 'Creating brand', detail: name, success: `"${name}" is ready to use.` },
      () => createBrand.mutateAsync(name),
    )
    return created?.id
  }

  const saving = createItem.isPending || updateItem.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit product' : 'New product'}
      width="w-[70%]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <div>
        {/* What the product is on the left; what it scans and sells for on the
            right, barcode above the prices it belongs with. Stacks below lg.
            The divider is the brand accent rather than the usual grey — it
            separates two peers, where a border-default line reads as "end of
            form". */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0">
          <div className="lg:pr-8 min-w-0">
        <FormSection
          first
          title="General"
          description="What the product is and how it's classified."
          icon={<Package size={16} />}
        >
          <div className="flex flex-col gap-4">
            <FormRow>
              <Input
                label="Code / SKU"
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                error={errors.code}
                placeholder="COLA330"
              />
              <Input
                label="Name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                error={errors.name}
                placeholder="Cola 330ml"
              />
            </FormRow>

            <FormRow>
              <SelectOrCreate
                label="Category"
                value={form.categoryId}
                onChange={(v) => set('categoryId', v)}
                placeholder="No category"
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                createPlaceholder="e.g. Beverages"
                createHint="Add a category"
                onCreate={addCategory}
                creating={createCategory.isPending}
              />
              <SelectOrCreate
                label="Brand"
                value={form.brandId}
                onChange={(v) => set('brandId', v)}
                placeholder="No brand"
                options={brands.map((b) => ({ value: String(b.id), label: b.name }))}
                createPlaceholder="e.g. Pepsi"
                createHint="Add a brand"
                onCreate={addBrand}
                creating={createBrand.isPending}
              />
            </FormRow>

            <FormRow cols={3}>
              <Select
                label="Unit of measure"
                value={form.uomId}
                onChange={(e) => set('uomId', e.target.value)}
                error={errors.uomId}
                placeholder="Select a UOM"
                options={uoms.map((u) => ({ value: String(u.id), label: u.name }))}
              />
              <Input
                label="Weight"
                type="number"
                min={0}
                step="any"
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
                error={errors.weight}
                placeholder="0"
              />
              <Input
                label="Volume"
                type="number"
                min={0}
                step="any"
                value={form.volume}
                onChange={(e) => set('volume', e.target.value)}
                error={errors.volume}
                placeholder="0"
              />
            </FormRow>
          </div>
        </FormSection>

          </div>

          <div className="lg:pl-8 min-w-0 lg:border-l lg:border-[var(--accent-primary)]/30">
        <FormSection
          first
          title="Barcode"
          description="Scanned at the till. Most products need only one."
          icon={<Barcode size={16} />}
          action={
            <button
              type="button"
              onClick={addBarcode}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              <Plus size={13} /> Add barcode
            </button>
          }
        >
          <div className="flex flex-col gap-2">
          {form.barcodes.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  value={b}
                  onChange={(e) => setBarcode(i, e.target.value)}
                  placeholder="e.g. 5281000000011"
                  aria-label={`Barcode ${i + 1}`}
                />
              </div>
              {form.barcodes.length > 1 && (
                <button
                  type="button"
                  title="Remove"
                  aria-label={`Remove barcode ${i + 1}`}
                  onClick={() => removeBarcode(i)}
                  className="p-2 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          </div>
        </FormSection>

        <FormSection
          title="Pricing"
          description="One currency governs all three tiers."
          icon={<DollarSign size={16} />}
        >
          <div className="flex flex-col gap-4">
            <FormRow>
              <SearchableSelect
                label="Currency"
                value={form.currencyId}
                onChange={(v) => set('currencyId', v)}
                options={currencies.map((c) => ({
                  value: String(c.id),
                  label: c.is_base ? `${c.name} (${c.code}) — base` : `${c.name} (${c.code})`,
                }))}
                placeholder="Company base currency"
                searchPlaceholder="Search currencies…"
              />
              <Input
                label="Cost"
                type="number"
                min={0}
                step="any"
                value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
                error={errors.cost}
                leftIcon={<DollarSign size={15} />}
                placeholder="0.45"
              />
            </FormRow>

            <FormRow cols={3}>
              <Input
                label="Retail price"
                type="number"
                min={0}
                step="any"
                value={form.price1}
                onChange={(e) => set('price1', e.target.value)}
                error={errors.price1}
                leftIcon={<DollarSign size={15} />}
                placeholder="0"
              />
              <Input
                label="Wholesale price"
                type="number"
                min={0}
                step="any"
                value={form.price2}
                onChange={(e) => set('price2', e.target.value)}
                error={errors.price2}
                leftIcon={<DollarSign size={15} />}
                placeholder="0"
              />
              <Input
                label="Distribution price"
                type="number"
                min={0}
                step="any"
                value={form.price3}
                onChange={(e) => set('price3', e.target.value)}
                error={errors.price3}
                leftIcon={<DollarSign size={15} />}
                placeholder="0"
              />
            </FormRow>
          </div>
        </FormSection>
          </div>
        </div>

        <FormSection
          title="Packaging"
          description="How this product is sold — a piece, a box of 24, a pallet. Each packaging keeps its own barcodes and prices, since bulk is usually cheaper per unit."
          icon={<Boxes size={16} />}
        >
          <ItemUomEditor
            variants={form.variants}
            onChange={(variants) => set('variants', variants)}
            uoms={uoms}
            currencyCode={currencyCode}
            errors={errors}
          />
        </FormSection>
      </div>
    </SideDrawer>
  )
}
