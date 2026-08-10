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
import { DepotCapacityPanel } from '../components/DepotCapacityPanel'
import { useAllDepotStock, useDepotStock, useDepotTransfers, useWarehouseOptions } from '../hooks/use-my-depot'
import {
  VOLUME_UNIT,
  WEIGHT_UNIT,
  formatQty,
  formatVolume,
  formatWeight,
  stockLineVolume,
  stockLineWeight,
  type DepotStockLine,
  type DepotSummary,
} from '../types'

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

  // Empty is the fleet, not a fallback to somebody in particular. The question
  // this screen is opened with is who is carrying what, and answering it with
  // one arbitrary depot makes the reader guess which of six names mattered.
  const [warehouseId, setWarehouseId] = useState('')
  const [search, setSearch] = useState('')

  const viewingAll = warehouseId === ''

  const {
    data: fleetData = [],
    isLoading: fleetLoading,
    isError: fleetError,
    refetch: refetchFleet,
  } = useAllDepotStock(viewingAll)

  const {
    data: stock,
    isLoading: oneLoading,
    isError: oneError,
    refetch: refetchOne,
  } = useDepotStock(viewingAll ? null : Number(warehouseId), !viewingAll)

  const isLoading = viewingAll ? fleetLoading : oneLoading
  const isError = viewingAll ? fleetError : oneError
  const refetch = viewingAll ? refetchFleet : refetchOne

  /** Rows carry an `id` so the table has a key that is not the nested object. */
  const fleetRows = useMemo(
    () => fleetData.map((row) => ({ ...row, id: row.warehouse.id })),
    [fleetData],
  )

  const fleetColumns: Column<DepotSummary & Record<string, unknown>>[] = [
    {
      key: 'salesman',
      header: 'Salesman',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-[var(--text-primary)] truncate">
            {row.salesman?.name ?? 'Unassigned'}
          </div>
          <div className="text-xs font-mono text-[var(--text-muted)]">{row.warehouse.code}</div>
        </div>
      ),
    },
    {
      key: 'line_count',
      header: 'Products',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-[var(--text-secondary)]">
          {row.line_count === 0 ? 'Empty' : `${row.line_count}`}
        </span>
      ),
    },
    {
      key: 'total_available_qty',
      header: 'Available',
      sortable: true,
      // Available rather than on-hand: it is the only one of the three a
      // salesman may promise again, so it is the one worth scanning a fleet for.
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm text-[var(--text-primary)]">
            {formatQty(row.total_available_qty)}
          </span>
          {row.total_reserved_qty > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              {formatQty(row.total_reserved_qty)} reserved
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Load',
      // Both dimensions, because either can be the one that fills first: a van
      // of bottled water hits its weight ceiling with room to spare, a van of
      // tissue runs out of space while still light. A depot nobody has measured
      // says so rather than showing a reassuring 0%.
      render: (row) => {
        const cap = row.capacity
        const weight = cap?.weight_pct
        const volume = cap?.volume_pct

        if (weight == null && volume == null) {
          return <span className="text-sm text-[var(--text-muted)]">No limit set</span>
        }

        return (
          <div className="flex flex-col gap-0.5">
            <span
              className={[
                'font-mono text-sm tabular-nums',
                cap?.over_capacity ? 'text-[var(--accent-amber)]' : 'text-[var(--text-primary)]',
              ].join(' ')}
            >
              {weight != null ? `${Math.round(weight)}% ${WEIGHT_UNIT}` : `— ${WEIGHT_UNIT}`}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {volume != null ? `${Math.round(volume)}% ${VOLUME_UNIT}` : `— ${VOLUME_UNIT}`}
            </span>
          </div>
        )
      },
    },
  ]


  const debouncedSearch = useDebounce(search, 250)

  // Depots first, since this screen is about them; the fixed warehouses stay
  // reachable underneath because the evening's return lands in one.
  const options = useMemo(() => {
    /** A depot named after its owner says whose it is already. */
    const nameOf = (w: { name?: string | null; owner_name?: string | null }) => {
      const name = w.name ?? ''
      const owner = w.owner_name ?? ''
      if (!owner) return name
      return name.toLowerCase().includes(owner.toLowerCase()) ? name : `${name} — ${owner}`
    }

    const depots = warehouses.filter((w) => w.is_depot)
    const fixed = warehouses.filter((w) => !w.is_depot)

    return [
      ...depots.map((w) => ({
        value: String(w.id),
        // Whose depot it is only earns a place when the name does not already
        // say so. Most are named after their owner, and "Ahmad Khalil depot —
        // Ahmad Khalil" reads as two different things to anyone scanning the
        // list quickly.
        label: nameOf(w),
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
    // What this line does to the load he is carrying. A dash is not zero: an
    // item nobody has weighed contributes an unknown amount to a figure the
    // capacity bars above are drawn from, and saying so is how it gets fixed.
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

  // Read off the warehouse's own pivot by the endpoint, so it is right even for
  // a depot this console has never seen a movement for.
  const heldBy = stock?.salesman?.name ?? null

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

      {/* Above the counts, because the question a depot screen is opened with in
          the morning is whether there is room for another load — not how many
          cartons of one product are left. */}
      {!isError && (
        <>
          <DepotCapacityPanel stock={stock} transfers={transfers} loading={isLoading} />
          <StatStrip stats={stats} loading={isLoading} />
        </>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by product or code…"
        activeCount={warehouseId ? 1 : 0}
        onClearFilters={() => setWarehouseId('')}
        filters={
          <div className="w-64">
            <FilterSelect
              label="Salesman"
              // Cleared means the whole fleet. "My own depot" was a promise the
              // endpoint could not keep for the people who open this page.
              allLabel="All depots"
              icon={<Truck size={14} />}
              value={warehouseId}
              onChange={setWarehouseId}
              searchPlaceholder="Search depots…"
              options={options}
            />
          </div>
        }
      />

      {/* The failure goes here rather than in place of the page, because the
          way out of it is the picker directly above: answering with a bare
          error card hid the one control that could have answered the question. */}
      {isError ? (
        <ErrorState
          title={viewingAll ? 'Couldn’t read the depots' : "Couldn't read that depot"}
          message={
            viewingAll
              ? 'The server did not answer. Retry, or pick a single salesman above.'
              : 'It may belong to another company, or it may have been removed. Choose another salesman above, or retry.'
          }
          onRetry={() => refetch()}
        />
      ) : viewingAll ? (
        /* The fleet. One row per depot rather than every product of every
           vehicle: the question here is which depot is worth opening, and the
           lines are one click away once that is answered. */
        <DataTable
          columns={fleetColumns}
          data={fleetRows as (DepotSummary & Record<string, unknown>)[]}
          keyField="id"
          loading={isLoading}
          onRowClick={(row) => setWarehouseId(String((row as DepotSummary).warehouse.id))}
          emptyIcon={<Boxes size={30} />}
          emptyMessage="No depots yet — one is created with each salesman you add."
        />
      ) : (
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
      )}
    </>
  )
}
