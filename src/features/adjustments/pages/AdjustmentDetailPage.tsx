import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ClipboardList, Pencil, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { Modal } from '@/shared/components/Modal/Modal'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { AdjustmentFormDrawer } from '../components/AdjustmentFormDrawer'
import {
  useAdjustment,
  useApproveAdjustment,
  useDeleteAdjustment,
  useRejectAdjustment,
} from '../hooks/use-adjustments'
import {
  directionLabel,
  formatQty,
  hasMovedStock,
  isEditable,
  rowsOf,
  statusPill,
  type AdjustmentRow,
} from '../types'

/**
 * One adjustment sheet: what moved, why, and whether it has actually happened.
 *
 * The loudest thing on the page is the status, because it is the difference
 * between a record of the shelf and a request about it. Every row shows what
 * the shelf held either side — but only once approved, since before that there
 * is nothing to show and a figure would be an invention.
 */
export function AdjustmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { run } = useActionProgress()
  const { can } = usePermissions()

  const canApprove = can(PERMISSIONS.ADJUSTMENTS_APPROVE)
  const canWrite = can(PERMISSIONS.ADJUSTMENTS_CREATE)

  const adjustmentId = id ? Number(id) : null
  const { data: adjustment, isLoading, isError, refetch } = useAdjustment(adjustmentId)

  const approve = useApproveAdjustment()
  const reject = useRejectAdjustment()
  const remove = useDeleteAdjustment()

  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<'reject' | 'delete' | null>(null)

  const back = (
    <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => navigate('/adjustments')}>
      Back
    </Button>
  )

  if (isError) {
    return (
      <>
        <PageHeader title="Adjustment" subtitle="Stock that moved without a sale" actions={back} />
        <ErrorState
          title="Couldn't open this adjustment"
          message="It may have been removed, or it belongs to another company. Go back to the list, or retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  const rows = adjustment ? rowsOf(adjustment) : []
  const pill = adjustment ? statusPill(adjustment) : null
  const moved = adjustment ? hasMovedStock(adjustment) : false

  const inQty = rows.filter((r) => r.direction === 'in').reduce((s, r) => s + r.qty, 0)
  const outQty = rows.filter((r) => r.direction === 'out').reduce((s, r) => s + r.qty, 0)

  const stats = [
    { label: 'Rows', value: rows.length },
    { label: 'Units in', value: formatQty(inQty) },
    { label: 'Units out', value: formatQty(outQty) },
    {
      label: 'Net',
      value: formatQty(inQty - outQty),
      tone: inQty - outQty < 0 ? ('warn' as const) : undefined,
    },
  ]

  const columns: Column<AdjustmentRow & Record<string, unknown>>[] = [
    {
      key: 'item_name',
      header: 'Product',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">{row.item_name || '—'}</div>
          <div className="font-mono text-xs text-[var(--text-muted)]">{row.item_code}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span className="inline-flex rounded-[var(--radius-pill)] bg-[var(--bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
          {row.type?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'direction',
      header: 'Way',
      render: (row) => (
        <span
          className={
            row.direction === 'out'
              ? 'text-sm text-[var(--accent-amber)]'
              : 'text-sm text-[var(--accent-green)]'
          }
        >
          {directionLabel(row.direction)}
        </span>
      ),
    },
    {
      key: 'trs_qty',
      header: 'Counted',
      align: 'right',
      // What somebody wrote down, with the base quantity underneath: the first
      // is what was agreed, the second is what moves on the shelf.
      render: (row) => (
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            {formatQty(row.trs_qty)} {row.uom_name}
          </span>
          {row.qty !== row.trs_qty && (
            <span className="text-xs text-[var(--text-muted)]">{formatQty(row.qty)} base</span>
          )}
        </div>
      ),
    },
    {
      key: 'qty_before',
      header: 'Shelf before → after',
      align: 'right',
      // Empty until approval, deliberately. Before that there is nothing to
      // show, and a figure here would be an invention.
      render: (row) =>
        row.qty_before == null ? (
          <span className="text-sm text-[var(--text-muted)]">not applied</span>
        ) : (
          <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
            {formatQty(row.qty_before)} → {formatQty(row.qty_after)}
          </span>
        ),
    },
    {
      key: 'memo',
      header: 'Note',
      render: (row) => (
        <span className="text-sm text-[var(--text-secondary)]">{row.memo || '—'}</span>
      ),
    },
  ]

  const act = async (
    what: 'approve' | 'reject' | 'delete',
  ): Promise<void> => {
    if (!adjustment) return
    setConfirming(null)

    const labels = {
      approve: { label: 'Approving adjustment', success: 'Approved — the stock has moved.' },
      reject: { label: 'Rejecting adjustment', success: 'Rejected. Any stock it moved has gone back.' },
      delete: { label: 'Removing adjustment', success: 'The sheet was removed.' },
    } as const

    await run(labels[what], async () => {
      if (what === 'approve') await approve.mutateAsync(adjustment.id)
      else if (what === 'reject') await reject.mutateAsync(adjustment.id)
      else await remove.mutateAsync(adjustment.id)
    })

    if (what === 'delete') navigate('/adjustments')
  }

  return (
    <>
      <PageHeader
        title={adjustment ? `Adjustment #${adjustment.number}` : 'Adjustment'}
        subtitle={[adjustment?.warehouse, adjustment?.adjusted_at, adjustment?.created_by?.name]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            {pill && <StatusPill status={pill.status} label={pill.label} />}

            {adjustment && canWrite && isEditable(adjustment) && (
              <Button variant="outline" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}

            {adjustment && canApprove && adjustment.status !== 'approved' && (
              <Button icon={<Check size={15} />} onClick={() => act('approve')}>
                Approve
              </Button>
            )}

            {adjustment && canApprove && adjustment.status !== 'rejected' && (
              <Button
                variant="outline"
                icon={<X size={15} />}
                onClick={() => setConfirming('reject')}
              >
                Reject
              </Button>
            )}

            {adjustment && canWrite && !moved && (
              <Button
                variant="ghost"
                icon={<Trash2 size={15} />}
                onClick={() => setConfirming('delete')}
              >
                Remove
              </Button>
            )}

            {back}
          </div>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      {/* Said plainly, because it is the whole difference between this page
          being a record and being a request. */}
      {adjustment && !moved && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface-raised)] px-4 py-3">
          <ClipboardList size={15} aria-hidden className="mt-0.5 text-[var(--text-muted)]" />
          <p className="text-xs text-[var(--text-secondary)]">
            {adjustment.status === 'rejected'
              ? 'This sheet was rejected. No stock has moved — anything it had applied has been put back.'
              : 'Nothing has moved yet. The stock on this sheet changes only when somebody approves it.'}
          </p>
        </div>
      )}

      {adjustment?.memo && (
        <p className="mb-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          {adjustment.memo}
        </p>
      )}

      <DataTable
        columns={columns}
        data={rows as (AdjustmentRow & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        emptyIcon={<ClipboardList size={28} />}
        emptyMessage="This adjustment has no rows."
      />

      {editing && adjustment && (
        <AdjustmentFormDrawer open adjustment={adjustment} onClose={() => setEditing(false)} />
      )}

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === 'reject' ? 'Reject this adjustment?' : 'Remove this adjustment?'}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant={confirming === 'delete' ? 'danger' : 'primary'}
              onClick={() => act(confirming === 'reject' ? 'reject' : 'delete')}
            >
              {confirming === 'reject' ? 'Reject' : 'Remove'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          {confirming === 'reject'
            ? moved
              ? 'The stock this sheet moved will be put back on the shelf, and the sheet stays on the record as rejected.'
              : 'The sheet stays on the record as rejected. No stock moves — none has moved yet.'
            : 'The sheet is removed. It has moved no stock, so nothing on the shelf changes.'}
        </p>
      </Modal>
    </>
  )
}
