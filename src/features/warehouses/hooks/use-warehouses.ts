import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWarehouse,
  deleteWarehouse,
  fetchWarehouses,
  updateWarehouse,
} from '../api/warehouses-api'
import type { CreateWarehousePayload, UpdateWarehousePayload } from '../types'

// The same key the depot screens read their warehouse pickers off. Sharing it
// is the point: a warehouse renamed here, or a new one opened, has to reach the
// load form without waiting for a reload, and both queries are the same GET
// against the same endpoint.
const WAREHOUSES_KEY = ['admin-warehouses'] as const

export function useWarehouses() {
  return useQuery({ queryKey: WAREHOUSES_KEY, queryFn: () => fetchWarehouses() })
}

/**
 * Anything written here can move the main flag off another row — the backend
 * unsets the previous main in the same transaction — so the whole list is
 * refetched rather than the one row being patched into place.
 */
function useInvalidateWarehouses() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: WAREHOUSES_KEY })
}

export function useCreateWarehouse() {
  const invalidate = useInvalidateWarehouses()
  return useMutation({
    mutationFn: (payload: CreateWarehousePayload) => createWarehouse(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateWarehouse() {
  const invalidate = useInvalidateWarehouses()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateWarehousePayload }) =>
      updateWarehouse(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteWarehouse() {
  const invalidate = useInvalidateWarehouses()
  return useMutation({
    mutationFn: (id: number) => deleteWarehouse(id),
    onSuccess: invalidate,
  })
}
