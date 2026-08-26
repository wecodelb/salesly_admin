import { useMemo, useState } from 'react'
import { CheckCircle2, MoreVertical, Pencil, Plus, Tags, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { priceListsExportDoc } from '../price-lists-export'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { KpiCard } from '@/shared/components/KpiCard/KpiCard'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Modal } from '@/shared/components/Modal/Modal'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { ManageCustomersModal } from '../components/ManageCustomersModal'
import { PriceListFormDrawer } from '../components/PriceListFormDrawer'
import { useDeletePriceList, usePriceLists } from '../hooks/use-price-lists'
import type { PriceList } from '../types'

// React part 2 — Price lists. Per-customer USD overrides applied by the item
// endpoint when that customer is in context.
export function PriceListsPage() {
  const { run } = useActionProgress()
  const { data: priceLists = [], isLoading, isError, refetch } = usePriceLists()
  const deletePriceList = useDeletePriceList()

  const [editing, setEditing] = useState<PriceList | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<PriceList | null>(null)
  const [managingCustomers, setManagingCustomers] = useState<PriceList | null>(null)

  const kpis = useMemo(
    () => ({
      total: priceLists.length,
      active: priceLists.filter((p) => p.is_active).length,
      customersReached: priceLists.reduce((sum, p) => sum + (p.customers?.length ?? 0), 0),
    }),
    [priceLists],
  )

  // Keep the modal's data fresh as attach/detach mutations refetch the list.
  const managingCustomersLive = managingCustomers
    ? (priceLists.find((p) => p.id === managingCustomers.id) ?? managingCustomers)
    : null

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    // Closed first: leaving the confirm modal under the progress dialog
    // would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting price list',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deletePriceList.mutateAsync(target.id),
    )
  }

  const columns: Column<PriceList & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Price list',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--text-primary)] truncate">{p.name}</span>
          {p.is_default && <StatusPill status="active" label="Default" />}
        </div>
      ),
    },
    {
      key: 'customers',
      header: 'Customers',
      render: (p) => {
        const names = (p.customers ?? []).map((c) => c.name)
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setManagingCustomers(p)
            }}
            className="text-sm text-left text-[var(--accent-primary)] hover:underline cursor-pointer"
          >
            {names.length === 0
              ? 'None — add customers'
              : names.length <= 2
                ? names.join(', ')
                : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`}
          </button>
        )
      },
    },
    {
      key: 'items_count',
      header: 'Overrides',
      sortable: true,
      render: (p) => (
        <span className="font-mono text-sm text-[var(--text-secondary)]">
          {p.items_count ?? 0}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (p) =>
        p.is_active ? (
          <StatusPill status="active" label="Active" />
        ) : (
          <StatusPill status="inactive" label="Inactive" />
        ),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-1',
      render: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer">
                <MoreVertical size={15} />
              </button>
            }
            items={[
              { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(p) },
              { label: 'Manage customers', icon: <Users size={14} />, onClick: () => setManagingCustomers(p) },
            ]}
          />
          <button
            title="Delete"
            onClick={() => setDeleting(p)}
            className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Price Lists" subtitle="Per-customer price overrides" />
        <ErrorState
          title="Couldn't load price lists"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Price Lists"
        subtitle="Per-customer price overrides"
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() => priceListsExportDoc(priceLists, priceLists.length)}
            />
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New price list
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Price lists"
          value={kpis.total}
          loading={isLoading}
          icon={<Tags size={18} className="text-[var(--accent-primary)]" />}
        />
        <KpiCard
          title="Active"
          value={kpis.active}
          loading={isLoading}
          icon={<CheckCircle2 size={18} className="text-[var(--accent-green)]" />}
          iconBg="bg-[var(--accent-green)]/10"
        />
        <KpiCard
          title="Customers reached"
          value={kpis.customersReached}
          loading={isLoading}
          icon={<Users size={18} className="text-[var(--accent-blue)]" />}
          iconBg="bg-[var(--accent-blue)]/10"
        />
      </div>

      <DataTable
        columns={columns}
        data={priceLists as (PriceList & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(p) => setEditing(p as PriceList)}
        emptyMessage="No price lists yet. Create one to give a customer special pricing."
      />

      <PriceListFormDrawer open={creating} onClose={() => setCreating(false)} />
      <PriceListFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        priceList={editing}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete price list"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deletePriceList.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Remove{' '}
          <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span>? Its
          customers will fall back to the company default.
        </p>
      </Modal>

      <ManageCustomersModal priceList={managingCustomersLive} onClose={() => setManagingCustomers(null)} />
    </>
  )
}
