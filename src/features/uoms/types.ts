// Units of measure — the reference data behind an item's "sold by" picker.
// Backend: GET/POST/PATCH/DELETE /api/v1/uoms, company-scoped, unpaginated.

// The product form only ever needs id/code/name; re-exported so callers can
// keep importing the narrow shape from here without reaching into products.
import type { UomOption } from '@/features/products/types'

export type { UomOption }

// Extends the picker shape rather than restating it, so features/products stays
// the single source of truth for id/code/name. `company_id` is optional because
// this row shares the ['admin-uoms'] cache entry with the product form's
// lighter fetch — whichever query lands first is what every reader sees.
export interface Uom extends UomOption {
  company_id?: number
}

export interface CreateUomPayload {
  code: string
  name: string
}

export type UpdateUomPayload = Partial<CreateUomPayload>
