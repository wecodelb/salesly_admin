// Contract from backend part 2 (GET/POST/PATCH/DELETE /promotions). A promotion
// discounts one item, a whole category, or every product for a date window.

export interface Promotion {
  id: number
  name: string
  type: 'percent' | 'amount'
  value: number
  item_id: number | null
  item: string | null
  category_id: number | null
  category: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

export interface CreatePromotionPayload {
  name?: string
  type: 'percent' | 'amount'
  value: number
  item_id?: number | null
  category_id?: number | null
  starts_at?: string | null
  ends_at?: string | null
  is_active?: boolean
}

export type UpdatePromotionPayload = Partial<CreatePromotionPayload>

export function promoScope(p: Promotion): string {
  if (p.item) return p.item
  if (p.category) return `Category · ${p.category}`
  return 'All products'
}

export function promoAmount(p: Promotion): string {
  return p.type === 'percent' ? `-${p.value}%` : `-$${p.value}`
}
