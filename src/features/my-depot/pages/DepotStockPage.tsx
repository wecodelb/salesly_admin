import { useMemo, useState } from 'react'
import { Boxes, Lock, PackageCheck, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useDepotStock, useDepotTransfers, useWarehouseOptions } from '../hooks/use-my-depot'
import { formatQty, type DepotStockLine } from '../types'

/**
 * What a depot is holding right now — the screen somebody checks before loading
 * a salesman again.
 *
 * The three figures are separate on purpose. `qty` is what is physically in the
 * depot; `reserved` is what this morning's orders have already promised out of
 * it; `available` is the only one of the three he may promise again. A screen
 * showing the first alone would have him selling the same carton twice.
 */
export function DepotStockPage() {
  const { data: transfers = [] } = useDepotTransfers()
  const warehouses = useWarehouseOptions(transfers)

  // Empty reads the caller's own depot, which is the only thing the endpoint
  // answers without an id — and the right default for anyone who has one.
  const [warehouseId, setWarehouseId] = useState('')
  const [search, setSearch] = useState('')

  const { data: stock, isLoading, isError, refetch } = useDepotStock(
    warehouseId ? Number(warehouseId) : null,
  )

  const debouncedSearch = useDebounce(search, 250)

  // Depots first, since this screen is about them; the fixed warehouses stay
  // reachable underneath because the evening's return lands in one.
  const options = useMemo(() => {
    const depots = warehouses.filter((w) => w.is_depot)
    const fixed = warehouses.filter((w) => !w.is_depot)

    return [
      ...depots.map((w) => ({
        value: String(w.id),
        label: w.owner_name ? `${w.name} — ${w.owner_name}` : (w.name ?? ''),
        group: 'Depots',
      })),
      ...fixed.map((w) => ({
        value: String(w.id),
        label: w.name ?? '',
        group: 'Warehouses',
      })),
    ]
  }, [warehouses])

  const items = useMemo(() => stock?.items ?? [], [stock])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (line) =>
        line.item_name.toLowerCase().includes(q) || line.item_code.toLowerCase().includes(q),
    )
  }, [items, debouncedSearch])

  const stats = [
    { label: 'Products', value: items.length, icon: <Boxes size={15} /> },
    { label: 'On hand', value: formatQty(stock?.total_qty ?? 0), icon: <PackageCheck size={15} /> },
    { label: 'Available', value: formatQty(stock?.total_available_qty ?? 0) },
    {
      label: 'Reserved',
      value: formatQty(stock?.total_reserved_qty ?? 0),
      tone: (stock?.total_reserved_qty ?? 0) > 0 ? ('warn' as const) : undefined,
      icon: <Lock size={15} />,
    },
  ]

  const columns: Column<DepotStockLine & Record<string, unknown>>[] = [
    {
      key: 'item_name',
      header: 'Product',
      sortable: true,
      render: (line) => (
        <div className="min-w-0">
          <div className="truncate text-[var(--text-primary)]">{line.item_name}</div>
          <div className="font-mono text-xs text-[var(--text-muted)]">{line.item_code}</div>
        </div>
      ),
    },
    {
      key: 'uom_name',
      header: 'Counted in',
      // The item's own base unit, never the carton the load happened to arrive
      // in — every figure on this row is in it.
      render: (line) => (
        <span className="text-sm text-[var(--text-secondary)]">{line.uom_name || '—'}</span>
      ),
    },
    {
      key: 'qty',
      header: 'On hand',
      sortable: true,
      align: 'right',
      render: (line) => (
        <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
          {formatQty(line.qty)}
        </span>
      ),
    },
    {
      key: 'reserved_qty',
      header: 'Reserved',
      sortable: true,
      align: 'right',
      render: (line) => (
        <span
          className={[
            'font-mono text-sm tabular-nums',
            line.reserved_qty > 0 ? 'text-[var(--accent-amber)]' : 'text-[var(--text-muted)]',
          ].join(' ')}
        >
          {formatQty(line.reserved_qty)}
        </span>
      ),
    },
    {
      key: 'available_qty',
      header: 'Can still sell',
      sortable: true,
      align: 'right',
      render: (line) => (
        <span
          className={[
            'font-mono text-sm font-medium tabular-nums',
            line.available_qty > 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]',
          ].join(' ')}
        >
          {formatQty(line.available_qty)}
        </span>
      ),
    },
  ]

  // Read off the warehouse's own pivot by the endpoint, so it is right even for
  // a depot this console has never seen a movement for.
  const heldBy = stock?.salesman?.name ?? null

  if (isError) {
    return (
      <>
        <PageHeader title="Depot stock" subtitle="What each salesman is carrying right now" />
        <ErrorState
          title="Couldn't read that depot"
          message="It may belong to another company, or you have no depot of your own to fall back on. Pick a depot above, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Depot stock"
        subtitle={
          stock
            ? `${stock.warehouse?.name ?? 'This depot'}${heldBy ? ` — ${heldBy}` : ''}`
            : 'What each salesman is carrying right now'
        }
        actions={
          stock?.warehouse?.is_depot ? (
            <StatusPill status="live" label="Depot" />
          ) : stock ? (
            <StatusPill status="inactive" label="Warehouse" />
          ) : undefined
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by product or code…"
        activeCount={warehouseId ? 1 : 0}
        onClearFilters={() => setWarehouseId('')}
        filters={
          <div className="w-64">
            <FilterSelect
              label="Depot"
              allLabel="My own depot"
              icon={<Truck size={14} />}
              value={warehouseId}
              onChange={setWarehouseId}
              searchPlaceholder="Search depots…"
              options={options}
            />
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={filtered as (DepotStockLine & Record<string, unknown>)[]}
        keyField="item_id"
        loading={isLoading}
        emptyIcon={<Boxes size={30} />}
        // A pair the depot once held and no longer does is left off by the
        // endpoint, so an empty table means the depot is genuinely bare.
        emptyMessage="Nothing in this depot — it has been emptied, or never loaded."
      />
    </>
  )
}
