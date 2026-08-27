import { useMemo, useState } from 'react'
import { FolderTree, MoreVertical, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { categoriesExportDoc } from '../categories-export'
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
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { CategoryFormDrawer } from '../components/CategoryFormDrawer'
import { useCategories, useDeleteCategory } from '../hooks/use-categories'
import type { Category } from '../types'

// Preferences — shared reference data. Anyone who can see products can read the
// list; editing is gated on preferences.manage.
export function CategoriesPage() {
  const { run } = useActionProgress()
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)

  const { data: categories = [], isLoading, isError, refetch } = useCategories()
  const deleteCategory = useDeleteCategory()

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q),
    )
  }, [categories, debouncedSearch])

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    // Closed first: leaving the confirm modal under the progress dialog
    // would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting category',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deleteCategory.mutateAsync(target.id),
    )
  }

  // Bars are only comparable if they share a scale, so the busiest category
  // sets it for the whole column.
  const maxUsage = useMemo(
    () => Math.max(0, ...categories.map((c) => c.items_count ?? 0)),
    [categories],
  )

  const stats = useMemo(() => {
    const used = categories.filter((c) => (c.items_count ?? 0) > 0).length
    return [
      { label: 'Categories', value: categories.length, icon: <FolderTree size={15} /> },
      { label: 'In use', value: used, icon: <Package size={15} /> },
      {
        label: 'Unused',
        value: categories.length - used,
        tone: categories.length - used > 0 ? ('warn' as const) : ('muted' as const),
      },
    ]
  }, [categories])

  // What the table is actually showing, in the order it shows them.
  // DataTable owns the sort, so this is the page's only way to print rows
  // in the order somebody reads them on screen.
  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<Category & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Category',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <EntityBadge name={c.name} />
          <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (c) => <CodeChip code={c.code} />,
    },
    {
      key: 'items_count',
      header: 'Products',
      sortable: true,
      render: (c) => (
        <UsageBar count={c.items_count ?? 0} max={maxUsage} noun="product" />
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            width: 'w-1',
            render: (c: Category) => (
              <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <Dropdown
                  trigger={
                    <button className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer">
                      <MoreVertical size={15} />
                    </button>
                  }
                  items={[
                    { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(c) },
                    {
                      label: 'Delete',
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onClick: () => setDeleting(c),
                    },
                  ]}
                />
              </div>
            ),
          } as Column<Category & Record<string, unknown>>,
        ]
      : []),
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Categories" subtitle="Groupings that organise the product catalog" />
        <ErrorState
          title="Couldn't load categories"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Groupings that organise the product catalog — every product belongs to one."
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() => categoriesExportDoc(shownRows(), categories.length, debouncedSearch)}
            />
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New category
              </Button>
            )}
          </>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search categories..."
      />

      <DataTable
        onVisibleRows={onVisibleRows}
        columns={columns}
        data={filtered as (Category & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={canManage ? (c) => setEditing(c as Category) : undefined}
        emptyIcon={<FolderTree size={30} />}
        emptyMessage={
          search ? 'No categories match your search.' : 'No categories yet.'
        }
        emptyAction={
          canManage && !search ? (
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              Add the first category
            </Button>
          ) : undefined
        }
      />

      <CategoryFormDrawer open={creating} onClose={() => setCreating(false)} />
      <CategoryFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        category={editing}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete category"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteCategory.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Remove <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span>?
          Products still using it must be reassigned first.
        </p>
      </Modal>
    </>
  )
}
