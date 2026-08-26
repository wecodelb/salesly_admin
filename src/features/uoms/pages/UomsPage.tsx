import { useMemo, useState } from 'react'
import { Boxes, MoreVertical, Pencil, Plus, Ruler, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { uomsExportDoc } from '../uoms-export'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal/Modal'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { EntityBadge } from '@/shared/components/EntityBadge/EntityBadge'
import { CodeChip } from '@/shared/components/CodeChip/CodeChip'
import { UsageBar } from '@/shared/components/UsageBar/UsageBar'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { UomFormDrawer } from '../components/UomFormDrawer'
import { useDeleteUom, useUoms } from '../hooks/use-uoms'
import type { Uom } from '../types'

type Row = Uom & Record<string, unknown>

export function UomsPage() {
  const { run } = useActionProgress()
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)

  const { data: uoms = [], isLoading, isError, refetch } = useUoms()
  const deleteUom = useDeleteUom()

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Uom | null>(null)
  const [deleting, setDeleting] = useState<Uom | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return uoms
    return uoms.filter(
      (u) => u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q),
    )
  }, [uoms, search])

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    // Closed first: leaving the confirm modal under the progress dialog
    // would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting unit',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deleteUom.mutateAsync(target.id),
    )
  }

  const actionsColumn: Column<Row> = {
    key: 'actions',
    header: '',
    width: 'w-1',
    render: (u) => (
      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
        <Dropdown
          trigger={
            <button className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer">
              <MoreVertical size={15} />
            </button>
          }
          items={[
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(u) },
            {
              label: 'Delete',
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: () => setDeleting(u),
            },
          ]}
        />
      </div>
    ),
  }

  // A unit is used two ways — as a product's base unit and as the measure on a
  // packaging variant — so the bar scales against whichever total is larger.
  const maxUsage = useMemo(
    () =>
      Math.max(
        0,
        ...uoms.map((u) => (u.items_count ?? 0) + (u.packagings_count ?? 0)),
      ),
    [uoms],
  )

  const stats = useMemo(() => {
    const used = uoms.filter(
      (u) => (u.items_count ?? 0) + (u.packagings_count ?? 0) > 0,
    ).length
    return [
      { label: 'Units', value: uoms.length, icon: <Ruler size={15} /> },
      { label: 'In use', value: used, icon: <Boxes size={15} /> },
      {
        label: 'Unused',
        value: uoms.length - used,
        tone: uoms.length - used > 0 ? ('warn' as const) : ('muted' as const),
      },
    ]
  }, [uoms])

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Unit',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <EntityBadge name={u.name} />
          <span className="font-medium text-[var(--text-primary)]">{u.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (u) => <CodeChip code={u.code} />,
    },
    {
      key: 'items_count',
      header: 'Used by',
      sortable: true,
      render: (u) => (
        <UsageBar
          count={(u.items_count ?? 0) + (u.packagings_count ?? 0)}
          max={maxUsage}
          noun="use"
        />
      ),
    },
    {
      key: 'packagings_count',
      header: 'Breakdown',
      render: (u) => (
        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
          {u.items_count ?? 0} base · {u.packagings_count ?? 0} packaging
        </span>
      ),
    },
    ...(canManage ? [actionsColumn] : []),
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Units" subtitle="How products are measured and sold" />
        <ErrorState
          title="Couldn't load units"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Units"
        subtitle="The units your products are measured and sold in — piece, box, kg and so on."
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() => uomsExportDoc(filtered, uoms.length, search)}
            />
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New unit
              </Button>
            )}
          </>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar search={search} onSearch={setSearch} searchPlaceholder="Search by name or code…" />

      <DataTable
        columns={columns}
        data={filtered as Row[]}
        keyField="id"
        loading={isLoading}
        onRowClick={canManage ? (u) => setEditing(u as Uom) : undefined}
        emptyIcon={<Ruler size={30} />}
        emptyMessage={search ? 'No units match your search.' : 'No units yet.'}
        emptyAction={
          canManage && !search ? (
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              Add the first unit
            </Button>
          ) : undefined
        }
      />

      <UomFormDrawer open={creating} onClose={() => setCreating(false)} />
      <UomFormDrawer open={!!editing} onClose={() => setEditing(null)} uom={editing} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete unit"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteUom.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Remove <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span>?
          Products still measured in this unit have to be moved to another one first.
        </p>
      </Modal>
    </>
  )
}
