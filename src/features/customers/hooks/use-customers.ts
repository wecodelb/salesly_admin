import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchUsers } from '@/features/users/api/users-api'
import {
  assignPriceList,
  createCustomer,
  deleteAttachment,
  deleteCustomer,
  fetchCustomer,
  fetchCustomers,
  restoreCustomer,
  setCustomerActive,
  unassignPriceList,
  updateCustomer,
  uploadAttachments,
  verifyCustomer,
} from '../api/customers-api'
import {
  mockAssignSalesman,
  mockFetchCustomers,
  mockFetchSalesmen,
  mockSetCreditLimit,
} from '../mock-data'
import type {
  CreateCustomerPayload,
  SalesmanOption,
  UpdateCustomerPayload,
} from '../types'

// ─── THE WIRING SWITCH ──────────────────────────────────────────────────────
// true  → serve the mock store (backend part 1 is with the backend developer).
// false → real API: GET/PATCH /customers + salesmen from GET /users.
// Flipping this single flag is the only step left to wire the page.
export const USE_MOCK_DATA = false

const CUSTOMERS_KEY = ['admin-customers'] as const
const SALESMEN_KEY = ['salesmen-options'] as const

// The price-lists screen fetches customers under its own key for its picker,
// so anything that changes a customer has to refresh both or that picker keeps
// showing stale names.
function useInvalidateCustomers() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: CUSTOMERS_KEY })
    qc.invalidateQueries({ queryKey: ['admin-customer-options'] })
  }
}

export function useCustomers() {
  return useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: () => (USE_MOCK_DATA ? mockFetchCustomers() : fetchCustomers()),
  })
}

export function useCustomer(id: number | null) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, id],
    queryFn: () => fetchCustomer(id!),
    enabled: id != null,
  })
}

export function useCreateCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: (payload: CreateCustomerPayload) => createCustomer(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateCustomerPayload }) =>
      updateCustomer(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: invalidate,
  })
}

export function useRestoreCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: (id: number) => restoreCustomer(id),
    onSuccess: invalidate,
  })
}

export function useSetCustomerActive() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      setCustomerActive(id, active),
    onSuccess: invalidate,
  })
}

export function useVerifyCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: (id: number) => verifyCustomer(id),
    onSuccess: invalidate,
  })
}

export function useUploadAttachments() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: ({ customerId, files }: { customerId: number; files: File[] }) =>
      uploadAttachments(customerId, files),
    onSuccess: invalidate,
  })
}

export function useDeleteAttachment() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: ({ customerId, attachmentId }: { customerId: number; attachmentId: number }) =>
      deleteAttachment(customerId, attachmentId),
    onSuccess: invalidate,
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
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: ({ id, salesmanId }: { id: number; salesmanId: number | null }) =>
      USE_MOCK_DATA
        ? mockAssignSalesman(id, salesmanId)
        : updateCustomer(id, { salesman_id: salesmanId }),
    onSuccess: invalidate,
  })
}

export function useSetCreditLimit() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: ({ id, creditLimit }: { id: number; creditLimit: number | null }) =>
      USE_MOCK_DATA
        ? mockSetCreditLimit(id, creditLimit)
        : // Setting a limit says the customer has credit, so it turns the flag on
          // with it. Otherwise this shortcut would write a cap onto a cash-only
          // shop where the server refuses every unpaid invoice anyway, and the
          // number would sit there meaning nothing.
          updateCustomer(id, { credit_limit: creditLimit, allow_credit: true }),
    onSuccess: invalidate,
  })
}

export function useAssignPriceList() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: ({ customerId, priceListId }: { customerId: number; priceListId: number }) =>
      assignPriceList(customerId, priceListId),
    onSuccess: invalidate,
  })
}

export function useUnassignPriceList() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: ({ customerId, priceListId }: { customerId: number; priceListId: number }) =>
      unassignPriceList(customerId, priceListId),
    onSuccess: invalidate,
  })
}
