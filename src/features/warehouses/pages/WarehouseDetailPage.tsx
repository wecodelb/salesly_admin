import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, Lock, PackageCheck, Pencil } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { Button } from '@/shared/components/Button'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { DepotCapacityPanel } from '@/features/my-depot/components/DepotCapacityPanel'
import { useDepotStock, useDepotTransfers } from '@/features/my-depot/hooks/use-my-depot'
import {
  VOLUME_UNIT,
  WEIGHT_UNIT,
  formatQty,
  formatVolume,
  formatWeight,
  stockLineVolume,
  stockLineWeight,
  type DepotStockLine,
} from '@/features/my-depot/types'
import { WarehouseFormDrawer } from '../components/WarehouseFormDrawer'
import { useWarehouses } from '../hooks/use-warehouses'
import { type Warehouse } from '../types'

/**
 * One warehouse, and what is in it right now.
 *
 * This was a depot-stock screen with a salesman picker on top. Reaching it by
 * opening the warehouse you were already looking at is one fewer list to
 * reconcile, and it works for the buildings as well as the vans — the picker
 * only ever offered depots first because the screen was named after them.
 *
 * The three quantity figures are separate on purpose. `qty` is what is
 * physically here; `reserved` is what this morning's orders have already
 * promised out of it; `available` is the only one anybody may promise again. A
 * screen showing the first alone would have somebody selling the same carton
 * twice.
 */
export function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)

  const warehouseId = id ? Number(id) : null

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const debouncedSearch = useDebounce(search, 250)

  const { data: transfers = [] } = useDepotTransfers()
  const { data: warehouses = [] } = useWarehouses()
  const {
    data: stock,
    isLoading,
    isError,
    refetch,
  } = useDepotStock(warehouseId, warehouseId != null)

  // The list's own row, for the things the stock endpoint does not carry —
  // its location, and the ceilings somebody typed.
  const warehouse: Warehouse | undefined = useMemo(
    () => warehouses.find((w) => w.id === warehouseId),
    [warehouses, warehouseId],
  )

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
      // The item's own base unit, never the carton a load happened to arrive
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
    // What this line does to the load. A dash is not zero: an item nobody has
    // weighed contributes an unknown amount to the figure the capacity bars are
    // drawn from, and saying so is how it gets fixed.
    {
      key: 'weight',
      header: `Weight (${WEIGHT_UNIT})`,
      align: 'right',
      render: (line) => {
        const weight = stockLineWeight(line)
        return (
          <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
            {weight == null ? '—' : formatWeight(weight)}
          </span>
        )
      },
    },
    {
      key: 'volume',
      header: `Volume (${VOLUME_UNIT})`,
      align: 'right',
      render: (line) => {
        const volume = stockLineVolume(line)
        return (
          <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
            {volume == null ? '—' : formatVolume(volume)}
          </span>
        )
      },
    },
  ]

  // Read off the stock endpoint's own pivot rather than the list row, so it is
  // right even for a depot this console has never seen a movement for.
  const heldBy = stock?.salesman?.name ?? null
  const name = stock?.warehouse?.name ?? warehouse?.name ?? 'Warehouse'
  const isDepot = stock?.warehouse?.is_depot ?? warehouse?.is_depot ?? false

  if (isError) {
    return (
      <>
        <PageHeader
          title="Warehouse"
          subtitle="What this one is holding right now"
          actions={
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => navigate('/warehouses')}>
              Back
            </Button>
          }
        />
        <ErrorState
          title="Couldn't read this warehouse"
          message="It may belong to another company, or it may have been removed. Go back to the list, or retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={name}
        subtitle={[
          isDepot ? 'Depot' : 'Warehouse',
          heldBy,
          warehouse?.location,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill
              status={isDepot ? 'live' : 'inactive'}
              label={isDepot ? 'Depot' : 'Warehouse'}
            />
            {canManage && warehouse && (
              <Button variant="outline" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              icon={<ArrowLeft size={15} />}
              onClick={() => navigate('/warehouses')}
            >
              Back
            </Button>
          </div>
        }
      />

      {/* Above the counts, because the question asked of a depot in the morning
          is whether there is room for another load — not how many cartons of one
          product are left. */}
      <DepotCapacityPanel stock={stock} transfers={transfers} loading={isLoading} />
      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by product or code…"
      />

      <DataTable
        columns={columns}
        data={filtered as (DepotStockLine & Record<string, unknown>)[]}
        keyField="item_id"
        loading={isLoading}
        emptyIcon={<Boxes size={30} />}
        // A pair the warehouse once held and no longer does is left off by the
        // endpoint, so an empty table means it is genuinely bare.
        emptyMessage="Nothing in here — it has been emptied, or never stocked."
      />

      {warehouse && (
        <WarehouseFormDrawer
          open={editing}
          onClose={() => setEditing(false)}
          warehouse={warehouse}
        />
      )}
    </>
  )
}
