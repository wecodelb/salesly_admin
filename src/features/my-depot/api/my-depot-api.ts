import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type {
  AcceptTransferPayload,
  CreateDepotTransferPayload,
  DepotStock,
  DepotSummary,
  DepotTransfer,
  LoadRequestPayload,
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
interface WriteResponse {
  id: number
  trs_number: string
  status: string
  total_qty: number
  transfer: DepotTransfer
  /**
   * What the server let through and still wants said. A load past the depot's
   * capacity arrives here rather than as a 422: the cap is somebody's estimate
   * typed once, and the man strapping the last pallet on can see the vehicle.
   */
  warnings?: { capacity?: string | string[] | null } | null
}

/** Accepting also returns the load it closed, now carrying its acceptance. */
interface AcceptResponse extends WriteResponse {
  discrepancy_qty: number
  transfer_id: number
  issue: DepotTransfer
}

/** The document, and anything the server said about it that isn't a refusal. */
export interface DepotWriteResult {
  transfer: DepotTransfer
  warnings: string[]
}

export interface DepotAcceptResult extends DepotWriteResult {
  discrepancy_qty: number
  /** The load that was closed, now carrying its acceptance. */
  issue: DepotTransfer
}

/** One note or several — the endpoint may say a depot is over on weight and
 *  over on volume, and both are worth reading. */
function capacityWarnings(body: WriteResponse | null | undefined): string[] {
  const raw = body?.warnings?.capacity
  if (!raw) return []

  const notes = Array.isArray(raw) ? raw : [raw]
  return notes.filter((note): note is string => typeof note === 'string' && note.trim() !== '')
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

/**
 * How many load requests are still waiting for an answer.
 *
 * Asked as a filtered count rather than read off the feed the loads page
 * already holds: this figure sits in the sidebar on every screen and refetches
 * on a timer, and walking every page of the movements feed twice a minute to
 * count four documents would be paid for by everybody. `per_page=1` because
 * only the total is wanted — the rows are thrown away.
 */
export async function fetchPendingLoadRequestCount(): Promise<number> {
  const res = await apiClient.get<Envelope<ListData<DepotTransfer>>>(ENDPOINTS.DEPOT_TRANSFERS, {
    params: { trs_type: 'LR', status: 'DRAFT', per_page: 1 },
  })

  const body = res.data.data
  return body?.pagination?.total ?? body?.data?.length ?? 0
}

// ─── Unloads: what the salesman is sending back ─────────────────────────────
//
// An unload is a load pointing the other way — the same LI document, its
// source being a depot instead of its destination. There is no separate list
// endpoint and there should not be: `flow` asks the question of the two
// warehouse columns the document already carries.

/**
 * Every unload, newest first — pending ones and the ones already answered.
 *
 * Read whole rather than a page at a time, like the transfers list beside it,
 * because the strip above the table totals what is on screen.
 */
export async function fetchUnloads(perPage = 200): Promise<DepotTransfer[]> {
  const all: DepotTransfer[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiClient.get<Envelope<ListData<DepotTransfer>>>(ENDPOINTS.DEPOT_TRANSFERS, {
      params: { flow: 'unload', trs_type: 'LI', per_page: perPage, page },
    })

    const body = res.data.data
    all.push(...(body?.data ?? []))

    if (page >= (body?.pagination?.last_page ?? 1)) break
  }

  return all
}

/**
 * How many are waiting on somebody here.
 *
 * DRAFT is the whole state: an unload sits as a draft holding the goods
 * reserved on the salesman's van, and until this number is zero there is stock
 * he cannot sell and the warehouse has not taken.
 */
export async function fetchPendingUnloadCount(): Promise<number> {
  const res = await apiClient.get<Envelope<ListData<DepotTransfer>>>(ENDPOINTS.DEPOT_TRANSFERS, {
    params: { flow: 'unload', trs_type: 'LI', status: 'DRAFT', per_page: 1 },
  })

  const body = res.data.data
  return body?.pagination?.total ?? body?.data?.length ?? 0
}

/**
 * Take the goods back. One call issues and accepts, because there is no
 * journey to record — the salesman is at the bay with the crates.
 *
 * `rows` carries only the lines being signed for short; silence on a line
 * means it came off the van as declared.
 */
export async function approveUnload(
  id: number,
  payload: AcceptTransferPayload,
): Promise<DepotAcceptResult> {
  const res = await apiClient.post<Envelope<AcceptResponse>>(
    `${ENDPOINTS.UNLOADS}/${id}/approve`,
    payload,
  )
  const body = res.data.data

  return {
    transfer: body.transfer,
    issue: body.issue,
    discrepancy_qty: body.discrepancy_qty,
    warnings: capacityWarnings(body),
  }
}

/** Refuse it. The reservation is dropped and the goods stay on his van. */
export async function rejectUnload(id: number): Promise<DepotWriteResult> {
  const res = await apiClient.post<Envelope<WriteResponse>>(`${ENDPOINTS.UNLOADS}/${id}/reject`)
  const body = res.data.data
  return { transfer: body.transfer, warnings: capacityWarnings(body) }
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
): Promise<DepotWriteResult> {
  const res = await apiClient.post<Envelope<WriteResponse>>(ENDPOINTS.DEPOT_TRANSFERS, payload)
  const body = res.data.data
  return { transfer: body.transfer, warnings: capacityWarnings(body) }
}

/** Draft-only. Update is a POST like the rest of this API, not a PATCH. */
export async function updateDepotTransfer(
  id: number,
  payload: UpdateDepotTransferPayload,
): Promise<DepotWriteResult> {
  const res = await apiClient.post<Envelope<WriteResponse>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}`,
    payload,
  )
  const body = res.data.data
  return { transfer: body.transfer, warnings: capacityWarnings(body) }
}

export async function deleteDepotTransfer(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.DEPOT_TRANSFERS}/${id}`)
}

/** Stock leaves the source here and belongs nowhere until somebody signs. */
export async function issueDepotTransfer(id: number): Promise<DepotWriteResult> {
  const res = await apiClient.post<Envelope<WriteResponse>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}/issue`,
  )
  const body = res.data.data
  return { transfer: body.transfer, warnings: capacityWarnings(body) }
}

export async function cancelDepotTransfer(id: number): Promise<DepotWriteResult> {
  const res = await apiClient.post<Envelope<WriteResponse>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}/cancel`,
  )
  const body = res.data.data
  return { transfer: body.transfer, warnings: capacityWarnings(body) }
}

/**
 * Sign for the load. Sending no rows accepts it exactly as issued; a row may
 * only lower its figure, and the shortfall goes back to the source.
 */
export async function acceptDepotTransfer(
  id: number,
  payload: AcceptTransferPayload,
): Promise<DepotAcceptResult> {
  const res = await apiClient.post<Envelope<AcceptResponse>>(
    `${ENDPOINTS.DEPOT_TRANSFERS}/${id}/accept`,
    payload,
  )
  const body = res.data.data
  return {
    transfer: body.transfer,
    issue: body.issue,
    discrepancy_qty: body.discrepancy_qty,
    warnings: capacityWarnings(body),
  }
}

/** The salesman's half of a transfer — it moves no stock at all. */
export async function createLoadRequest(
  payload: LoadRequestPayload,
): Promise<DepotWriteResult> {
  const res = await apiClient.post<Envelope<WriteResponse>>(ENDPOINTS.LOAD_REQUESTS, payload)
  const body = res.data.data
  return { transfer: body.transfer, warnings: capacityWarnings(body) }
}

export async function approveLoadRequest(id: number): Promise<DepotWriteResult> {
  const res = await apiClient.post<Envelope<WriteResponse>>(
    `${ENDPOINTS.LOAD_REQUESTS}/${id}/approve`,
  )
  const body = res.data.data
  return { transfer: body.transfer, warnings: capacityWarnings(body) }
}

export async function rejectLoadRequest(id: number): Promise<DepotWriteResult> {
  const res = await apiClient.post<Envelope<WriteResponse>>(
    `${ENDPOINTS.LOAD_REQUESTS}/${id}/reject`,
  )
  const body = res.data.data
  return { transfer: body.transfer, warnings: capacityWarnings(body) }
}

/**
 * What one warehouse is holding right now. Omitting the id reads the caller's
 * own depot, which is what the salesman's app asks for; naming one is how the
 * console looks into somebody else's — and how the load form checks the source
 * can cover what is being drafted.
 */
/**
 * Every depot at once, a line each — what the stock screen opens on before
 * anybody has picked a salesman.
 */
export async function fetchAllDepotStock(): Promise<DepotSummary[]> {
  const res = await apiClient.get<Envelope<ListData<DepotSummary>>>(ENDPOINTS.DEPOT_STOCK)
  return res.data.data?.data ?? []
}

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
