import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Eye, FolderTree, Gauge, MoreVertical, Package, PackageCheck, PackageX, Percent, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { productsExportDoc } from '../products-export'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { KpiCard } from '@/shared/components/KpiCard/KpiCard'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { Modal } from '@/shared/components/Modal/Modal'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { ItemFormDrawer } from '../components/ItemFormDrawer'
import { ItemLevelsDrawer } from '../components/ItemLevelsDrawer'
import { StockCountDrawer } from '../components/StockCountDrawer'
import { useBrands, useCategories, useDeleteItem, useProducts } from '../hooks/use-products'
import { effectiveUsd, formatLbp, formatUsd, type AdminItem } from '../types'

// React part 2 — Products management (manager scope = the whole catalog).
// Create/edit a product + set dual pricing; the salesman then sees it (with
// live USD/LBP + promo) in the Flutter app.
export function ProductsPage() {
  const navigate = useNavigate()
  const { run } = useActionProgress()
  const { data: products = [], isLoading, isError, refetch } = useProducts()
  const { data: categories = [] } = useCategories()
  const { data: brands = [] } = useBrands()
  const deleteItem = useDeleteItem()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [editing, setEditing] = useState<AdminItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<AdminItem | null>(null)
  const [leveling, setLeveling] = useState<AdminItem | null>(null)
  const [counting, setCounting] = useState<AdminItem | null>(null)

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.brand ?? '').toLowerCase().includes(q)
      const matchesCategory =
        !categoryFilter || String(p.category_id) === categoryFilter
      const matchesBrand = !brandFilter || String(p.brand_id) === brandFilter
      const matchesStock =
        !stockFilter ||
        (stockFilter === 'in' ? p.available_qty > 0 : p.available_qty <= 0)
      return matchesQuery && matchesCategory && matchesBrand && matchesStock
    })
  }, [products, debouncedSearch, categoryFilter, brandFilter, stockFilter])

  // Counts shown beside each option. Deliberately computed over the whole
  // catalog rather than the filtered rows: a count that shrinks to zero the
  // moment you pick a different filter tells you nothing about where to go next.
  const counts = useMemo(() => {
    const byCategory = new Map<string, number>()
    const byBrand = new Map<string, number>()
    let inStock = 0
    for (const p of products) {
      const c = String(p.category_id)
      byCategory.set(c, (byCategory.get(c) ?? 0) + 1)
      if (p.brand_id != null) {
        const b = String(p.brand_id)
        byBrand.set(b, (byBrand.get(b) ?? 0) + 1)
      }
      if (p.available_qty > 0) inStock++
    }
    return { byCategory, byBrand, inStock, outOfStock: products.length - inStock }
  }, [products])

  const activeFilterCount = [categoryFilter, brandFilter, stockFilter].filter(Boolean).length

  // Named in words on the printed page, where the selects that produced them
  // are not there to be looked at.
  const exportFilters = useMemo(
    () => [
      debouncedSearch.trim() && `Search “${debouncedSearch.trim()}”`,
      categoryFilter &&
        `Category: ${categories.find((c) => String(c.id) === categoryFilter)?.name ?? categoryFilter}`,
      brandFilter &&
        `Brand: ${brands.find((b) => String(b.id) === brandFilter)?.name ?? brandFilter}`,
      stockFilter && (stockFilter === 'in' ? 'In stock only' : 'Out of stock only'),
    ],
    [debouncedSearch, categoryFilter, brandFilter, stockFilter, categories, brands],
  )

  // Grouped the way the screen is already narrowed: filtering to one category
  // and then printing it under a "By category" heading is noise, but an
  // unfiltered catalog is unreadable flat.
  const exportGrouping =
    categoryFilter || brandFilter ? 'none' : ('category' as const)

  const clearFilters = () => {
    setCategoryFilter('')
    setBrandFilter('')
    setStockFilter('')
  }

  const kpis = useMemo(
    () => ({
      total: products.length,
      inStock: products.filter((p) => p.available_qty > 0).length,
      outOfStock: products.filter((p) => p.available_qty <= 0).length,
      onPromo: products.filter((p) => p.promo != null).length,
    }),
    [products],
  )

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    // Closed first: leaving the confirm modal under the progress dialog
    // would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting product',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deleteItem.mutateAsync(target.id),
    )
  }

  // What the table is actually showing, in the order it shows them.
  // DataTable owns the sort, so this is the page's only way to print rows
  // in the order somebody reads them on screen.
  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<AdminItem & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[var(--radius-btn)] bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
            <Package size={16} className="text-[var(--accent-primary)]" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[var(--text-primary)] truncate">{p.name}</div>
            <div className="text-xs font-mono text-[var(--text-muted)] truncate">{p.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (p) => (
        <span className="text-sm text-[var(--text-secondary)]">{p.category || '—'}</span>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      sortable: true,
      render: (p) =>
        p.brand ? (
          <span className="text-sm text-[var(--text-secondary)]">{p.brand}</span>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">—</span>
        ),
    },
    {
      key: 'price_usd',
      header: 'Price (USD)',
      sortable: true,
      render: (p) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
            {formatUsd(effectiveUsd(p))}
          </span>
          {p.promo && (
            <span className="font-mono text-xs text-[var(--text-muted)] line-through">
              {formatUsd(p.price_usd)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'price_lbp',
      header: 'Price (LBP)',
      render: (p) => (
        <span className="font-mono text-sm text-[var(--text-secondary)]">
          {p.price_lbp != null ? formatLbp(p.promo?.price_lbp ?? p.price_lbp) : '—'}
        </span>
      ),
    },
    {
      key: 'available_qty',
      header: 'Stock',
      sortable: true,
      render: (p) =>
        p.available_qty > 0 ? (
          <StatusPill status="active" label={`${p.available_qty} in stock`} />
        ) : (
          <StatusPill status="error" label="Out of stock" />
        ),
    },
    {
      key: 'promo',
      header: 'Promo',
      render: (p) =>
        p.promo ? (
          <StatusPill
            status="warning"
            label={p.promo.type === 'percent' ? `-${p.promo.value}%` : `-$${p.promo.value}`}
          />
        ) : (
          <span className="text-xs text-[var(--text-muted)]">—</span>
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
              {
                label: 'View details',
                icon: <Eye size={14} />,
                onClick: () => navigate(`/products/${p.id}`),
              },
              { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(p) },
              // A reorder point belongs to a warehouse-and-product pair, not to
              // the product, so it is set from the row rather than from the
              // item form: a depot and the warehouse it is filled from need
              // different floors for the same line.
              {
                label: 'Set item level',
                icon: <Gauge size={14} />,
                onClick: () => setLeveling(p),
              },
              // Stock is per warehouse, like the reorder level above it, so it
              // is set from the row rather than from the product form. Until
              // there is a purchasing module this is the only way it gets in —
              // without it a product created here is permanently out of stock.
              {
                label: 'Set stock',
                icon: <Boxes size={14} />,
                onClick: () => setCounting(p),
              },
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
        <PageHeader title="Products" subtitle="Catalog, dual pricing & promotions" />
        <ErrorState
          title="Couldn't load products"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Catalog, dual pricing & promotions"
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() =>
                productsExportDoc(shownRows(), products.length, exportFilters, exportGrouping)
              }
            />
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New product
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Products"
          value={kpis.total}
          loading={isLoading}
          icon={<Package size={18} className="text-[var(--accent-primary)]" />}
        />
        <KpiCard
          title="In stock"
          value={kpis.inStock}
          loading={isLoading}
          icon={<PackageCheck size={18} className="text-[var(--accent-green)]" />}
          iconBg="bg-[var(--accent-green)]/10"
        />
        <KpiCard
          title="Out of stock"
          value={kpis.outOfStock}
          loading={isLoading}
          icon={<PackageX size={18} className="text-[var(--accent-red)]" />}
          iconBg="bg-[var(--accent-red)]/10"
        />
        <KpiCard
          title="On promotion"
          value={kpis.onPromo}
          loading={isLoading}
          icon={<Percent size={18} className="text-[var(--accent-amber)]" />}
          iconBg="bg-[var(--accent-amber)]/10"
        />
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by name, code, category or brand…"
        activeCount={activeFilterCount}
        onClearFilters={clearFilters}
        filters={
          <>
            <div className="w-48">
              <FilterSelect
                label="Category"
                allLabel="All categories"
                icon={<FolderTree size={14} />}
                value={categoryFilter}
                onChange={setCategoryFilter}
                searchPlaceholder="Search categories…"
                options={categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                  count: counts.byCategory.get(String(c.id)) ?? 0,
                }))}
              />
            </div>
            <div className="w-48">
              <FilterSelect
                label="Brand"
                allLabel="All brands"
                icon={<Tag size={14} />}
                value={brandFilter}
                onChange={setBrandFilter}
                searchPlaceholder="Search brands…"
                options={brands.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                  count: counts.byBrand.get(String(b.id)) ?? 0,
                }))}
              />
            </div>
            <div className="w-44">
              <FilterSelect
                label="Stock"
                allLabel="All stock"
                icon={<Boxes size={14} />}
                value={stockFilter}
                onChange={setStockFilter}
                options={[
                  { value: 'in', label: 'In stock', count: counts.inStock },
                  { value: 'out', label: 'Out of stock', count: counts.outOfStock },
                ]}
              />
            </div>
          </>
        }
      />

      <DataTable
        onVisibleRows={onVisibleRows}
        columns={columns}
        data={filtered as (AdminItem & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={(p) => setEditing(p as AdminItem)}
        emptyMessage="No products match your filters."
      />

      <ItemFormDrawer open={creating} onClose={() => setCreating(false)} />
      <ItemFormDrawer open={!!editing} onClose={() => setEditing(null)} item={editing} />
      <ItemLevelsDrawer open={!!leveling} onClose={() => setLeveling(null)} item={leveling} />
      <StockCountDrawer open={!!counting} onClose={() => setCounting(null)} item={counting} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete product"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteItem.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Remove{' '}
          <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span> from the
          catalog? This cannot be undone.
        </p>
      </Modal>
    </>
  )
}
