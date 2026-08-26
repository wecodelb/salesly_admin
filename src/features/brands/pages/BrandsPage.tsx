import { useMemo, useState } from 'react'
import { MoreVertical, Package, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { brandsExportDoc } from '../brands-export'
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
import { BrandFormDrawer } from '../components/BrandFormDrawer'
import { useBrands, useDeleteBrand } from '../hooks/use-brands'
import type { Brand } from '../types'

export function BrandsPage() {
  const { run } = useActionProgress()
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)

  const { data: brands = [], isLoading, isError, refetch } = useBrands()
  const deleteBrand = useDeleteBrand()

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const [deleting, setDeleting] = useState<Brand | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return brands
    return brands.filter(
      (b) => b.name.toLowerCase().includes(q) || (b.code ?? '').toLowerCase().includes(q),
    )
  }, [brands, search])

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    // Closed first: leaving the confirm modal under the progress dialog
    // would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting brand',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deleteBrand.mutateAsync(target.id),
    )
  }

  // Bars are only comparable if they share a scale, so the biggest brand sets
  // it for the whole column.
  const maxUsage = useMemo(
    () => Math.max(0, ...brands.map((b) => b.items_count ?? 0)),
    [brands],
  )

  const stats = useMemo(() => {
    const used = brands.filter((b) => (b.items_count ?? 0) > 0).length
    return [
      { label: 'Brands', value: brands.length, icon: <Tag size={15} /> },
      { label: 'In use', value: used, icon: <Package size={15} /> },
      {
        label: 'Unused',
        value: brands.length - used,
        tone: brands.length - used > 0 ? ('warn' as const) : ('muted' as const),
      },
    ]
  }, [brands])

  const columns: Column<Brand & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Brand',
      sortable: true,
      render: (b) => (
        <div className="flex items-center gap-3">
          <EntityBadge name={b.name} />
          <span className="font-medium text-[var(--text-primary)]">{b.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (b) => <CodeChip code={b.code} />,
    },
    {
      key: 'items_count',
      header: 'Products',
      sortable: true,
      render: (b) => <UsageBar count={b.items_count ?? 0} max={maxUsage} noun="product" />,
    },
    // Dropped entirely for readers rather than rendered empty, matching the
    // other preferences screens.
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            width: 'w-1',
            render: (b: Brand) => (
              <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <Dropdown
                  trigger={
                    <button className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer">
                      <MoreVertical size={15} />
                    </button>
                  }
                  items={[
                    { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(b) },
                    {
                      label: 'Delete',
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onClick: () => setDeleting(b),
                    },
                  ]}
                />
              </div>
            ),
          } as Column<Brand & Record<string, unknown>>,
        ]
      : []),
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Brands" subtitle="The makers behind the products you sell" />
        <ErrorState
          title="Couldn't load brands"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Brands"
        subtitle="Brands label who makes a product, so the catalogue can be browsed and filtered by manufacturer."
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() => brandsExportDoc(filtered, brands.length, search)}
            />
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New brand
              </Button>
            )}
          </>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar search={search} onSearch={setSearch} searchPlaceholder="Search by name or code…" />

      <DataTable
        columns={columns}
        data={filtered as (Brand & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={canManage ? (b) => setEditing(b as Brand) : undefined}
        emptyIcon={<Tag size={30} />}
        emptyMessage={search ? 'No brands match your search.' : 'No brands yet.'}
        emptyAction={
          canManage && !search ? (
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              Add the first brand
            </Button>
          ) : undefined
        }
      />

      <BrandFormDrawer open={creating} onClose={() => setCreating(false)} />
      <BrandFormDrawer open={!!editing} onClose={() => setEditing(null)} brand={editing} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete brand"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteBrand.isPending} onClick={confirmDelete}>
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
