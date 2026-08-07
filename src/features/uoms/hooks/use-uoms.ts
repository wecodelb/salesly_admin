import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUom, deleteUom, fetchUoms, updateUom } from '../api/uoms-api'
import type { CreateUomPayload, UpdateUomPayload } from '../types'

// Shared with features/products' own useUoms() — same key so the item form's
// unit picker picks up edits made here without a reload.
const UOMS_KEY = ['admin-uoms'] as const

export function useUoms() {
  return useQuery({ queryKey: UOMS_KEY, queryFn: () => fetchUoms() })
}

export function useCreateUom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUomPayload) => createUom(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: UOMS_KEY }),
  })
}

export function useUpdateUom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUomPayload }) =>
      updateUom(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: UOMS_KEY }),
  })
}

export function useDeleteUom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteUom(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: UOMS_KEY }),
  })
}
