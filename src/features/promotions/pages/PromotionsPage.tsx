import { useMemo, useState } from 'react'
import { CheckCircle2, Pencil, Percent, Plus, Tag, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { KpiCard } from '@/shared/components/KpiCard/KpiCard'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Modal } from '@/shared/components/Modal/Modal'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useToast } from '@/shared/hooks/use-toast'
import { apiErrorMessage } from '@/features/users/hooks/use-users'
import { PromotionFormDrawer } from '../components/PromotionFormDrawer'
import { useDeletePromotion, usePromotions } from '../hooks/use-promotions'
import { promoAmount, promoScope, type Promotion } from '../types'

// React part 2 — Promotions management. A promotion created here is recomputed
// server-side and shown in the salesman's Flutter app as a promo chip.
export function PromotionsPage() {
  const toast = useToast()
  const { data: promotions = [], isLoading, isError, refetch } = usePromotions()
  const deletePromotion = useDeletePromotion()

  const [editing, setEditing] = useState<Promotion | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Promotion | null>(null)

  const kpis = useMemo(
    () => ({
      total: promotions.length,
      active: promotions.filter((p) => p.is_active).length,
      percent: promotions.filter((p) => p.type === 'percent').length,
    }),
    [promotions],
  )

  const confirmDelete = () => {
    if (!deleting) return
    deletePromotion.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Promotion deleted', 'It no longer applies.')
        setDeleting(null)
      },
      onError: (err) => toast.error('Delete failed', apiErrorMessage(err)),
    })
  }

  const columns: Column<Promotion & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Promotion',
      sortable: true,
      render: (p) => (
        <div className="min-w-0">
          <div className="font-medium text-[var(--text-primary)] truncate">
            {p.name || 'Untitled promotion'}
          </div>
          <div className="text-xs text-[var(--text-muted)] truncate">{promoScope(p)}</div>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Discount',
      sortable: true,
      render: (p) => (
        <span className="font-mono text-sm font-medium text-[var(--accent-amber)]">
          {promoAmount(p)}
        </span>
      ),
    },
    {
      key: 'window',
      header: 'Window',
      render: (p) => (
        <span className="text-sm text-[var(--text-secondary)]">
          {p.starts_at || '—'} → {p.ends_at || '—'}
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
        <div className="flex items-center justify-end gap-1">
          <button
            title="Edit"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(p)
            }}
            className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
          >
            <Pencil size={15} />
          </button>
          <button
            title="Delete"
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(p)
            }}
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
        <PageHeader title="Promotions" subtitle="Discounts across the catalog" />
        <ErrorState
          title="Couldn't load promotions"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Promotions"
        subtitle="Discounts across the catalog"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New promotion
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Promotions"
          value={kpis.total}
          loading={isLoading}
          icon={<Tag size={18} className="text-[var(--accent-primary)]" />}
        />
        <KpiCard
          title="Active"
          value={kpis.active}
          loading={isLoading}
          icon={<CheckCircle2 size={18} className="text-[var(--accent-green)]" />}
          iconBg="bg-[var(--accent-green)]/10"
        />
        <KpiCard
          title="Percentage-based"
          value={kpis.percent}
          loading={isLoading}
          icon={<Percent size={18} className="text-[var(--accent-amber)]" />}
          iconBg="bg-[var(--accent-amber)]/10"
        />
      </div>

      <DataTable
        columns={columns}
        data={promotions as (Promotion & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(p) => setEditing(p as Promotion)}
        emptyMessage="No promotions yet. Create one to discount products for your salesmen."
      />

      <PromotionFormDrawer open={creating} onClose={() => setCreating(false)} />
      <PromotionFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        promotion={editing}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete promotion"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deletePromotion.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Delete this promotion? Products it discounts will return to their base price.
        </p>
      </Modal>
    </>
  )
}
