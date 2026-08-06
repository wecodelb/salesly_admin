import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type {
  AcceptTransferPayload,
  CreateDepotTransferPayload,
  DepotStock,
  DepotTransfer,
  RefillRequestPayload,
  UpdateDepotTransferPayload,
  WarehouseOption,
} from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
  pagination?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/**
 * What every write hands back: the fields a client files the document away by,
 * plus the whole document under `transfer` so the server's quantities — which
 * the client did not compute — render without a second call.
 */
interface WriteResult {
  id: number
  trs_number: string
  status: string
  total_qty: number
  transfer: DepotTransfer
}

/** Accepting also returns the load it closed, now carrying its acceptance. */
interface AcceptResult extends WriteResult {
  discrepancy_qty: number
  transfer_id: number
  issue: DepotTransfer
}

/** Guard against a malformed `last_page` spinning this forever. */
const MAX_PAGES = 50

/**
 * Every transfer the caller may see, across all pages.
 *
 * The endpoint filters by type, status, salesman, warehouse and date, but the
 * feed is read whole and narrowed in the page: the strip above the table counts
 * requests awaiting approval and loads in transit across the *whole* flow, and
 * a server-filtered fetch would leave those figures echoing the current filter
 * instead of describing the depot operation.
 */
export async function fetchDepotTransfers(perPage = 200): Promise<DepotTransfer[]> {
  const all: DepotTransfer[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiClient.get<Envelope<ListData<DepotTransfer>>>(ENDPOINTS.DEPOT_TRANSFERS, {
      params: { per_page: perPage, page },
    })

    const body = res.data.data
    const rows = body?.data ?? []
    all.push(...rows)

    const lastPage = body?.pagination?.last_page ?? page
    if (rows.length === 0 || page >= lastPage) break
  }

  return all
}

/** One document with its lines, the document behind it and its acceptance. */
export async function fetchDepotTransfer(id: number): Promise<DepotTransfer> {
  const res = await apiClient.get<Envelope<{ data: DepotTransfer }>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}`,
  )
  return res.data.data.data
}

/**
 * Draft a load. The goods are spoken for from this moment — nobody else may
 * promise them — but they stay on the source's shelf until it is issued.
 */
export async function createDepotTransfer(
  payload: CreateDepotTransferPayload,
): Promise<DepotTransfer> {
  const res = await apiClient.post<Envelope<WriteResult>>(ENDPOINTS.DEPOT_TRANSFERS, payload)
  return res.data.data.transfer
}

/** Draft-only. Update is a POST like the rest of this API, not a PATCH. */
export async function updateDepotTransfer(
  id: number,
  payload: UpdateDepotTransferPayload,
): Promise<DepotTransfer> {
  const res = await apiClient.post<Envelope<WriteResult>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}`,
    payload,
  )
  return res.data.data.transfer
}

export async function deleteDepotTransfer(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.DEPOT_TRANSFERS}/${id}`)
}

/** Stock leaves the source here and belongs nowhere until somebody signs. */
export async function issueDepotTransfer(id: number): Promise<DepotTransfer> {
  const res = await apiClient.post<Envelope<WriteResult>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}/issue`,
  )
  return res.data.data.transfer
}

export async function cancelDepotTransfer(id: number): Promise<DepotTransfer> {
  const res = await apiClient.post<Envelope<WriteResult>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}/cancel`,
  )
  return res.data.data.transfer
}

/**
 * Sign for the load. Sending no rows accepts it exactly as issued; a row may
 * only lower its figure, and the shortfall goes back to the source.
 */
export async function acceptDepotTransfer(
  id: number,
  payload: AcceptTransferPayload,
): Promise<AcceptResult> {
  const res = await apiClient.post<Envelope<AcceptResult>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}/accept`,
    payload,
  )
  return res.data.data
}

/** The salesman's half of a transfer — it moves no stock at all. */
export async function createRefillRequest(payload: RefillRequestPayload): Promise<DepotTransfer> {
  const res = await apiClient.post<Envelope<WriteResult>>(ENDPOINTS.REFILL_REQUESTS, payload)
  return res.data.data.transfer
}

export async function approveRefillRequest(id: number): Promise<DepotTransfer> {
  const res = await apiClient.post<Envelope<WriteResult>>(
    `${ENDPOINTS.REFILL_REQUESTS}/${id}/approve`,
  )
  return res.data.data.transfer
}

export async function rejectRefillRequest(id: number): Promise<DepotTransfer> {
  const res = await apiClient.post<Envelope<WriteResult>>(
    `${ENDPOINTS.REFILL_REQUESTS}/${id}/reject`,
  )
  return res.data.data.transfer
}

/**
 * What one warehouse is holding right now. Omitting the id reads the caller's
 * own depot, which is what the salesman's app asks for; naming one is how the
 * console looks into somebody else's — and how the load form checks the source
 * can cover what is being drafted.
 */
export async function fetchDepotStock(warehouseId?: number | null): Promise<DepotStock> {
  const res = await apiClient.get<Envelope<DepotStock>>(ENDPOINTS.MY_DEPOT, {
    params: warehouseId ? { warehouse_id: warehouseId } : undefined,
  })
  return res.data.data
}

/**
 * The warehouses this user may pick a load out of.
 *
 * Scoped by the backend to the caller's own assignments, so it is the source
 * list and nothing more — a salesman's depot never appears here unless the
 * caller happens to share it.
 */
export async function fetchWarehouses(): Promise<WarehouseOption[]> {
  const res = await apiClient.get<Envelope<ListData<WarehouseOption>>>(ENDPOINTS.WAREHOUSES, {
    params: { per_page: 200 },
  })
  return res.data.data?.data ?? []
}
