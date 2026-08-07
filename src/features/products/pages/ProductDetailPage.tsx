import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Barcode,
  Boxes,
  Package,
  Pencil,
  Percent,
  ShoppingCart,
  Weight,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { KpiCard } from '@/shared/components/KpiCard/KpiCard'
import { Button } from '@/shared/components/Button'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton/LoadingSkeleton'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { ItemFormDrawer } from '../components/ItemFormDrawer'
import { ProductDistributionPanel } from '../components/ProductDistributionPanel'
import { useProduct } from '../hooks/use-products'
import { effectiveUsd, formatLbp, formatUsd, type AdminItemUom } from '../types'

/**
 * One product on its own page: what it costs at each tier, how it is packaged,
 * and (once the transactions endpoint exists) how it has been selling.
 */
export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canEdit = can(PERMISSIONS.PREFERENCES_MANAGE)

  const productId = id ? Number(id) : null
  const { data: item, isLoading, isError, refetch } = useProduct(productId)
  const [editing, setEditing] = useState(false)

  const back = (
    <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => navigate('/products')}>
      Back
    </Button>
  )

  if (isLoading) return <LoadingSkeleton />

  if (isError || !item) {
    return (
      <>
        <PageHeader title="Product" actions={back} />
        <ErrorState
          title="Couldn't load this product"
          message="It may have been removed, or the server didn't respond."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  const variantColumns: Column<AdminItemUom & Record<string, unknown>>[] = [
    {
      key: 'uom',
      header: 'Packaging',
      render: (v) => (
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-primary)]">{v.uom?.name ?? `Unit ${v.uom_id}`}</span>
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Holds',
      render: (v) => (
        <span className="font-mono text-sm text-[var(--text-secondary)]">{v.unit}</span>
      ),
    },
    {
      key: 'price_1',
      header: 'Retail',
      render: (v) => <span className="font-mono text-sm">{formatUsd(v.price_1)}</span>,
    },
    {
      key: 'price_2',
      header: 'Wholesale',
      render: (v) => <span className="font-mono text-sm">{formatUsd(v.price_2)}</span>,
    },
    {
      key: 'price_3',
      header: 'Distribution',
      render: (v) => <span className="font-mono text-sm">{formatUsd(v.price_3)}</span>,
    },
    {
      key: 'weight',
      header: 'Weight',
      align: 'right',
      render: (v) => <span className="font-mono text-sm">{v.weight ?? 0}</span>,
    },
    {
      key: 'volume',
      header: 'Volume',
      align: 'right',
      render: (v) => <span className="font-mono text-sm">{v.volume ?? 0}</span>,
    },
    {
      key: 'barcodes',
      header: 'Barcodes',
      // One per line: packagings routinely carry several, and comma-joining
      // them ran the cell into an unreadable string.
      render: (v) =>
        v.barcodes?.length ? (
          <div className="flex flex-col gap-0.5">
            {v.barcodes.map((b) => (
              <span key={b} className="font-mono text-xs text-[var(--text-muted)]">
                {b}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">—</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title={item.name}
        subtitle={`${item.code}${item.category ? ` · ${item.category}` : ''}${item.brand ? ` · ${item.brand}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {back}
            {canEdit && (
              <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Retail price"
          value={formatUsd(effectiveUsd(item))}
          icon={<Package size={18} className="text-[var(--accent-primary)]" />}
        />
        <KpiCard
          title="In LBP"
          value={item.price_lbp != null ? formatLbp(item.promo?.price_lbp ?? item.price_lbp) : '—'}
          icon={<Package size={18} className="text-[var(--text-muted)]" />}
        />
        <KpiCard
          title="Available"
          value={item.available_qty}
          icon={<Boxes size={18} className="text-[var(--accent-green)]" />}
          iconBg="bg-[var(--accent-green)]/10"
        />
        <KpiCard
          title="Promotion"
          value={
            item.promo
              ? item.promo.type === 'percent'
                ? `-${item.promo.value}%`
                : `-$${item.promo.value}`
              : 'None'
          }
          icon={<Percent size={18} className="text-[var(--accent-amber)]" />}
          iconBg="bg-[var(--accent-amber)]/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Pricing
          </h3>
          <div className="flex flex-col gap-2 text-sm">
            {[
              ['Retail', item.price_1],
              ['Wholesale', item.price_2],
              ['Distribution', item.price_3],
              ['Cost', item.cost],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {formatUsd(Number(value ?? 0))}
                </span>
              </div>
            ))}
            {item.currency?.code && (
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]">Currency</span>
                <span className="text-[var(--text-primary)]">{item.currency.code}</span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Physical
          </h3>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                <Weight size={14} className="text-[var(--text-muted)]" /> Weight
              </span>
              <span className="font-mono text-[var(--text-primary)]">{item.weight ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                <Boxes size={14} className="text-[var(--text-muted)]" /> Volume
              </span>
              <span className="font-mono text-[var(--text-primary)]">{item.volume ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                <Barcode size={14} className="text-[var(--text-muted)]" /> Barcodes
              </span>
              <span className="font-mono text-xs text-[var(--text-primary)]">
                {item.barcodes?.length ? item.barcodes.join(', ') : '—'}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Before the packaging: the Available figure in the strip above is a
          company-wide total, and it hides the fact that most of it can be
          riding in one salesman's depot. */}
      <ProductDistributionPanel itemId={item.id} />

      <section className="mb-6">
        <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
          Packaging
        </h3>
        <DataTable
          columns={variantColumns}
          data={(item.uoms ?? []) as (AdminItemUom & Record<string, unknown>)[]}
          keyField="uom_id"
          emptyMessage="No packaging recorded for this product."
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
          Sales history
        </h3>
        <EmptyState
          icon={<ShoppingCart size={28} />}
          title="Coming soon — sales history"
          description="Units sold, order transactions and movement over time will appear here."
        />
      </section>

      <ItemFormDrawer open={editing} onClose={() => setEditing(false)} item={item} />
    </>
  )
}
