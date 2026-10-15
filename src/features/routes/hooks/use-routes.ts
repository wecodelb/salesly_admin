import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteVisitPlan, fetchRouteDay, fetchVisitPlans, saveVisitPlan } from '../api/routes-api'
import type { VisitPlanInput } from '../types'

const ROUTES_KEY = ['visit-plans'] as const

export function useVisitPlans(salesmanId: number | null, enabled = true) {
  return useQuery({
    queryKey: [...ROUTES_KEY, 'list', salesmanId],
    queryFn: () => fetchVisitPlans(salesmanId),
    enabled,
    retry: (count, error) => (error as { response?: { status?: number } })?.response?.status !== 403 && count < 2,
  })
}

export function useRouteDay(salesmanId: number | null, date: string) {
  return useQuery({
    queryKey: [...ROUTES_KEY, 'day', salesmanId, date],
    queryFn: () => fetchRouteDay(salesmanId as number, date),
    enabled: salesmanId != null,
  })
}

/** Saving or removing a plan changes the list and every day it falls on. */
export function useVisitPlanActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ROUTES_KEY })

  return {
    save: useMutation({ mutationFn: (input: VisitPlanInput) => saveVisitPlan(input), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: number) => deleteVisitPlan(id), onSuccess: refresh }),
  }
}
