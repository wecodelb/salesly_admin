import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPromotion,
  deletePromotion,
  fetchPromotions,
  updatePromotion,
} from '../api/promotions-api'
import type { CreatePromotionPayload, UpdatePromotionPayload } from '../types'

const PROMOTIONS_KEY = ['admin-promotions'] as const

export function usePromotions() {
  return useQuery({ queryKey: PROMOTIONS_KEY, queryFn: () => fetchPromotions() })
}

export function useCreatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePromotionPayload) => createPromotion(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMOTIONS_KEY }),
  })
}

export function useUpdatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdatePromotionPayload }) =>
      updatePromotion(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMOTIONS_KEY }),
  })
}

export function useDeletePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deletePromotion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMOTIONS_KEY }),
  })
}
