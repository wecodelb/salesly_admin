import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveOrder,
  cancelOrder,
  fetchOrder,
  fetchOrderStock,
  fetchOrders,
  rejectOrder,
} from '../api/orders-api'
import type { OrderApproval, OrderFilters } from '../types'

const ORDERS_KEY = ['orders'] as const

/**
 * The order list. Re-read every half minute: orders arrive from the field all
 * day, and the queue of ones waiting for approval is what the office works.
 */
/**
 * How many orders wait for the office, for the menu's badge. Polled like the
 * load requests: a salesman's order sits still until somebody here answers it.
 */
export function usePendingOrderCount(enabled = true) {
  return useQuery({
    queryKey: ['orders', 'pending-count'],
    queryFn: async () => (await fetchOrders({ status: 'SUBMITTED' })).pendingApproval,
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}

export function useOrders(filters: OrderFilters, enabled = true) {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'list', filters],
    queryFn: () => fetchOrders(filters),
    enabled,
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
    // A 403 is an answer — the module is off, or the key is missing.
    retry: (count, error) => (error as { response?: { status?: number } })?.response?.status !== 403 && count < 2,
  })
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'one', id],
    queryFn: () => fetchOrder(id as number),
    enabled: id != null,
  })
}

/** Approve, reject or cancel — each refreshes the list and the open order. */
export function useOrderActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ORDERS_KEY })

  return {
    approve: useMutation({
      mutationFn: ({ id, changes }: { id: number; changes?: OrderApproval }) => approveOrder(id, changes),
      onSuccess: refresh,
    }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectOrder(id, reason),
      onSuccess: refresh,
    }),
    cancel: useMutation({ mutationFn: (id: number) => cancelOrder(id), onSuccess: refresh }),
  }
}

/** The source warehouse's stock for a shop's order, priced for the shop. */
export function useOrderStock(customerId: number | null, warehouseId: number | null) {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'stock', customerId, warehouseId],
    queryFn: () => fetchOrderStock(customerId as number, warehouseId),
    enabled: customerId != null,
  })
}
