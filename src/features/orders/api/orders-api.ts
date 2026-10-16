import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { Order, OrderApproval, OrderFilters, OrderRules, OrderStockLine, OrdersPage } from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData {
  data: Order[]
  pagination?: { current_page: number; last_page: number; per_page: number; total: number }
  pending_approval?: number
}

export const ORDERS_PER_PAGE = 50

export async function fetchOrders(filters: OrderFilters = {}): Promise<OrdersPage> {
  const { data } = await apiClient.get<Envelope<ListData>>(ENDPOINTS.ORDERS, {
    params: {
      per_page: ORDERS_PER_PAGE,
      page: filters.page ?? 1,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.salesmanId ? { salesman_id: filters.salesmanId } : {}),
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
      ...(filters.deliveryDate ? { delivery_from: filters.deliveryDate, delivery_to: filters.deliveryDate } : {}),
    },
  })
  const body = data?.data

  return {
    orders: Array.isArray(body?.data) ? body.data : [],
    total: body?.pagination?.total ?? 0,
    lastPage: body?.pagination?.last_page ?? 1,
    pendingApproval: body?.pending_approval ?? 0,
  }
}

/** One order with its lines. */
export async function fetchOrder(id: number): Promise<Order> {
  const { data } = await apiClient.get<Envelope<{ data: Order }>>(`${ENDPOINTS.ORDERS}/${id}`)
  return data.data.data
}

/** The write endpoints answer with the order under `data.order`. */
interface WriteData {
  order: Order
}

/** Approves, applying the manager's changes first when he made any. */
export async function approveOrder(id: number, changes?: OrderApproval): Promise<Order> {
  const { data } = await apiClient.post<Envelope<WriteData>>(ENDPOINTS.ORDER_APPROVE(id), changes ?? {})
  return data.data.order
}

/** What the warehouse has for a shop's order, priced for that shop. */
export async function fetchOrderStock(customerId: number, warehouseId: number | null): Promise<OrderStockLine[]> {
  const { data } = await apiClient.get<Envelope<{ items: OrderStockLine[] }>>(ENDPOINTS.ORDER_STOCK, {
    params: { customer_id: customerId, ...(warehouseId ? { warehouse_id: warehouseId } : {}) },
  })
  return data.data.items ?? []
}

export async function rejectOrder(id: number, reason: string): Promise<Order> {
  const { data } = await apiClient.post<Envelope<WriteData>>(ENDPOINTS.ORDER_REJECT(id), { reason })
  return data.data.order
}

export async function cancelOrder(id: number): Promise<Order> {
  const { data } = await apiClient.post<Envelope<WriteData>>(ENDPOINTS.ORDER_CANCEL(id))
  return data.data.order
}

export async function fetchOrderRules(): Promise<OrderRules> {
  const { data } = await apiClient.get<Envelope<{ data: OrderRules }>>(ENDPOINTS.ORDER_SETTINGS)
  return data.data.data
}

export async function saveOrderRules(rules: OrderRules): Promise<OrderRules> {
  const { data } = await apiClient.post<Envelope<{ data: OrderRules }>>(ENDPOINTS.ORDER_SETTINGS, rules)
  return data.data.data
}
