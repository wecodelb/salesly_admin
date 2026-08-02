import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createArea, deleteArea, fetchAreas, updateArea } from '../api/areas-api'
import type { CreateAreaPayload, UpdateAreaPayload } from '../types'

const AREAS_KEY = ['admin-areas'] as const

export function useAreas() {
  return useQuery({ queryKey: AREAS_KEY, queryFn: () => fetchAreas() })
}

export function useCreateArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateAreaPayload) => createArea(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: AREAS_KEY }),
  })
}

export function useUpdateArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateAreaPayload }) =>
      updateArea(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: AREAS_KEY }),
  })
}

export function useDeleteArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteArea(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: AREAS_KEY }),
  })
}
