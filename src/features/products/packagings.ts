import type { AdminItem } from './types'

export interface Packaging {
  uomId: number
  label: string
  /** How many base units one of it holds. */
  unit: number
}

/** How this product may be counted: its own base unit, plus every packaging
 *  declared for it. Anything else has no multiplier, so stock cannot move in
 *  it — the backend refuses the line rather than guessing. */
export function packagingsOf(item: AdminItem): Packaging[] {
  const seen = new Set<number>()
  const list: Packaging[] = []

  for (const variant of item.uoms ?? []) {
    if (!variant.uom_id || seen.has(variant.uom_id)) continue
    seen.add(variant.uom_id)
    list.push({
      uomId: variant.uom_id,
      label: variant.uom?.name ?? 'Unit',
      unit: variant.unit || 1,
    })
  }

  if (item.uom_id && !seen.has(item.uom_id)) {
    list.unshift({ uomId: item.uom_id, label: item.uom ?? 'Base unit', unit: 1 })
  }

  return list
}
