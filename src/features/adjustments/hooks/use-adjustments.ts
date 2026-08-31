import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveAdjustment,
  createAdjustment,
  createAdjustmentType,
  deleteAdjustment,
  deleteAdjustmentType,
  fetchAdjustment,
  fetchAdjustments,
  fetchAdjustmentTypes,
  rejectAdjustment,
  updateAdjustment,
  updateAdjustmentType,
} from '../api/adjustments-api'
import type { AdjustmentFilters, AdjustmentPayload, AdjustmentType } from '../types'

const ADJUSTMENTS_KEY = ['adjustments'] as const
const TYPES_KEY = ['adjustment-types'] as const

/**
 * Every sheet matching the filters.
 *
 * All of them are in the key, `perPage` included. Two filters of one endpoint
 * are two different answers and must not overwrite each other in the cache —
 * and `perPage` is the one that bites, because a screen asking for a page and a
 * report asking for the whole book off a shared key would leave whichever
 * loaded second totalling the other's rows.
 */
export function useAdjustments(filters: AdjustmentFilters = {}) {
  return useQuery({
    queryKey: [
      ...ADJUSTMENTS_KEY,
      filters.status ?? null,
      filters.warehouseId ?? null,
      filters.adjustmentTypeId ?? null,
      filters.itemId ?? null,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
      filters.search ?? null,
      filters.perPage ?? null,
    ],
    queryFn: () => fetchAdjustments(filters),
  })
}

export function useAdjustment(id: number | null) {
  return useQuery({
    queryKey: [...ADJUSTMENTS_KEY, 'one', id],
    queryFn: () => fetchAdjustment(id!),
    enabled: id != null,
  })
}

/**
 * Anything that writes a sheet also has to refresh the products behind it.
 *
 * Approving one moves `item_distributions`, which is what the Products screen
 * and the warehouse screens read. Leaving those caches alone would show a shelf
 * quantity that the adjustment has already changed — the exact disagreement
 * this module exists to end.
 */
function useAdjustmentInvalidation() {
  const client = useQueryClient()

  return () => {
    client.invalidateQueries({ queryKey: ADJUSTMENTS_KEY })
    client.invalidateQueries({ queryKey: ['admin-products'] })
    client.invalidateQueries({ queryKey: ['warehouses'] })
    client.invalidateQueries({ queryKey: ['depot-stock'] })
  }
}

export function useCreateAdjustment() {
  const invalidate = useAdjustmentInvalidation()

  return useMutation({
    mutationFn: (payload: AdjustmentPayload) => createAdjustment(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateAdjustment() {
  const invalidate = useAdjustmentInvalidation()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AdjustmentPayload> }) =>
      updateAdjustment(id, payload),
    onSuccess: invalidate,
  })
}

export function useApproveAdjustment() {
  const invalidate = useAdjustmentInvalidation()

  return useMutation({ mutationFn: (id: number) => approveAdjustment(id), onSuccess: invalidate })
}

export function useRejectAdjustment() {
  const invalidate = useAdjustmentInvalidation()

  return useMutation({ mutationFn: (id: number) => rejectAdjustment(id), onSuccess: invalidate })
}

export function useDeleteAdjustment() {
  const invalidate = useAdjustmentInvalidation()

  return useMutation({ mutationFn: (id: number) => deleteAdjustment(id), onSuccess: invalidate })
}

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * The kinds of adjustment this company recognises.
 *
 * `active` is in the key: the managing screen wants all of them and the drawer
 * wants only the live ones, and off one key whichever loaded first would decide
 * for both.
 */
export function useAdjustmentTypes(active?: boolean) {
  return useQuery({
    queryKey: [...TYPES_KEY, active ?? null],
    queryFn: () => fetchAdjustmentTypes(active),
  })
}

function useTypeInvalidation() {
  const client = useQueryClient()

  return () => client.invalidateQueries({ queryKey: TYPES_KEY })
}

export function useCreateAdjustmentType() {
  const invalidate = useTypeInvalidation()

  return useMutation({
    mutationFn: (payload: Partial<AdjustmentType>) => createAdjustmentType(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateAdjustmentType() {
  const invalidate = useTypeInvalidation()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AdjustmentType> }) =>
      updateAdjustmentType(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteAdjustmentType() {
  const invalidate = useTypeInvalidation()

  return useMutation({ mutationFn: (id: number) => deleteAdjustmentType(id), onSuccess: invalidate })
}
