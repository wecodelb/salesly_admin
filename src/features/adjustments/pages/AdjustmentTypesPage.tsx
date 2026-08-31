import { useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { adjustmentTypesExportDoc } from '../adjustment-types-export'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal/Modal'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { CodeChip } from '@/shared/components/CodeChip/CodeChip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { AdjustmentTypeFormDrawer } from '../components/AdjustmentTypeFormDrawer'
import {
  useAdjustmentTypes,
  useDeleteAdjustmentType,
  useUpdateAdjustmentType,
} from '../hooks/use-adjustments'
import { canDeleteType, directionWord, undeletableBecause } from '../types'
import type { AdjustmentType } from '../types'

type Row = AdjustmentType & Record<string, unknown>

/** How a direction reads in the table — the arrow carries it before the words do. */
function DirectionCell({ direction }: { direction: AdjustmentType['direction'] }) {
  const tone =
    direction === 'out'
      ? 'text-[var(--accent-red)]'
      : direction === 'in'
        ? 'text-[var(--accent-green)]'
        : 'text-[var(--text-muted)]'

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      {direction === 'in' ? (
        <ArrowDownToLine size={13} />
      ) : direction === 'out' ? (
        <ArrowUpFromLine size={13} />
      ) : (
        <span className="text-[10px] leading-none">⇅</span>
      )}
      {directionWord(direction)}
    </span>
  )
}

/**
 * The kinds of adjustment this company recognises.
 *
 * A short list with one rule of any weight: a type is switched off, not
 * deleted, once anything has been written under it — and the five seeded with
 * the company are never deletable at all. The screen leads with that rather
 * than offering a Delete that comes back refused.
 */
export function AdjustmentTypesPage() {
  const { run } = useActionProgress()
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)

  // Undefined, deliberately: this is the screen that has to see the ones
  // switched off. The drawer that picks a type asks for the active ones only.
  const { data: types = [], isLoading, isError, refetch } = useAdjustmentTypes()
  const updateType = useUpdateAdjustmentType()
  const deleteType = useDeleteAdjustmentType()

  const [search, setSearch] = useState('')
  const [activity, setActivity] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AdjustmentType | null>(null)
  const [deleting, setDeleting] = useState<AdjustmentType | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return types.filter((t) => {
      if (activity === 'active' && !t.is_active) return false
      if (activity === 'inactive' && t.is_active) return false
      if (!q) return true
      return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    })
  }, [types, search, activity])

  const toggleActive = async (t: AdjustmentType) => {
    const turningOff = t.is_active

    await run(
      {
        label: turningOff ? 'Switching off' : 'Switching on',
        detail: t.name,
        success: turningOff
          ? `${t.name} can no longer be used on a new sheet.`
          : `${t.name} is available again.`,
      },
      () => updateType.mutateAsync({ id: t.id, payload: { is_active: !t.is_active } }),
    )
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    // Closed first, so the confirm modal is not left sitting under the
    // progress dialog.
    setDeleting(null)
    await run(
      {
        label: 'Deleting type',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deleteType.mutateAsync(target.id),
    )
  }

  const actionsColumn: Column<Row> = {
    key: 'actions',
    header: '',
    width: 'w-1',
    render: (t) => (
      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
        <Dropdown
          trigger={
            <button className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer">
              <MoreVertical size={15} />
            </button>
          }
          items={[
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(t) },
            {
              label: t.is_active ? 'Switch off' : 'Switch on',
              icon: <Power size={14} />,
              onClick: () => void toggleActive(t),
            },
            // Offered only when it can actually happen. A Delete that always
            // comes back refused teaches people to ignore the refusal.
            ...(canDeleteType(t)
              ? [
                  {
                    label: 'Delete',
                    icon: <Trash2 size={14} />,
                    danger: true,
                    onClick: () => setDeleting(t),
                  },
                ]
              : []),
          ]}
        />
      </div>
    ),
  }

  const stats = useMemo(() => {
    const active = types.filter((t) => t.is_active).length
    const custom = types.filter((t) => !t.is_system).length

    return [
      { label: 'Types', value: types.length, icon: <ClipboardList size={15} /> },
      { label: 'In use', value: active },
      {
        label: 'Switched off',
        value: types.length - active,
        tone: types.length - active > 0 ? ('warn' as const) : ('muted' as const),
      },
      { label: 'Yours', value: custom, tone: 'muted' as const },
    ]
  }, [types])

  // What the table is showing, in the order it shows them — DataTable owns the
  // sort, so this is the page's only honest source for the printed page.
  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Type',
      sortable: true,
      render: (t) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--text-primary)]">{t.name}</span>
          {t.is_system && (
            <span className="rounded-[var(--radius-pill)] bg-[var(--bg-surface-raised)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              Standard
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (t) => <CodeChip code={t.code} />,
    },
    {
      key: 'direction',
      header: 'Direction',
      sortable: true,
      render: (t) => <DirectionCell direction={t.direction} />,
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      render: (t) =>
        t.is_active ? (
          <StatusPill status="active" label="In use" />
        ) : (
          <StatusPill status="inactive" label="Switched off" />
        ),
    },
    {
      key: 'rows_count',
      header: 'Written under it',
      sortable: true,
      render: (t) => (
        <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
          {(t.rows_count ?? 0) === 0
            ? 'Never used'
            : `${t.rows_count} ${t.rows_count === 1 ? 'row' : 'rows'}`}
        </span>
      ),
    },
    {
      key: 'memo',
      header: 'Note',
      render: (t) => (
        <span className="text-xs text-[var(--text-muted)]">{t.memo?.trim() || '—'}</span>
      ),
    },
    ...(canManage ? [actionsColumn] : []),
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Adjustment Types" subtitle="The kinds of stock adjustment you record" />
        <ErrorState
          title="Couldn't load adjustment types"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Adjustment Types"
        subtitle="The headings stock can be written off or written on under — and which way each one is allowed to move it."
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() =>
                adjustmentTypesExportDoc(shownRows(), types.length, search, activity)
              }
            />
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New type
              </Button>
            )}
          </>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by name or code…"
        activeCount={activity ? 1 : 0}
        onClearFilters={() => setActivity('')}
        filters={
          <div className="w-48">
            <FilterSelect
              label="Status"
              value={activity}
              onChange={setActivity}
              allLabel="All types"
              icon={<Power size={14} />}
              options={[
                {
                  value: 'active',
                  label: 'In use',
                  count: types.filter((t) => t.is_active).length,
                },
                {
                  value: 'inactive',
                  label: 'Switched off',
                  count: types.filter((t) => !t.is_active).length,
                },
              ]}
            />
          </div>
        }
      />

      <DataTable
        onVisibleRows={onVisibleRows}
        columns={columns}
        data={filtered as Row[]}
        keyField="id"
        loading={isLoading}
        onRowClick={canManage ? (t) => setEditing(t as AdjustmentType) : undefined}
        emptyIcon={<ClipboardList size={30} />}
        emptyMessage={
          search || activity ? 'No types match your filters.' : 'No adjustment types yet.'
        }
        emptyAction={
          canManage && !search && !activity ? (
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              Add the first type
            </Button>
          ) : undefined
        }
      />

      <AdjustmentTypeFormDrawer open={creating} onClose={() => setCreating(false)} />
      <AdjustmentTypeFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        type={editing}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete adjustment type"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteType.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Remove{' '}
          <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span>? Nothing
          has been written under it, so no history is lost.
          {deleting && undeletableBecause(deleting) && (
            <span className="mt-2 block text-[var(--accent-amber)]">
              {undeletableBecause(deleting)}
            </span>
          )}
        </p>
      </Modal>
    </>
  )
}
