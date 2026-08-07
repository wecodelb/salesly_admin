import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/shared/hooks/use-toast'
import {
  acceptDepotTransfer,
  approveRefillRequest,
  cancelDepotTransfer,
  createDepotTransfer,
  createRefillRequest,
  deleteDepotTransfer,
  fetchDepotStock,
  fetchDepotTransfer,
  fetchDepotTransfers,
  fetchWarehouses,
  issueDepotTransfer,
  rejectRefillRequest,
  updateDepotTransfer,
} from '../api/my-depot-api'
import type {
  AcceptTransferPayload,
  CreateDepotTransferPayload,
  DepotDirectoryEntry,
  DepotTransfer,
  DepotWarehouseRef,
  RefillRequestPayload,
  UpdateDepotTransferPayload,
} from '../types'

const TRANSFERS_KEY = ['depot-transfers'] as const
const STOCK_KEY = ['depot-stock'] as const
const WAREHOUSES_KEY = ['admin-warehouses'] as const

/**
 * Anything that moves stock changes both the paperwork and what a depot holds,
 * so every mutation below refreshes the two together — a load issued while the
 * stock screen is open would otherwise keep showing the goods on the shelf.
 */
function useInvalidateDepot() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: TRANSFERS_KEY })
    qc.invalidateQueries({ queryKey: STOCK_KEY })
  }
}

/**
 * The same refresh, plus whatever the server thought worth saying about a write
 * it nonetheless accepted.
 *
 * A load past the depot's capacity comes back this way rather than as an error,
 * so it is shown beside the success and not instead of it: the document exists,
 * the goods are reserved, and somebody now knows the vehicle is over. Handled
 * here rather than at each call site because the warning belongs to the write,
 * not to the screen that happened to raise it.
 */
function useDepotWriteSettled() {
  const invalidate = useInvalidateDepot()
  const toast = useToast()

  return (result: { warnings?: string[] }) => {
    invalidate()
    for (const note of result.warnings ?? []) toast.warning('Past what it can carry', note)
  }
}

export function useDepotTransfers() {
  return useQuery({ queryKey: TRANSFERS_KEY, queryFn: () => fetchDepotTransfers() })
}

export function useDepotTransfer(id: number | null) {
  return useQuery({
    queryKey: [...TRANSFERS_KEY, id],
    queryFn: () => fetchDepotTransfer(id!),
    enabled: id != null,
  })
}

/**
 * What a warehouse holds. `null` reads the caller's own depot, which is the
 * only thing the endpoint will answer without an id — so the query stays
 * enabled for it rather than waiting for a choice that never comes.
 */
export function useDepotStock(warehouseId: number | null, enabled = true) {
  return useQuery({
    queryKey: [...STOCK_KEY, warehouseId ?? 'own'],
    queryFn: () => fetchDepotStock(warehouseId),
    enabled,
  })
}

export function useWarehouses() {
  return useQuery({ queryKey: WAREHOUSES_KEY, queryFn: () => fetchWarehouses() })
}

/**
 * Which depot belongs to which salesman, read back off the movements feed.
 *
 * The API has no way to ask: GET /warehouses answers with the caller's own
 * assignments and WarehouseResource carries no `is_depot`, so a depot only ever
 * names itself as one end of a transfer. Every document that touched a depot
 * therefore teaches the console one more of them, and the destination is read
 * first so a depot-to-depot handover is filed under the man who ends up holding
 * the goods — the same rule the backend applies.
 *
 * A salesman nobody has ever loaded is simply absent, which the load form says
 * out loud rather than papering over.
 */
export function useDepotDirectory(transfers: DepotTransfer[]): Map<number, DepotDirectoryEntry> {
  return useMemo(() => {
    const bySalesman = new Map<number, DepotDirectoryEntry>()

    for (const transfer of transfers) {
      const salesmanId = transfer.salesman?.id
      if (!salesmanId) continue

      for (const end of [transfer.destination, transfer.source]) {
        if (!end?.is_depot || !end.id) continue
        // Newest first from the endpoint, so the first depot a salesman appears
        // against is the one he is holding now — an older one he has since been
        // moved off must not overwrite it.
        if (!bySalesman.has(salesmanId)) {
          bySalesman.set(salesmanId, { warehouse: end, salesman: transfer.salesman })
        }
        break
      }
    }

    return bySalesman
  }, [transfers])
}

/**
 * Every warehouse the console can name, depots included.
 *
 * GET /warehouses answers with every warehouse in the company for anyone who is
 * not a salesman, each already saying whether it is a depot — so the picker is
 * populated before a single load exists. The feed is still folded in on top of
 * it: it is the only place a depot's OWNER is named, and on a salesman's own
 * login the endpoint narrows to his assignments, where a counterpart warehouse
 * he has moved stock with would otherwise be missing.
 */
export function useWarehouseOptions(transfers: DepotTransfer[]) {
  const { data: warehouses = [] } = useWarehouses()

  return useMemo(() => {
    const byId = new Map<number, DepotWarehouseRef & { owner_name: string | null }>()

    for (const warehouse of warehouses) {
      byId.set(warehouse.id, {
        ...warehouse,
        is_depot: Boolean((warehouse as { is_depot?: boolean }).is_depot),
        owner_name: null,
      })
    }

    for (const transfer of transfers) {
      for (const end of [transfer.source, transfer.destination]) {
        if (!end?.id) continue
        const known = byId.get(end.id)
        // The feed is the only place `is_depot` is ever true, so it wins over
        // the flat `false` the warehouses endpoint forces above.
        byId.set(end.id, {
          ...end,
          owner_name: end.is_depot ? (transfer.salesman?.name ?? known?.owner_name ?? null) : null,
        })
      }
    }

    return [...byId.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [warehouses, transfers])
}

export function useCreateDepotTransfer() {
  const settled = useDepotWriteSettled()
  return useMutation({
    mutationFn: (payload: CreateDepotTransferPayload) => createDepotTransfer(payload),
    onSuccess: settled,
  })
}

export function useUpdateDepotTransfer() {
  const settled = useDepotWriteSettled()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateDepotTransferPayload }) =>
      updateDepotTransfer(id, payload),
    onSuccess: settled,
  })
}

export function useDeleteDepotTransfer() {
  // Nothing comes back from a delete but the emptier shelf: the draft it
  // removed was holding goods nobody had moved yet.
  const invalidate = useInvalidateDepot()
  return useMutation({
    mutationFn: (id: number) => deleteDepotTransfer(id),
    onSuccess: invalidate,
  })
}

export function useIssueDepotTransfer() {
  const settled = useDepotWriteSettled()
  return useMutation({
    mutationFn: (id: number) => issueDepotTransfer(id),
    onSuccess: settled,
  })
}

export function useCancelDepotTransfer() {
  const settled = useDepotWriteSettled()
  return useMutation({
    mutationFn: (id: number) => cancelDepotTransfer(id),
    onSuccess: settled,
  })
}

export function useAcceptDepotTransfer() {
  const settled = useDepotWriteSettled()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AcceptTransferPayload }) =>
      acceptDepotTransfer(id, payload),
    onSuccess: settled,
  })
}

export function useCreateRefillRequest() {
  const settled = useDepotWriteSettled()
  return useMutation({
    mutationFn: (payload: RefillRequestPayload) => createRefillRequest(payload),
    onSuccess: settled,
  })
}

export function useApproveRefillRequest() {
  const settled = useDepotWriteSettled()
  return useMutation({
    mutationFn: (id: number) => approveRefillRequest(id),
    onSuccess: settled,
  })
}

export function useRejectRefillRequest() {
  const settled = useDepotWriteSettled()
  return useMutation({
    mutationFn: (id: number) => rejectRefillRequest(id),
    onSuccess: settled,
  })
}
