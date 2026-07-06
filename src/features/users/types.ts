import type { Permission } from '@/core/auth/permissions'

// A role assignable through the admin console. "owner" is intentionally
// excluded — it is auto-assigned to the company owner by the backend and
// is not offered as a choice here (matches the backend UserRequest rule
// `in:admin,manager,salesman`).
export type AssignableRole = 'admin' | 'manager' | 'salesman'

export type UserStatus = 'active' | 'suspended'

// Shape returned by CompanyUserResource on the backend:
// { id, name, email, phone, image, role, permissions, status }
export interface CompanyUser {
  id: number
  name: string
  email: string
  phone: string | null
  image: string | null
  role: string
  permissions: Permission[]
  status: UserStatus
}

// Payload for POST /users — profile + role + permissions in one call.
export interface CreateUserPayload {
  name: string
  email: string
  phone?: string | null
  image?: string | null
  password: string
  role: AssignableRole
  permissions: Permission[]
}

// Payload for PATCH /users/{id} — every field optional; only what's sent
// is changed. `status` flips active/suspended (deactivate/reactivate).
export interface UpdateUserPayload {
  name?: string
  email?: string
  phone?: string | null
  image?: string | null
  password?: string
  role?: AssignableRole
  permissions?: Permission[]
  status?: UserStatus
}
