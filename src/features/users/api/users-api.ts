import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { CompanyUser, CreateUserPayload, UpdateUserPayload } from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

// GET /users — paginated list. Backend nests as data.data + data.pagination.
interface UsersListData {
  data: CompanyUser[]
  pagination: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export async function fetchUsers(perPage = 100): Promise<CompanyUser[]> {
  const res = await apiClient.get<Envelope<UsersListData>>(ENDPOINTS.USERS, {
    params: { per_page: perPage },
  })
  return res.data.data.data
}

export async function createUser(payload: CreateUserPayload): Promise<void> {
  await apiClient.post(ENDPOINTS.USERS, payload)
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<void> {
  await apiClient.patch(`${ENDPOINTS.USERS}/${id}`, payload)
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.USERS}/${id}`)
}
