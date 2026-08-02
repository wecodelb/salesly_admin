// Contract from backend part 2 (GET/POST/PATCH/DELETE /categories) — company
// scoped, unpaginated. The row shape lives in features/products, which is the
// app-wide source of truth for the category picker.
export type { Category } from '@/features/products/types'

export interface CreateCategoryPayload {
  name: string
  code?: string | null
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>
