import type { DepotWriteResult } from './api/my-depot-api'
import type { CreateDepotTransferPayload } from './types'

/**
 * Answering a load request: approve it if nobody has, then raise the load and
 * send it out.
 *
 * Two rules, and both were learned the hard way.
 *
 *  - The approval comes first. The server refuses `from_request_id` on a request
 *    nobody has approved, so creating before approving is a guaranteed 422 — and
 *    a load created against an unapproved request is the one state the two
 *    documents must never be left in.
 *  - The load is issued as it is created, in the server's own transaction, via
 *    `issue: true`. Creating alone leaves a draft, and a draft is invisible to
 *    the salesman's Receive action while his row already reads "Load issued" —
 *    he has nothing to press and nothing on screen says why.
 *
 * The issue deliberately rides on the create rather than following it as a
 * second call. Two writes that must both happen belong in one transaction: a
 * browser that died in between would leave exactly the half-state this exists to
 * remove.
 *
 * The operations are injected rather than imported so this can be tested without
 * a DOM, a query client or a server.
 */
export interface RaiseLoadOps {
  approve: (requestId: number) => Promise<unknown>
  create: (payload: CreateDepotTransferPayload) => Promise<DepotWriteResult>
}

export async function raiseLoad(
  ops: RaiseLoadOps,
  {
    payload,
    approveRequestId,
  }: { payload: CreateDepotTransferPayload; approveRequestId?: number | null },
): Promise<DepotWriteResult> {
  if (approveRequestId != null) await ops.approve(approveRequestId)

  return ops.create({ ...payload, issue: true })
}
