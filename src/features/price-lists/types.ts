// Contract from backend part 2 (GET/POST/PATCH/DELETE /price-lists). A price
// list holds per-item USD overrides applied for one customer when the item
// endpoint is called with that customer in context.

export interface PriceListItemRow {
  id?: number
  item_id: number
  item?: string | null
  code?: string | null
  price: number
}

export interface PriceList {
  id: number
  name: string
  customer_id: number | null
  customer: string | null
  is_active: boolean
  items_count?: number
  items?: PriceListItemRow[]
}

export interface CreatePriceListPayload {
  name: string
  customer_id?: number | null
  is_active?: boolean
  items?: { item_id: number; price: number }[]
}

export type UpdatePriceListPayload = Partial<CreatePriceListPayload>

export interface CustomerOption {
  id: number
  name: string
}
