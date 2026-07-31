// Contract from backend part 2 (GET/POST/PATCH/DELETE /price-lists). A price
// list holds per-item USD overrides, applied when the item endpoint is called
// with a customer in context. A list is created without a customer; any
// number of customers are attached afterwards via
// POST /customers/{id}/price-lists. Exactly one list per company may be
// `is_default` — it applies to any customer with no specific list of their own.

export interface PriceListItemRow {
  id?: number
  item_id: number
  item?: string | null
  code?: string | null
  price: number
}

export interface PriceListCustomer {
  id: number
  name: string
}

export interface PriceList {
  id: number
  name: string
  is_default: boolean
  is_active: boolean
  items_count?: number
  items?: PriceListItemRow[]
  customers?: PriceListCustomer[]
}

export interface CreatePriceListPayload {
  name: string
  is_default?: boolean
  is_active?: boolean
  items?: { item_id: number; price: number }[]
}

export type UpdatePriceListPayload = Partial<CreatePriceListPayload>

export interface CustomerOption {
  id: number
  name: string
}
