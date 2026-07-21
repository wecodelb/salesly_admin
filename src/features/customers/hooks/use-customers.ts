import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchUsers } from '@/features/users/api/users-api'
import { fetchCustomers, updateCustomer } from '../api/customers-api'
import {
  mockAssignSalesman,
  mockFetchCustomers,
  mockFetchSalesmen,
  mockSetCreditLimit,
} from '../mock-data'
import type { SalesmanOption } from '../types'

// ─── THE WIRING SWITCH ──────────────────────────────────────────────────────
// true  → serve the mock store (backend part 1 is with the backend developer).
// false → real API: GET/PATCH /customers + salesmen from GET /users.
// Flipping this single flag is the only step left to wire the page.
export const USE_MOCK_DATA = false

const CUSTOMERS_KEY = ['admin-customers'] as const
const SALESMEN_KEY = ['salesmen-options'] as const

export function useCustomers() {
  return useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: () => (USE_MOCK_DATA ? mockFetchCustomers() : fetchCustomers()),
  })
}

/** Salesmen for the assign dropdown — the company users with role=salesman. */
export function useSalesmen() {
  return useQuery({
    queryKey: SALESMEN_KEY,
    queryFn: async (): Promise<SalesmanOption[]> => {
      if (USE_MOCK_DATA) return mockFetchSalesmen()
      const users = await fetchUsers()
      return users
        .filter((u) => u.role === 'salesman' && u.status === 'active')
        .map((u) => ({ id: u.id, name: u.name }))
    },
  })
}

export function useAssignSalesman() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, salesmanId }: { id: number; salesmanId: number | null }) =>
      USE_MOCK_DATA
        ? mockAssignSalesman(id, salesmanId)
        : updateCustomer(id, { salesman_id: salesmanId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export function useSetCreditLimit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, creditLimit }: { id: number; creditLimit: number | null }) =>
      USE_MOCK_DATA
        ? mockSetCreditLimit(id, creditLimit)
        : updateCustomer(id, { credit_limit: creditLimit }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}
