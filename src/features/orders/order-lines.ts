import type { AdminItem } from '@/features/products/types'
import { packagingsOf } from '@/features/products/packagings'

export interface LineRow {
  itemId: string
  uomId: string
  qty: string
}

export const blankLine = (): LineRow => ({ itemId: '', uomId: '', qty: '' })

/** What the warehouse has of one product, and what it costs this shop — both per base unit. */
export type StockFigures = Map<number, { available: number; price: number | null }>

/** One line weighed against the warehouse: base units wanted, what is there, what it comes to. */
export function lineFigures(row: LineRow, productsById: Map<number, AdminItem>, stock: StockFigures) {
  const item = row.itemId ? productsById.get(Number(row.itemId)) : undefined
  if (!item) return null
  const unit = packagingsOf(item).find((p) => String(p.uomId) === row.uomId)?.unit ?? 1
  const wanted = Number(row.qty || 0) * unit
  const figures = stock.get(item.id)
  const onHand = figures?.available ?? 0
  const price = figures?.price ?? null
  return { item, unit, wanted, onHand, short: wanted > onHand, price, value: price == null ? null : wanted * price }
}
