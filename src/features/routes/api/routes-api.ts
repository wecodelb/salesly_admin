import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { RouteDay, VisitPlan, VisitPlanInput } from '../types'

// Backend envelope: { status, message, data }; the payload sits in data.data.
interface Envelope<T> {
  status: string
  message: string | null
  data: { data: T }
}

/** Every plan in the company — a round is a few hundred shops at most. */
export async function fetchVisitPlans(salesmanId?: number | null): Promise<VisitPlan[]> {
  const { data } = await apiClient.get<Envelope<VisitPlan[]>>(ENDPOINTS.VISIT_PLANS, {
    params: { per_page: 500, ...(salesmanId ? { salesman_id: salesmanId } : {}) },
  })
  return data.data.data ?? []
}

/** Planning a customer again replaces their plan. */
export async function saveVisitPlan(input: VisitPlanInput): Promise<VisitPlan> {
  const { data } = await apiClient.post<Envelope<VisitPlan>>(ENDPOINTS.VISIT_PLANS, input)
  return data.data.data
}

export async function deleteVisitPlan(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.VISIT_PLANS}/${id}`)
}

export async function fetchRouteDay(salesmanId: number, date: string): Promise<RouteDay> {
  const { data } = await apiClient.get<Envelope<RouteDay>>(ENDPOINTS.ROUTE_DAY, {
    params: { salesman_id: salesmanId, date },
  })
  return data.data.data
}
