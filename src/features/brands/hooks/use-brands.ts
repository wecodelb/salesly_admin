import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBrand, deleteBrand, fetchBrands, updateBrand } from '../api/brands-api'
import type { CreateBrandPayload, UpdateBrandPayload } from '../types'

// Shared with features/products' own useBrands() — same key so the item form's
// brand picker picks up edits made here without a reload.
const BRANDS_KEY = ['admin-brands'] as const

export function useBrands() {
  return useQuery({ queryKey: BRANDS_KEY, queryFn: () => fetchBrands() })
}

export function useCreateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBrandPayload) => createBrand(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDS_KEY }),
  })
}

export function useUpdateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateBrandPayload }) =>
      updateBrand(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDS_KEY }),
  })
}

export function useDeleteBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteBrand(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDS_KEY }),
  })
}
