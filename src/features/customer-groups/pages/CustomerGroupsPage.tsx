import { useMemo, useState } from 'react'
import { BadgeCheck, MoreVertical, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal/Modal'
import { Dropdown } from '@/shared/components/Dropdown/Dropdown'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { UsageBar } from '@/shared/components/UsageBar/UsageBar'
import { StatStrip } from '@/shared/components/StatStrip/StatStrip'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { CustomerGroupFormDrawer } from '../components/CustomerGroupFormDrawer'
import { useCustomerGroups, useDeleteCustomerGroup } from '../hooks/use-customer-groups'
import type { CustomerGroup } from '../types'

// Preferences > Customer groups. The company writes its own vocabulary here
// (New, VIP, Blocked…) and the customer form picks from it — the id lives on
// the customer as `customer_group_id`, which is never shown in the UI.
export function CustomerGroupsPage() {
  const { run } = useActionProgress()
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)

  const { data: groups = [], isLoading, isError, refetch } = useCustomerGroups()
  const deleteGroup = useDeleteCustomerGroup()

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CustomerGroup | null>(null)
  const [deleting, setDeleting] = useState<CustomerGroup | null>(null)

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((s) => s.name.toLowerCase().includes(q))
  }, [groups, debouncedSearch])

  // A new group goes to the end of the list unless the form is told otherwise.
  const nextOrder = useMemo(
    () => Math.max(0, ...groups.map((s) => s.sort_order)) + 1,
    [groups],
  )

  // The backend refuses (409) to drop a group customers still carry, so the
  // confirm button is held shut rather than sent into a certain error.
  const deleteBlocked = (deleting?.customers_count ?? 0) > 0

  const confirmDelete = async () => {
    if (!deleting || deleteBlocked) return
    const target = deleting
    // Closed first: leaving the confirm modal under the progress dialog
    // would put two overlays on screen at once.
    setDeleting(null)
    await run(
      {
        label: 'Deleting group',
        detail: target.name,
        success: `${target.name} was removed.`,
      },
      () => deleteGroup.mutateAsync(target.id),
    )
  }

  // Bars are only comparable if they share a scale, so the most-used group
  // sets it for the whole column.
  const maxUsage = useMemo(
    () => Math.max(0, ...groups.map((s) => s.customers_count ?? 0)),
    [groups],
  )

  const stats = useMemo(() => {
    const used = groups.filter((s) => (s.customers_count ?? 0) > 0).length
    const customers = groups.reduce((sum, s) => sum + (s.customers_count ?? 0), 0)
    return [
      { label: 'Groups', value: groups.length, icon: <BadgeCheck size={15} /> },
      { label: 'Customers classified', value: customers, icon: <Users size={15} /> },
      {
        label: 'Unused',
        value: groups.length - used,
        tone: groups.length - used > 0 ? ('warn' as const) : ('muted' as const),
      },
    ]
  }, [groups])

  const columns: Column<CustomerGroup & Record<string, unknown>>[] = [
    {
      key: 'sort_order',
      header: 'Order',
      width: 'w-20',
      sortable: true,
      render: (s) => (
        <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full text-xs font-semibold tabular-nums bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]">
          {s.sort_order}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Group',
      sortable: true,
      render: (s) => <span className="font-medium text-[var(--text-primary)]">{s.name}</span>,
    },
    {
      key: 'customers_count',
      header: 'Customers',
      sortable: true,
      render: (s) => (
        <UsageBar
          count={s.customers_count ?? 0}
          max={maxUsage}
          noun="customer"
          emptyLabel="Not used yet"
        />
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            width: 'w-1',
            render: (s: CustomerGroup) => (
              <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <Dropdown
                  trigger={
                    <button className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer">
                      <MoreVertical size={15} />
                    </button>
                  }
                  items={[
                    { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(s) },
                    {
                      label: 'Delete',
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onClick: () => setDeleting(s),
                    },
                  ]}
                />
              </div>
            ),
          } as Column<CustomerGroup & Record<string, unknown>>,
        ]
      : []),
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Customer groups" subtitle="How your team classifies customers" />
        <ErrorState
          title="Couldn't load customer groups"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Customer groups"
        subtitle="The labels your team classifies customers with. The customer form picks from this list, in the order you set here."
        actions={
          canManage ? (
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New group
            </Button>
          ) : undefined
        }
      />

      <StatStrip stats={stats} loading={isLoading} />

      <FilterBar search={search} onSearch={setSearch} searchPlaceholder="Search by name…" />

      <DataTable
        columns={columns}
        data={filtered as (CustomerGroup & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        onRowClick={canManage ? (s) => setEditing(s as CustomerGroup) : undefined}
        emptyIcon={<BadgeCheck size={30} />}
        emptyMessage={search ? 'No groups match your search.' : 'No customer groups yet.'}
        emptyAction={
          canManage && !search ? (
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              Add the first group
            </Button>
          ) : undefined
        }
      />

      <CustomerGroupFormDrawer
        open={creating}
        onClose={() => setCreating(false)}
        nextOrder={nextOrder}
      />
      <CustomerGroupFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        group={editing}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete customer group"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteGroup.isPending}
              disabled={deleteBlocked}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          {deleteBlocked ? (
            <>
              <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span> is
              still set on {deleting?.customers_count}{' '}
              {deleting?.customers_count === 1 ? 'customer' : 'customers'} and can't be deleted
              until they're moved to another group.
            </>
          ) : (
            <>
              Remove{' '}
              <span className="font-medium text-[var(--text-primary)]">{deleting?.name}</span>? No
              customers carry it, so nothing else changes.
            </>
          )}
        </p>
      </Modal>
    </>
  )
}
