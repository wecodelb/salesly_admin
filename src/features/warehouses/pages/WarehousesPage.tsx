import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Pencil, Plus, Star, Trash2, Truck, Warehouse as WarehouseIcon } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { warehousesExportDoc } from '../warehouses-export'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { CodeChip } from '@/shared/components/CodeChip/CodeChip'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal/Modal'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { WarehouseFormDrawer } from '../components/WarehouseFormDrawer'
import { useDeleteWarehouse, useWarehouses } from '../hooks/use-warehouses'
import { capacityLine, deleteBlockedReason, type Warehouse } from '../types'
import { useAllDepotStock } from '@/features/my-depot/hooks/use-my-depot'
import { VOLUME_UNIT, WEIGHT_UNIT, formatQty } from '@/features/my-depot/types'

/**
 * Every place stock can sit: the buildings the company picks from, and the
 * depots the salesmen drive.
 *
 * Both kinds share the table because they share a table in the database and,
 * more to the point, because they are the two ends of every load — reading them
 * apart would hide that half the company's stock is on the road. What differs
 * is what may be typed: a depot's identity was written with its salesman's
 * account, so only its capacity and its location are editable here.
 */
export function WarehousesPage() {
  const navigate = useNavigate()
  const { run } = useActionProgress()
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)
  const canReadStock = can(PERMISSIONS.DEPOT_VIEW)

  const { data: warehouses = [], isLoading, isError, refetch } = useWarehouses()
  const deleteWarehouse = useDeleteWarehouse()

  // What each one is holding. This used to be a depot-stock screen of its own,
  // which asked the reader to hold two lists in their head — the places stock can
  // sit, and what is in them. They are one question.
  const { data: stockRows = [] } = useAllDepotStock(canReadStock)

  const stockByWarehouse = useMemo(
    () => new Map(stockRows.map((row) => [row.warehouse.id, row])),
    [stockRows],
  )

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Warehouse | null>(null)
  const [deleting, setDeleting] = useState<Warehouse | null>(null)

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()

    return warehouses.filter((w) => {
      const matchesQuery =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        (w.location ?? '').toLowerCase().includes(q) ||
        // A depot is looked up by the man driving it far more often than by the
        // code nobody chose.
        (w.salesman?.name ?? '').toLowerCase().includes(q)
      const matchesKind =
        !kindFilter || (kindFilter === 'depot' ? w.is_depot : !w.is_depot)

      return matchesQuery && matchesKind
    })
  }, [warehouses, debouncedSearch, kindFilter])

  const counts = useMemo(() => {
    const depots = warehouses.filter((w) => w.is_depot).length
    return { depots, fixed: warehouses.length - depots }
  }, [warehouses])

  const main = warehouses.find((w) => w.is_main) ?? null

  const stats = useMemo(
    () => [
      { label: 'Warehouses', value: counts.fixed, icon: <WarehouseIcon size={15} /> },
      { label: 'Depots', value: counts.depots, icon: <Truck size={15} /> },
      {
        label: 'Main warehouse',
        value: main?.name ?? 'None set',
        tone: main ? undefined : ('warn' as const),
        icon: <Star size={15} />,
      },
    ],
    [counts, main],
  )

  // The backend refuses both of these with a 422, so the row action is simply
  // not offered where one applies.
  const blockedReason = deleting ? deleteBlockedReason(deleting) : null

  const confirmDelete = async () => {
    if (!deleting || blockedReason) return
    const target = deleting
    // Closed first: leaving the confirm modal under the progress dialog would
    // put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting warehouse',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deleteWarehouse.mutateAsync(target.id),
    )
  }

  const columns: Column<Warehouse & Record<string, unknown>>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (w) => <CodeChip code={w.code} />,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (w) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--text-primary)]">{w.name}</div>
          {w.location && (
            <div className="truncate text-xs text-[var(--text-muted)]">{w.location}</div>
          )}
        </div>
      ),
    },
    {
      key: 'is_depot',
      header: 'Kind',
      sortable: true,
      // A depot is told from a warehouse by the man driving it, not by anything
      // in its own row — so the owner is part of what "kind" means here.
      render: (w) =>
        w.is_depot ? (
          <div className="flex items-center gap-2">
            <Truck size={14} aria-hidden className="flex-shrink-0 text-[var(--accent-primary)]" />
            <div className="min-w-0">
              <div className="text-sm text-[var(--text-primary)]">Depot</div>
              <div className="truncate text-xs text-[var(--text-muted)]">
                {w.salesman?.name ?? 'Nobody driving it'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <WarehouseIcon size={14} aria-hidden className="flex-shrink-0 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-secondary)]">Warehouse</span>
          </div>
        ),
    },
    {
      key: 'is_main',
      header: 'Main',
      sortable: true,
      render: (w) =>
        w.is_main ? (
          <StatusPill status="active" label="Main" />
        ) : (
          <span className="text-sm text-[var(--text-muted)]">—</span>
        ),
    },
    {
      key: 'max_weight',
      header: 'Capacity',
      align: 'right',
      // Nothing measured reads as uncapped rather than as a zero ceiling: the
      // two are opposite facts and every fixed warehouse is the former.
      render: (w) => {
        const line = capacityLine(w)
        return line ? (
          <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">{line}</span>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">Uncapped</span>
        )
      },
    },
    ...(canReadStock
      ? ([
          {
            key: 'line_count',
            header: 'Products',
            align: 'right',
            // Distinct products, not cartons — the figure that says whether a
            // place is worth opening.
            render: (w: Warehouse) => {
              const stock = stockByWarehouse.get(w.id)
              if (!stock) return <span className="text-sm text-[var(--text-muted)]">—</span>
              return (
                <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
                  {stock.line_count === 0 ? 'Empty' : stock.line_count}
                </span>
              )
            },
          },
          {
            key: 'total_available_qty',
            header: 'Available',
            align: 'right',
            // Available rather than on-hand: it is the only one of the three
            // anybody may promise again, so it is what a list is scanned for.
            render: (w: Warehouse) => {
              const stock = stockByWarehouse.get(w.id)
              if (!stock) return <span className="text-sm text-[var(--text-muted)]">—</span>
              return (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                    {formatQty(stock.total_available_qty)}
                  </span>
                  {stock.total_reserved_qty > 0 && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatQty(stock.total_reserved_qty)} reserved
                    </span>
                  )}
                </div>
              )
            },
          },
          {
            key: 'load',
            header: 'Load',
            align: 'right',
            // Both dimensions, because either can fill first: a van of bottled
            // water hits its weight ceiling with room to spare, one of tissue
            // runs out of space while still light.
            render: (w: Warehouse) => {
              const cap = stockByWarehouse.get(w.id)?.capacity
              const weight = cap?.weight_pct
              const volume = cap?.volume_pct

              if (weight == null && volume == null) {
                return <span className="text-sm text-[var(--text-muted)]">—</span>
              }

              return (
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={[
                      'font-mono text-sm tabular-nums',
                      cap?.over_capacity
                        ? 'text-[var(--accent-amber)]'
                        : 'text-[var(--text-primary)]',
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
        ] as Column<Warehouse & Record<string, unknown>>[])
      : []),
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            width: 'w-1',
            render: (w: Warehouse) => (
              <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <Dropdown
                  trigger={
                    <button
                      aria-label={`Actions for ${w.name}`}
                      className="cursor-pointer rounded-[var(--radius-btn)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
                    >
                      <MoreVertical size={15} />
                    </button>
                  }
                  items={[
                    { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(w) },
                    ...(deleteBlockedReason(w) === null
                      ? [
                          {
                            label: 'Delete',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: () => setDeleting(w),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            ),
          } as Column<Warehouse & Record<string, unknown>>,
        ]
      : []),
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Warehouses" subtitle="Where the company's stock sits" />
        <ErrorState
          title="Couldn't load warehouses"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Warehouses"
        subtitle="The buildings stock is picked from and the depots the salesmen drive — every load starts and ends in one of these."
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() => warehousesExportDoc(filtered, warehouses.length, debouncedSearch, kindFilter)}
            />
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New warehouse
              </Button>
            )}
          </>
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by name, code, location or salesman…"
        activeCount={kindFilter ? 1 : 0}
        onClearFilters={() => setKindFilter('')}
        filters={
          <div className="w-48">
            <FilterSelect
              label="Kind"
              allLabel="Everything"
              icon={<WarehouseIcon size={14} />}
              value={kindFilter}
              onChange={setKindFilter}
              options={[
                { value: 'warehouse', label: 'Warehouses', count: counts.fixed },
                { value: 'depot', label: 'Depots', count: counts.depots },
              ]}
            />
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={filtered as (Warehouse & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        // Opening a row reads what is in it. Editing is on the row's own menu:
        // clicking a warehouse to find out what it holds and being given a form
        // instead is the wrong answer to the more common question.
        onRowClick={canReadStock ? (w) => navigate(`/warehouses/${(w as Warehouse).id}`) : undefined}
        emptyIcon={<WarehouseIcon size={30} />}
        emptyMessage={
          search || kindFilter ? 'No warehouses match your filters.' : 'No warehouses yet.'
        }
        emptyAction={
          canManage && !search && !kindFilter ? (
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              Open the first warehouse
            </Button>
          ) : undefined
        }
      />

      <WarehouseFormDrawer open={creating} onClose={() => setCreating(false)} />
      <WarehouseFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        warehouse={editing}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete warehouse"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteWarehouse.isPending}
              disabled={!!blockedReason}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          {blockedReason ?? (
            <>
              Remove{' '}
              <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span>?
              Anything it is still holding goes with it, so only do this once the stock has been
              moved somewhere else.
            </>
          )}
        </p>
      </Modal>
    </>
  )
}
