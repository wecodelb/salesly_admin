import { useMemo, useState } from 'react'
import { MapPinned, MoreVertical, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { areasExportDoc } from '../areas-export'
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
import { useDebounce } from '@/shared/hooks/use-debounce'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { AreaFormDrawer } from '../components/AreaFormDrawer'
import { useAreas, useDeleteArea } from '../hooks/use-areas'
import type { Area } from '../types'

export function AreasPage() {
  const { run } = useActionProgress()
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)

  const { data: areas = [], isLoading, isError, refetch } = useAreas()
  const deleteArea = useDeleteArea()

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Area | null>(null)
  const [deleting, setDeleting] = useState<Area | null>(null)

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return areas
    return areas.filter(
      (a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q),
    )
  }, [areas, debouncedSearch])

  // The backend refuses (409) to drop an area that still covers customers, so
  // the confirm button is held shut rather than sent into a certain error.
  const deleteBlocked = (deleting?.customers_count ?? 0) > 0

  const confirmDelete = async () => {
    if (!deleting || deleteBlocked) return
    const target = deleting
    // Closed first: leaving the confirm modal under the progress dialog
    // would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting area',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deleteArea.mutateAsync(target.id),
    )
  }

  // Bars are only comparable if they share a scale, so the busiest territory
  // sets it for the whole column.
  const maxUsage = useMemo(
    () => Math.max(0, ...areas.map((a) => a.customers_count ?? 0)),
    [areas],
  )

  const stats = useMemo(() => {
    const covered = areas.filter((a) => (a.customers_count ?? 0) > 0).length
    const customers = areas.reduce((sum, a) => sum + (a.customers_count ?? 0), 0)
    return [
      { label: 'Territories', value: areas.length, icon: <MapPinned size={15} /> },
      { label: 'Customers covered', value: customers, icon: <Users size={15} /> },
      {
        label: 'Empty',
        value: areas.length - covered,
        tone: areas.length - covered > 0 ? ('warn' as const) : ('muted' as const),
      },
    ]
  }, [areas])

  const columns: Column<Area & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Territory',
      sortable: true,
      render: (a) => (
        <div className="flex items-center gap-3">
          <EntityBadge name={a.name} />
          <span className="font-medium text-[var(--text-primary)]">{a.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (a) => <CodeChip code={a.code} />,
    },
    {
      key: 'customers_count',
      header: 'Customers',
      sortable: true,
      render: (a) => (
        <UsageBar
          count={a.customers_count ?? 0}
          max={maxUsage}
          noun="customer"
          emptyLabel="No customers"
        />
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            width: 'w-1',
            render: (a: Area) => (
              <div
                className="flex items-center justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <Dropdown
                  trigger={
                    <button className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer">
                      <MoreVertical size={15} />
                    </button>
                  }
                  items={[
                    { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(a) },
                    {
                      label: 'Delete',
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onClick: () => setDeleting(a),
                    },
                  ]}
                />
              </div>
            ),
          } as Column<Area & Record<string, unknown>>,
        ]
      : []),
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Areas" subtitle="Sales territories customers are grouped into" />
        <ErrorState
          title="Couldn't load areas"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Areas"
        subtitle="The sales territories your customers sit in — they drive route planning and how reporting is broken down."
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() => areasExportDoc(filtered, areas.length, debouncedSearch)}
            />
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New area
              </Button>
            )}
          </>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar search={search} onSearch={setSearch} searchPlaceholder="Search by name or code…" />

      <DataTable
        columns={columns}
        data={filtered as (Area & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={canManage ? (a) => setEditing(a as Area) : undefined}
        emptyIcon={<MapPinned size={30} />}
        emptyMessage={search ? 'No areas match your search.' : 'No areas yet.'}
        emptyAction={
          canManage && !search ? (
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              Add the first area
            </Button>
          ) : undefined
        }
      />

      <AreaFormDrawer open={creating} onClose={() => setCreating(false)} />
      <AreaFormDrawer open={!!editing} onClose={() => setEditing(null)} area={editing} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete area"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteArea.isPending}
              disabled={deleteBlocked}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          {deleteBlocked ? (
            <>
              <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span> still
              covers {deleting?.customers_count}{' '}
              {deleting?.customers_count === 1 ? 'customer' : 'customers'} and can't be deleted
              until they're moved to another area.
            </>
          ) : (
            <>
              Remove{' '}
              <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span>? No
              customers are in this area, so nothing else changes.
            </>
          )}
        </p>
      </Modal>
    </>
  )
}
