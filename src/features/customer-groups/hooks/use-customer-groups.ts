import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomerGroup,
  deleteCustomerGroup,
  fetchCustomerGroups,
  updateCustomerGroup,
} from '../api/customer-groups-api'
import type { CreateCustomerGroupPayload, UpdateCustomerGroupPayload } from '../types'

const CUSTOMER_GROUPS_KEY = ['admin-customer-groups'] as const

/**
 * Shared by the Preferences screen and every customer-facing picker, so the
 * list is fetched once and reused rather than re-requested per consumer.
 */
export function useCustomerGroups() {
  return useQuery({ queryKey: CUSTOMER_GROUPS_KEY, queryFn: () => fetchCustomerGroups() })
}

export function useCreateCustomerGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCustomerGroupPayload) => createCustomerGroup(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMER_GROUPS_KEY }),
  })
}

export function useUpdateCustomerGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateCustomerGroupPayload }) =>
      updateCustomerGroup(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMER_GROUPS_KEY }),
  })
}

export function useDeleteCustomerGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCustomerGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMER_GROUPS_KEY }),
  })
}
