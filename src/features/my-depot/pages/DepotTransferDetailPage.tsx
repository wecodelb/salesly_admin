import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  FileCheck2,
  Pencil,
  Send,
  Trash2,
  Truck,
  UserCheck,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal/Modal'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton/LoadingSkeleton'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { AcceptTransferModal } from '../components/AcceptTransferModal'
import { DepotTransferFormDrawer } from '../components/DepotTransferFormDrawer'
import { TransferRoute } from '../components/TransferRoute'
import {
  useCancelDepotTransfer,
  useDeleteDepotTransfer,
  useDepotTransfer,
  useIssueDepotTransfer,
} from '../hooks/use-my-depot'
import {
  TYPE_LABELS,
  VOLUME_UNIT,
  WEIGHT_UNIT,
  formatQty,
  formatVolume,
  formatWeight,
  isAcceptable,
  isEditableDraft,
  lineTotal,
  transferPill,
  type DepotTransferRow,
} from '../types'

const HEADING = 'text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3'
const HEADING_GLOW = { textShadow: '0 0 14px var(--heading-glow)' }

/** One label-and-value pair in the header card. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 truncate text-sm text-[var(--text-primary)]">{children}</div>
    </div>
  )
}

/**
 * One document, whichever of the three it is, and the chain it sits in.
 *
 * A load is only half the story: the request it answers and the acceptance that
 * closed it are separate documents, linked through src_type/src_id, and the
 * argument about a short count weeks later is settled by reading all three
 * together. So both neighbours are shown here rather than left to be hunted
 * down in the feed.
 */
export function DepotTransferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canIssue = can(PERMISSIONS.DEPOT_ISSUE)
  const canAccept = can(PERMISSIONS.DEPOT_ACCEPT)
  const { run } = useActionProgress()

  const transferId = id ? Number(id) : null
  const { data: transfer, isLoading, isError, refetch } = useDepotTransfer(transferId)
  const issueTransfer = useIssueDepotTransfer()
  const cancelTransfer = useCancelDepotTransfer()
  const deleteTransfer = useDeleteDepotTransfer()

  const [editing, setEditing] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // The form drawer pulls the catalog and the whole movements feed the moment
  // it mounts. Reading one document shouldn't pay for that, so it joins the
  // tree on the first Edit and then stays — which keeps the close animation.
  const [formMounted, setFormMounted] = useState(false)

  const back = (
    <Button
      variant="ghost"
      icon={<ArrowLeft size={15} />}
      onClick={() => navigate('/depot-transfers')}
    >
      Back
    </Button>
  )

  if (isLoading) return <LoadingSkeleton />

  if (isError || !transfer) {
    return (
      <>
        <PageHeader title="Depot movement" actions={back} />
        <ErrorState
          title="Couldn't load this document"
          message="It may have been deleted, or the server didn't respond."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  const pill = transferPill(transfer)
  const draft = isEditableDraft(transfer)
  const acceptable = isAcceptable(transfer)
  const rows = transfer.rows ?? []
  // An acceptance carries what actually landed; the other two carry what was
  // asked for or picked. Only the first has anything to compare against.
  const isAcceptanceDoc = transfer.trs_type === 'TRI'
  // Lines carry the item's weight as it stood when the document was written, so
  // an old load still reads back at what it actually took off the vehicle. A
  // document raised before anybody weighed the catalog carries nothing, and the
  // column is left off rather than filled with dashes.
  const hasLineSizes = rows.some((row) => row.weight != null || row.volume != null)

  const handleIssue = () =>
    run(
      {
        label: 'Issuing load',
        detail: transfer.trs_number,
        success: `The goods have left ${transfer.source?.name ?? 'the warehouse'} — in transit until somebody signs.`,
      },
      () => issueTransfer.mutateAsync(transfer.id),
    )

  const handleCancel = () =>
    run(
      {
        label: 'Cancelling load',
        detail: transfer.trs_number,
        success: 'The reservation is back on the shelf; the document stays readable.',
      },
      () => cancelTransfer.mutateAsync(transfer.id),
    )

  const confirmDelete = async () => {
    setDeleting(false)
    const removed = await run(
      {
        label: 'Deleting draft',
        detail: transfer.trs_number,
        success: 'The draft is gone and its reservation released.',
      },
      () => deleteTransfer.mutateAsync(transfer.id),
    )
    if (removed !== null) navigate('/depot-transfers')
  }

  const columns: Column<DepotTransferRow & Record<string, unknown>>[] = [
    {
      key: 'lno',
      header: '#',
      width: 'w-1',
      render: (row) => <span className="tabular-nums text-[var(--text-muted)]">{row.lno}</span>,
    },
    {
      key: 'item_name',
      header: 'Product',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">{row.item_name}</div>
          <div className="font-mono text-xs text-[var(--text-muted)]">{row.item_code}</div>
        </div>
      ),
    },
    {
      key: 'trs_qty',
      header: 'Quantity',
      align: 'right',
      // Both readings: the packaging it was keyed in, and the base units stock
      // is actually counted in. A row saying "4" alone is unreadable when the
      // carton holds twenty-four.
      render: (row) => (
        <div>
          <div className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            {formatQty(row.trs_qty)} {row.uom_name}
          </div>
          <div className="text-xs tabular-nums text-[var(--text-muted)]">
            {formatQty(row.qty)} base
          </div>
        </div>
      ),
    },
    ...(hasLineSizes
      ? [
          {
            key: 'weight',
            header: `Weight / volume`,
            align: 'right' as const,
            render: (row: DepotTransferRow) => {
              const weight = lineTotal(row.qty, row.weight)
              const volume = lineTotal(row.qty, row.volume)
              return (
                <div>
                  <div className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
                    {weight == null ? '—' : `${formatWeight(weight)} ${WEIGHT_UNIT}`}
                  </div>
                  <div className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                    {volume == null ? '—' : `${formatVolume(volume)} ${VOLUME_UNIT}`}
                  </div>
                </div>
              )
            },
          },
        ]
      : []),
    ...(isAcceptanceDoc
      ? [
          {
            key: 'issued_qty',
            header: 'Issued',
            align: 'right' as const,
            render: (row: DepotTransferRow) => (
              <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
                {row.issued_qty != null ? formatQty(row.issued_qty) : '—'}
              </span>
            ),
          },
          {
            key: 'shortfall_qty',
            header: 'Short',
            align: 'right' as const,
            render: (row: DepotTransferRow) =>
              row.shortfall_qty != null && row.shortfall_qty > 0 ? (
                <span className="font-mono text-sm font-medium tabular-nums text-[var(--accent-red)]">
                  {formatQty(row.shortfall_qty)}
                </span>
              ) : (
                <span className="text-sm text-[var(--text-muted)]">—</span>
              ),
          },
        ]
      : []),
    {
      key: 'line_memo',
      header: 'Note',
      render: (row) => (
        <span className="text-sm text-[var(--text-secondary)]">{row.line_memo || '—'}</span>
      ),
    },
  ] as Column<DepotTransferRow & Record<string, unknown>>[]

  return (
    <>
      <PageHeader
        title={transfer.trs_number}
        subtitle={`${TYPE_LABELS[transfer.trs_type]} · ${transfer.trs_date ?? '—'}`}
        actions={
          <div className="flex items-center gap-2">
            {back}
            {canIssue && draft && (
              <>
                <Button variant="outline" icon={<Ban size={15} />} onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  icon={<Trash2 size={15} />}
                  onClick={() => setDeleting(true)}
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  icon={<Pencil size={15} />}
                  onClick={() => {
                    setFormMounted(true)
                    setEditing(true)
                  }}
                >
                  Edit
                </Button>
                <Button icon={<Send size={15} />} onClick={handleIssue}>
                  Issue
                </Button>
              </>
            )}
            {canAccept && acceptable && (
              <Button icon={<FileCheck2 size={15} />} onClick={() => setAccepting(true)}>
                Accept
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusPill status={pill.status} label={pill.label} pulse={transfer.is_in_transit} />
        {transfer.is_in_transit && (
          <span className="text-sm text-[var(--text-secondary)]">
            These goods are in neither warehouse — they left{' '}
            {transfer.source?.name ?? 'the source'} and nobody has signed for them yet.
          </span>
        )}
        {transfer.discrepancy_qty != null && transfer.discrepancy_qty > 0 && (
          <StatusPill status="error" label={`${formatQty(transfer.discrepancy_qty)} short`} />
        )}
      </div>

      <section className="mb-6 rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Route</div>
            <div className="mt-1">
              <TransferRoute source={transfer.source} destination={transfer.destination} size="md" />
            </div>
            <div className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
              {transfer.source?.code ?? '—'} → {transfer.destination?.code ?? '—'}
            </div>
          </div>
          <Fact label="Salesman">
            <span className="inline-flex items-center gap-1.5">
              <UserCheck size={14} aria-hidden className="text-[var(--text-muted)]" />
              {transfer.salesman?.name ?? 'Nobody'}
            </span>
          </Fact>
          <Fact label="Total quantity">
            <span className="font-mono tabular-nums">{formatQty(transfer.total_qty)}</span>
          </Fact>
          {/* What the document costs a vehicle, which is what decides whether
              the next load fits beside it. */}
          <Fact label="Total weight">
            <span className="font-mono tabular-nums">{formatWeight(transfer.total_weight)}</span>{' '}
            {WEIGHT_UNIT}
          </Fact>
          <Fact label="Total volume">
            <span className="font-mono tabular-nums">{formatVolume(transfer.total_volume)}</span>{' '}
            {VOLUME_UNIT}
          </Fact>
          <Fact label="Raised by">{transfer.created_by_name ?? '—'}</Fact>
          <Fact label="Confirmed by">
            {transfer.confirmed_by_name ?? '—'}
            {transfer.confirmed_at ? (
              <span className="text-[var(--text-muted)]"> · {transfer.confirmed_at}</span>
            ) : null}
          </Fact>
          <Fact label="Memo">{transfer.memo || '—'}</Fact>
        </div>
      </section>

      {/* The chain either side of this document. Both are links: reading one
          without the other is how a short count turns into an argument. */}
      {(transfer.source_document || transfer.acceptance) && (
        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {transfer.source_document && (
            <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
              <h3 className={HEADING} style={HEADING_GLOW}>
                Raised against
              </h3>
              <button
                type="button"
                onClick={() => navigate(`/depot-transfers/${transfer.source_document!.id}`)}
                className="w-full cursor-pointer text-left"
              >
                <div className="font-mono text-sm text-[var(--accent-primary)] hover:underline">
                  {transfer.source_document.trs_number}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {TYPE_LABELS[transfer.source_document.trs_type] ?? transfer.source_document.trs_type}{' '}
                  · {transfer.source_document.trs_date ?? '—'}
                </div>
              </button>
            </section>
          )}

          {transfer.acceptance && (
            <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
              <h3 className={HEADING} style={HEADING_GLOW}>
                Signed for
              </h3>
              <button
                type="button"
                onClick={() => navigate(`/depot-transfers/${transfer.acceptance!.id}`)}
                className="w-full cursor-pointer text-left"
              >
                <div className="font-mono text-sm text-[var(--accent-primary)] hover:underline">
                  {transfer.acceptance.trs_number}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {formatQty(transfer.acceptance.total_qty)} accepted ·{' '}
                  {transfer.acceptance.trs_date ?? '—'}
                </div>
              </button>
              {transfer.acceptance.discrepancy_qty > 0 && (
                <p className="mt-2 rounded-[var(--radius-card)] bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]">
                  {formatQty(transfer.acceptance.discrepancy_qty)} never arrived — credited back to{' '}
                  {transfer.source?.name ?? 'the source'}.
                </p>
              )}
            </section>
          )}
        </div>
      )}

      <section>
        <h3 className={HEADING} style={HEADING_GLOW}>
          Lines
        </h3>
        <DataTable
          columns={columns}
          data={rows as (DepotTransferRow & Record<string, unknown>)[]}
          keyField="id"
          emptyIcon={<Truck size={30} />}
          emptyMessage="This document has no lines."
        />
      </section>

      {formMounted && (
        <DepotTransferFormDrawer
          open={editing}
          onClose={() => setEditing(false)}
          transfer={transfer}
        />
      )}

      <AcceptTransferModal
        transfer={accepting ? transfer : null}
        onClose={() => setAccepting(false)}
      />

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete draft load"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteTransfer.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Delete <span className="font-medium text-[var(--text-primary)]">{transfer.trs_number}</span>?
          Nothing has left the warehouse yet — the goods it was holding go straight back on the
          shelf, and the document disappears for good.
        </p>
      </Modal>
    </>
  )
}
