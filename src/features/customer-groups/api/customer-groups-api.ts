import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type {
  CreateCustomerGroupPayload,
  CustomerGroup,
  UpdateCustomerGroupPayload,
} from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
}

export async function fetchCustomerGroups(): Promise<CustomerGroup[]> {
  const res = await apiClient.get<Envelope<ListData<CustomerGroup>>>(ENDPOINTS.CUSTOMER_GROUPS)
  return res.data.data?.data ?? []
}

export async function createCustomerGroup(
  payload: CreateCustomerGroupPayload,
): Promise<CustomerGroup> {
  const res = await apiClient.post<Envelope<{ data: CustomerGroup }>>(
    ENDPOINTS.CUSTOMER_GROUPS,
    payload,
  )
  return res.data.data.data
}

export async function updateCustomerGroup(
  id: number,
  payload: UpdateCustomerGroupPayload,
): Promise<CustomerGroup> {
  const res = await apiClient.post<Envelope<{ data: CustomerGroup }>>(
    `${ENDPOINTS.CUSTOMER_GROUPS}/${id}`,
    payload,
  )
  return res.data.data.data
}

/** Rejected with 409 while customers still carry the group. */
export async function deleteCustomerGroup(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.CUSTOMER_GROUPS}/${id}`)
}
