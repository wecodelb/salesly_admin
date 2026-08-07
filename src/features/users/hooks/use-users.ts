import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, deleteUser, fetchUsers, updateUser } from '../api/users-api'
import type { CompanyUser, CreateUserPayload, UpdateUserPayload } from '../types'

const USERS_KEY = ['users'] as const

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => fetchUsers(),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      updateUser(id, payload),
    // Optimistically apply the change (e.g. status active/suspended) so the
    // row reflects it immediately, then reconcile with the server on settle.
    // Without this, a reactivate could look like "nothing happened" until the
    // background refetch lands.
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: USERS_KEY })
      const previous = qc.getQueryData<CompanyUser[]>(USERS_KEY)
      if (previous) {
        qc.setQueryData<CompanyUser[]>(
          USERS_KEY,
          previous.map((u) => (u.id === id ? { ...u, ...payload } : u)),
        )
      }
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(USERS_KEY, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

// Moved to core/api so shared components can report errors too; re-exported
// here because most of the app has always imported it from this module.
export { apiErrorMessage } from '@/core/api/api-error'
