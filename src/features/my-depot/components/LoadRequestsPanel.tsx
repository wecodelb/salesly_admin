import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Inbox, PackagePlus, X } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useApproveRefillRequest, useRejectRefillRequest } from '../hooks/use-my-depot'
import { formatQty, isApprovedRequest, isPendingRequest, type DepotTransfer } from '../types'

interface Props {
  transfers: DepotTransfer[]
  /** Opens the load form seeded from this request, so an approval turns into a
   *  load without anyone re-keying the lines. */
  onLoadFrom: (request: DepotTransfer) => void
}

/**
 * The warehouse's inbox: what the salesmen are asking for.
 *
 * A request moves no stock, so answering one commits nothing — it only decides
 * whether a load may be raised against it. Both answers ride on depot.issue,
 * because what leaves the building is the warehouse's call and not the asker's.
 *
 * Approved requests stay on the panel until somebody loads against them: an
 * approval nobody acted on is exactly the thing that gets forgotten, and it is
 * the only place the "load from this" button can live.
 *
 * Every row opens the document. A request is a list of goods, and this panel
 * shows none of it — approving one off a quantity total alone is signing for a
 * load nobody has read. The lines live on the detail page, which answers both
 * questions in the same place: what is being asked for, and yes or no.
 */
export function RefillRequestsPanel({ transfers, onLoadFrom }: Props) {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canIssue = can(PERMISSIONS.DEPOT_ISSUE)
  const { run } = useActionProgress()
  const approveRequest = useApproveRefillRequest()
  const rejectRequest = useRejectRefillRequest()

  const pending = transfers.filter(isPendingRequest)
  // A request already answered with a load is done with; one still waiting for
  // its load is not.
  const loadedRequestIds = new Set(
    transfers.filter((t) => t.trs_type === 'TRO' && t.src_id).map((t) => t.src_id),
  )
  const approved = transfers.filter(
    (t) => isApprovedRequest(t) && !loadedRequestIds.has(t.id),
  )

  const waiting = [...pending, ...approved]
  if (waiting.length === 0) return null

  const handleApprove = (request: DepotTransfer) =>
    run(
      {
        label: 'Approving request',
        detail: request.trs_number,
        success: `${request.trs_number} is approved — raise the load when the picking is done.`,
      },
      () => approveRequest.mutateAsync(request.id),
    )

  const handleReject = (request: DepotTransfer) =>
    run(
      {
        label: 'Rejecting request',
        detail: request.trs_number,
        success: `${request.trs_number} was turned down. Nothing moved.`,
      },
      () => rejectRequest.mutateAsync(request.id),
    )

  return (
    <section className="mb-5 flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-center gap-2">
        <Inbox size={15} aria-hidden className="text-[var(--accent-amber)]" />
        <h2 className="font-heading text-sm font-semibold text-[var(--text-primary)]">
          Refill requests
        </h2>
        <span className="rounded-full bg-[var(--accent-amber)]/12 px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--accent-amber)]">
          {waiting.length}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        {waiting.map((request) => {
          const isPending = isPendingRequest(request)

          return (
            <div
              key={request.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0"
            >
              {/* The clickable area is the description and nothing else: the
                  answer buttons sit beside it and must never be a near-miss for
                  the thing that opens the document. */}
              <button
                type="button"
                onClick={() => navigate(`/depot-transfers/${request.id}`)}
                title={`Read what ${request.trs_number} is asking for`}
                className="group -mx-2 min-w-0 flex-1 cursor-pointer rounded-[var(--radius-btn)] px-2 py-1 text-left transition-colors hover:bg-[var(--bg-surface-raised)]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)] group-hover:underline">
                    {request.trs_number}
                  </span>
                  {!isPending && (
                    <span className="rounded-[var(--radius-pill)] bg-[var(--accent-green)]/12 px-2 py-0.5 text-xs font-medium text-[var(--accent-green)]">
                      Approved — not loaded yet
                    </span>
                  )}
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className="text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {request.salesman?.name ?? 'Unassigned'} · {formatQty(request.total_qty)} units
                  from {request.source?.name ?? '—'} · {request.trs_date ?? '—'}
                </div>
              </button>

              {canIssue && (
                <div className="flex items-center gap-2">
                  {isPending ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<X size={14} />}
                        onClick={() => handleReject(request)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        icon={<Check size={14} />}
                        onClick={() => handleApprove(request)}
                      >
                        Approve
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      icon={<PackagePlus size={14} />}
                      onClick={() => onLoadFrom(request)}
                    >
                      Create the load
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
