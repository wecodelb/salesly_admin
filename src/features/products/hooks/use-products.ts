import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBrand,
  createCategory,
  createItem,
  deleteItem,
  fetchBrands,
  fetchCategories,
  fetchCurrencies,
  fetchItemDistribution,
  fetchItemLevels,
  fetchProduct,
  fetchProducts,
  fetchUoms,
  saveItemLevel,
  updateItem,
} from '../api/products-api'
import type { CreateItemPayload, SaveItemLevelPayload, UpdateItemPayload } from '../types'

const PRODUCTS_KEY = ['admin-products'] as const
const CATEGORIES_KEY = ['admin-categories'] as const
const BRANDS_KEY = ['admin-brands'] as const
const UOMS_KEY = ['admin-uoms'] as const
const CURRENCIES_KEY = ['admin-currencies'] as const

export function useProducts() {
  return useQuery({ queryKey: PRODUCTS_KEY, queryFn: () => fetchProducts() })
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, id],
    queryFn: () => fetchProduct(id!),
    enabled: id != null,
  })
}

/**
 * Where one product's stock is. Keyed under the product so an edit to the item
 * — which can move stock about — clears this alongside the item itself.
 */
export function useItemDistribution(itemId: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, itemId, 'distribution'],
    queryFn: () => fetchItemDistribution(itemId!),
    enabled: itemId != null,
  })
}

/**
 * This product's reorder points, per warehouse. Keyed under the product like
 * the distribution beside it, so an edit to the item clears both together.
 */
export function useItemLevels(itemId: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, itemId, 'levels'],
    queryFn: () => fetchItemLevels(itemId!),
    enabled: itemId != null,
  })
}

/**
 * Setting a level writes a ledger row where the pair had none, so the
 * distribution — which lists exactly those rows — is refreshed alongside the
 * grid the write came from.
 */
export function useSaveItemLevel(itemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SaveItemLevelPayload) => saveItemLevel(itemId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...PRODUCTS_KEY, itemId, 'levels'] })
      qc.invalidateQueries({ queryKey: [...PRODUCTS_KEY, itemId, 'distribution'] })
    },
  })
}

export function useCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: () => fetchCategories() })
}

export function useUoms() {
  return useQuery({ queryKey: UOMS_KEY, queryFn: () => fetchUoms() })
}

export function useBrands() {
  return useQuery({ queryKey: BRANDS_KEY, queryFn: () => fetchBrands() })
}

export function useCurrencies() {
  return useQuery({ queryKey: CURRENCIES_KEY, queryFn: () => fetchCurrencies() })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateItemPayload) => createItem(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateItemPayload }) =>
      updateItem(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  })
}

export function useCreateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createBrand(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDS_KEY }),
  })
}
