// The brand row is already modelled for the product form's brand picker —
// re-exported here so both features stay on one shape.
export type { Brand } from '@/features/products/types'

export interface CreateBrandPayload {
  name: string
  code?: string | null
}

export interface UpdateBrandPayload {
  name?: string
  code?: string | null
}
