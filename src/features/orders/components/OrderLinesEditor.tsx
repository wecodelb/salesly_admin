import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import type { AdminItem } from '@/features/products/types'
import { packagingsOf } from '@/features/products/packagings'
import { formatMoney } from '../orders-logic'
import { blankLine, lineFigures, type LineRow, type StockFigures } from '../order-lines'

const qty = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)

interface Props {
  rows: LineRow[]
  onChange: (rows: LineRow[]) => void
  products: AdminItem[]
  productsById: Map<number, AdminItem>
  stock: StockFigures
  errors: Record<string, string>
}

/**
 * The order's products, editable the way a load request's are when it is
 * answered: change a quantity or a packaging, swap a product, add one, take
 * one off. Beside each line, what the warehouse can still promise and what it
 * costs this shop, so the manager sees a short line before he approves.
 */
export function OrderLinesEditor({ rows, onChange, products, productsById, stock, errors }: Props) {
  const setRow = (index: number, changes: Partial<LineRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))

  /** A new product starts on its base unit: the old packaging belonged to the one that left. */
  const pickItem = (index: number, value: string) => {
    const item = productsById.get(Number(value))
    const first = item ? packagingsOf(item)[0] : undefined
    setRow(index, { itemId: value, uomId: first ? String(first.uomId) : '' })
  }

  const productOptions = products.map((item) => ({ value: String(item.id), label: `${item.name} (${item.code})` }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]">Products</h3>
        <button
          type="button"
          onClick={() => onChange([...rows, blankLine()])}
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
        >
          <Plus size={13} /> Add product
        </button>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Every change here is what the shop gets. The figure beside each product is what the warehouse can still
        promise, and its price for this shop.
      </p>

      {errors.rows && <p className="text-xs text-[var(--accent-red)]">{errors.rows}</p>}

      {rows.map((row, i) => {
        const figures = lineFigures(row, productsById, stock)
        const item = row.itemId ? productsById.get(Number(row.itemId)) : undefined
        const packagings = item ? packagingsOf(item) : []

        return (
          <div key={i} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <SearchableSelect
                label={i === 0 ? 'Product' : undefined}
                value={row.itemId}
                onChange={(value) => pickItem(i, value)}
                options={productOptions}
                error={errors[`row-${i}-item`]}
                placeholder="Choose a product"
                searchPlaceholder="Search products…"
              />
            </div>
            <div className="w-36">
              <Select
                label={i === 0 ? 'Packaging' : undefined}
                value={row.uomId}
                onChange={(e) => setRow(i, { uomId: e.target.value })}
                placeholder="Unit"
                options={packagings.map((p) => ({
                  value: String(p.uomId),
                  label: p.unit === 1 ? p.label : `${p.label} × ${qty(p.unit)}`,
                }))}
              />
            </div>
            <div className="w-24">
              <Input
                label={i === 0 ? 'Quantity' : undefined}
                type="number"
                min={0}
                step="any"
                value={row.qty}
                onChange={(e) => setRow(i, { qty: e.target.value })}
                error={errors[`row-${i}-qty`]}
                placeholder="0"
                aria-label={`Quantity ${i + 1}`}
              />
            </div>
            <div className="mb-2.5 w-40 text-xs">
              {figures ? (
                <>
                  <div className={figures.short ? 'font-medium text-[var(--accent-red)]' : 'text-[var(--text-secondary)]'}>
                    {qty(figures.onHand)} available
                  </div>
                  <div className="text-[var(--text-muted)]">
                    {figures.value == null ? 'no price' : `${formatMoney(figures.price! * figures.unit)} each · ${formatMoney(figures.value)}`}
                  </div>
                </>
              ) : (
                <span className="text-[var(--text-muted)]">—</span>
              )}
            </div>
            <button
              type="button"
              title="Remove product"
              aria-label={`Remove product ${i + 1}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="mb-1 cursor-pointer rounded-[var(--radius-btn)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--accent-red)]"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
