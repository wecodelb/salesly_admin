import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPriceList,
  deletePriceList,
  fetchCustomerOptions,
  fetchPriceList,
  fetchPriceLists,
  updatePriceList,
} from '../api/price-lists-api'
import type { CreatePriceListPayload, UpdatePriceListPayload } from '../types'

const PRICE_LISTS_KEY = ['admin-price-lists'] as const

export function usePriceLists() {
  return useQuery({ queryKey: PRICE_LISTS_KEY, queryFn: () => fetchPriceLists() })
}

export function usePriceList(id: number | null) {
  return useQuery({
    queryKey: [...PRICE_LISTS_KEY, id],
    queryFn: () => fetchPriceList(id as number),
    enabled: id != null,
  })
}

export function useCustomerOptions() {
  return useQuery({ queryKey: ['admin-customer-options'], queryFn: () => fetchCustomerOptions() })
}

export function useCreatePriceList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePriceListPayload) => createPriceList(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRICE_LISTS_KEY }),
  })
}

export function useUpdatePriceList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdatePriceListPayload }) =>
      updatePriceList(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRICE_LISTS_KEY }),
  })
}

export function useDeletePriceList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deletePriceList(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRICE_LISTS_KEY }),
  })
}
