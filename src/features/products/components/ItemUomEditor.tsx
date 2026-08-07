import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import type { AdminItemUom, UomOption } from '../types'

interface Props {
  variants: AdminItemUom[]
  onChange: (variants: AdminItemUom[]) => void
  uoms: UomOption[]
  /** Shown against each tier so the numbers read in the right currency. */
  currencyCode?: string
  errors?: Record<string, string>
}

const blankVariant = (uomId: number): AdminItemUom => ({
  uom_id: uomId,
  unit: 1,
  cost: 0,
  price_1: 0,
  price_2: 0,
  price_3: 0,
  weight: 0,
  volume: 0,
  barcodes: [''],
})

/**
 * The "+UOM" box: how this product is packaged, and what each packaging costs.
 *
 * Every variant prices itself rather than scaling the item's tiers, since bulk
 * packs are normally discounted.
 *
 * There is no "base unit" choice here. The backend still keeps one variant
 * flagged as the base — it is what the mobile app converts quantities against,
 * and what the product's own price and barcodes are mirrored onto — but it
 * takes the first packaging for it. Asking a user to nominate one was a
 * question about the data model, not about their products.
 */
export function ItemUomEditor({ variants, onChange, uoms, currencyCode, errors = {} }: Props) {
  const patch = (index: number, changes: Partial<AdminItemUom>) =>
    onChange(variants.map((v, i) => (i === index ? { ...v, ...changes } : v)))

  const addVariant = () => onChange([...variants, blankVariant(uoms[0]?.id ?? 0)])

  const removeVariant = (index: number) => onChange(variants.filter((_, i) => i !== index))

  const setBarcode = (vIndex: number, bIndex: number, value: string) =>
    patch(vIndex, {
      barcodes: variants[vIndex].barcodes.map((b, i) => (i === bIndex ? value : b)),
    })

  const addBarcode = (vIndex: number) =>
    patch(vIndex, { barcodes: [...variants[vIndex].barcodes, ''] })

  const removeBarcode = (vIndex: number, bIndex: number) =>
    patch(vIndex, { barcodes: variants[vIndex].barcodes.filter((_, i) => i !== bIndex) })

  const uomOptions = uoms.map((u) => ({ value: String(u.id), label: `${u.name} (${u.code})` }))

  return (
    <div className="flex flex-col gap-4">
      {variants.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          No packaging yet — add one to describe how this product is sold.
        </p>
      )}

      {variants.map((variant, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-4 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Packaging {i + 1}
            </span>
            <button
              type="button"
              title="Remove packaging"
              aria-label={`Remove packaging ${i + 1}`}
              onClick={() => removeVariant(i)}
              className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* What it is and how big it is, four across — these are short
              fields, and one per line wasted most of the box. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              label="Unit of measure"
              value={String(variant.uom_id)}
              onChange={(e) => patch(i, { uom_id: Number(e.target.value) })}
              options={uomOptions}
              error={errors[`uoms.${i}.uom_id`]}
            />
            <Input
              label="Units inside"
              type="number"
              min={0}
              step="any"
              value={String(variant.unit)}
              onChange={(e) => patch(i, { unit: Number(e.target.value) })}
              error={errors[`uoms.${i}.unit`]}
              placeholder="1"
            />
            <Input
              label="Weight"
              type="number"
              min={0}
              step="any"
              value={String(variant.weight)}
              onChange={(e) => patch(i, { weight: Number(e.target.value) })}
              placeholder="0"
            />
            <Input
              label="Volume"
              type="number"
              min={0}
              step="any"
              value={String(variant.volume)}
              onChange={(e) => patch(i, { volume: Number(e.target.value) })}
              placeholder="0"
            />
          </div>

          {/* Barcodes wrap across the row rather than stacking: a product with
              four codes was four lines of mostly empty space. The ladder is
              keyed to the drawer being 70% of the viewport, and stops at five
              because a narrower column starts clipping an EAN-13. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--text-primary)]">Barcodes</label>
              <button
                type="button"
                onClick={() => addBarcode(i)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                <Plus size={13} /> Add barcode
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              {variant.barcodes.map((barcode, bIndex) => (
                <div key={bIndex} className="flex items-center gap-1.5">
                  <div className="flex-1 min-w-0">
                    {/* Bare digits rather than the "e.g. …" form used where the
                        field has a line to itself: at five columns the prefix
                        is what pushes a 13-digit code out of view. */}
                    <Input
                      value={barcode}
                      onChange={(e) => setBarcode(i, bIndex, e.target.value)}
                      placeholder="5281000000011"
                      aria-label={`Packaging ${i + 1} barcode ${bIndex + 1}`}
                    />
                  </div>
                  {variant.barcodes.length > 1 && (
                    <button
                      type="button"
                      title="Remove barcode"
                      aria-label={`Remove packaging ${i + 1} barcode ${bIndex + 1}`}
                      onClick={() => removeBarcode(i, bIndex)}
                      className="p-2 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cost and the three tiers on one line — they are read together, and
              comparing them across rows was the whole point of the box. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              label={`Cost${currencyCode ? ` (${currencyCode})` : ''}`}
              type="number"
              min={0}
              step="any"
              value={String(variant.cost)}
              onChange={(e) => patch(i, { cost: Number(e.target.value) })}
              placeholder="0"
            />
            <Input
              label="Retail"
              type="number"
              min={0}
              step="any"
              value={String(variant.price_1)}
              onChange={(e) => patch(i, { price_1: Number(e.target.value) })}
              error={errors[`uoms.${i}.price_1`]}
              placeholder="0"
            />
            <Input
              label="Wholesale"
              type="number"
              min={0}
              step="any"
              value={String(variant.price_2)}
              onChange={(e) => patch(i, { price_2: Number(e.target.value) })}
              placeholder="0"
            />
            <Input
              label="Distribution"
              type="number"
              min={0}
              step="any"
              value={String(variant.price_3)}
              onChange={(e) => patch(i, { price_3: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
        </div>
      ))}

      <div>
        <Button variant="secondary" icon={<Plus size={15} />} onClick={addVariant} type="button">
          Add packaging
        </Button>
      </div>
    </div>
  )
}
