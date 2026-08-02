import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { Category } from '@/features/products/types'
import type { CreateCategoryPayload, UpdateCategoryPayload } from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await apiClient.get<Envelope<ListData<Category>>>(ENDPOINTS.CATEGORIES)
  return res.data.data?.data ?? []
}

export async function createCategory(payload: CreateCategoryPayload): Promise<Category> {
  const res = await apiClient.post<Envelope<{ data: Category }>>(ENDPOINTS.CATEGORIES, payload)
  return res.data.data.data
}

export async function updateCategory(
  id: number,
  payload: UpdateCategoryPayload,
): Promise<Category> {
  const res = await apiClient.patch<Envelope<{ data: Category }>>(
    `${ENDPOINTS.CATEGORIES}/${id}`,
    payload,
  )
  return res.data.data.data
}

/** Rejects with a 409 carrying a "still used by N product(s)" message when the
 *  category is still referenced — surface that message rather than a generic one. */
export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.CATEGORIES}/${id}`)
}
