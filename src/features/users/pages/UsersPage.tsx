import { useMemo, useState } from 'react'
import { UserPlus, Pencil, Trash2, Ban, CircleCheck, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { ExportPdfButton } from '@/features/reports/components/ExportPdfButton'
import { useShownRows } from '@/features/reports/use-shown-rows'
import { usersExportDoc } from '../users-export'
import { FilterBar } from '@/shared/components/FilterBar/FilterBar'
import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { Button } from '@/shared/components/Button'
import { FilterSelect } from '@/shared/components/FilterSelect/FilterSelect'
import { Modal } from '@/shared/components/Modal/Modal'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { UserFormDrawer } from '../components/UserFormDrawer'
import { useDeleteUser, useUpdateUser, useUsers } from '../hooks/use-users'
import { ROLE_OPTIONS } from '../permission-catalog'
import type { CompanyUser } from '../types'

type ConfirmAction = { kind: 'delete' | 'suspend'; user: CompanyUser } | null

// Owner/Admin/Manager get distinct, CVD-validated identity hues (see
// --role-* tokens); Salesman — the default, highest-volume role — stays
// neutral so the three "elevated" roles are what draw the eye.
const roleBadge: Record<string, string> = {
  owner: 'bg-[var(--role-owner)]/10 text-[var(--role-owner)]',
  admin: 'bg-[var(--role-admin)]/10 text-[var(--role-admin)]',
  manager: 'bg-[var(--role-manager)]/10 text-[var(--role-manager)]',
  salesman: 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]',
}

export function UsersPage() {
  const { run } = useActionProgress()
  const { can } = usePermissions()
  const canEdit = can(PERMISSIONS.USERS_EDIT)
  const canRemove = can(PERMISSIONS.USERS_REMOVE)
  const { data: users = [], isLoading, isError, refetch } = useUsers()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyUser | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction>(null)

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return users.filter((u) => {
      const matchesQuery =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      const matchesRole = !roleFilter || u.role === roleFilter
      return matchesQuery && matchesRole
    })
  }, [users, debouncedSearch, roleFilter])

  const openCreate = () => {
    setEditing(null)
    setDrawerOpen(true)
  }

  const openEdit = (user: CompanyUser) => {
    setEditing(user)
    setDrawerOpen(true)
  }

  const reactivate = (user: CompanyUser) =>
    run(
      {
        label: 'Reactivating user',
        detail: user.name,
        success: `${user.name} can sign in again.`,
      },
      () => updateUser.mutateAsync({ id: user.id, payload: { status: 'active' } }),
    )

  const runConfirm = async () => {
    if (!confirm) return
    const { kind, user } = confirm
    // Closed first: leaving the confirm modal under the progress dialog would
    // put two overlays on screen at once.
    setConfirm(null)

    if (kind === 'delete') {
      await run(
        {
          label: 'Removing user',
          detail: user.name,
          success: `${user.name} was removed from the company.`,
        },
        () => deleteUser.mutateAsync(user.id),
      )
    } else {
      await run(
        {
          label: 'Deactivating user',
          detail: user.name,
          success: `${user.name} can no longer sign in.`,
        },
        () => updateUser.mutateAsync({ id: user.id, payload: { status: 'suspended' } }),
      )
    }
  }

  // What the table is actually showing, in the order it shows them.
  // DataTable owns the sort, so this is the page's only way to print rows
  // in the order somebody reads them on screen.
  const { rows: shownRows, onVisibleRows } = useShownRows(filtered)

  const columns: Column<CompanyUser & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[var(--bg-surface-raised)] flex items-center justify-center overflow-hidden flex-shrink-0">
            {u.image ? (
              <img src={u.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {u.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[var(--text-primary)] truncate">{u.name}</div>
            <div className="text-xs text-[var(--text-muted)] truncate">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (u) => (
        <span
          className={[
            'inline-flex px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium capitalize',
            roleBadge[u.role] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
          ].join(' ')}
        >
          {u.role}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (u) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <ShieldCheck size={14} className="text-[var(--text-muted)]" />
          {u.permissions.length}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (u) => <StatusPill status={u.status === 'active' ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: '',
      width: 'w-1',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <button
              title="Edit"
              onClick={() => openEdit(u)}
              className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
            >
              <Pencil size={15} />
            </button>
          )}
          {canEdit && (u.status === 'active' ? (
            <button
              title="Deactivate"
              onClick={() => setConfirm({ kind: 'suspend', user: u })}
              className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-amber-600 hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
            >
              <Ban size={15} />
            </button>
          ) : (
            <button
              title="Reactivate"
              onClick={() => reactivate(u)}
              className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-green-600 hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
            >
              <CircleCheck size={15} />
            </button>
          ))}
          {canRemove && (
            <button
              title="Remove from company"
              onClick={() => setConfirm({ kind: 'delete', user: u })}
              className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (isError) {
    return (
      <>
        <PageHeader title="Users" subtitle="Team members, roles, and permissions" />
        <ErrorState
          title="Couldn't load users"
          message="The server didn't respond. Check that the backend is running, then retry."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Team members, roles, and permissions"
        actions={
          <>
            <ExportPdfButton
              variant="outline"
              disabled={isLoading || isError}
              build={() =>
                usersExportDoc(shownRows(), users.length, [
                  debouncedSearch.trim() && `Search “${debouncedSearch.trim()}”`,
                  roleFilter && `Role: ${roleFilter}`,
                ])
              }
            />
            {canEdit && (
              <Button icon={<UserPlus size={16} />} onClick={openCreate}>
                Create user
              </Button>
            )}
          </>
        }
      />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by name or email…"
        activeCount={roleFilter ? 1 : 0}
        onClearFilters={() => setRoleFilter('')}
        filters={
          <div className="w-48">
            <FilterSelect
              label="Role"
              allLabel="All roles"
              icon={<ShieldCheck size={14} />}
              value={roleFilter}
              onChange={setRoleFilter}
              options={ROLE_OPTIONS.map((r) => ({
                ...r,
                count: users.filter((u) => u.role === r.value).length,
              }))}
            />
          </div>
        }
      />

      <DataTable
        onVisibleRows={onVisibleRows}
        columns={columns}
        data={filtered as (CompanyUser & Record<string, unknown>)[]}
        keyField="id"
        loading={isLoading}
        emptyMessage="No users match your filters."
      />

      <UserFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={editing}
      />

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'delete' ? 'Remove user' : 'Deactivate user'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.kind === 'delete' ? 'danger' : 'primary'}
              loading={deleteUser.isPending || updateUser.isPending}
              onClick={runConfirm}
            >
              {confirm?.kind === 'delete' ? 'Remove' : 'Deactivate'}
            </Button>
          </>
        }
      >
        {confirm?.kind === 'delete' ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Remove <span className="font-medium text-[var(--text-primary)]">{confirm.user.name}</span>{' '}
            from this company? Their global account is kept, but they'll lose access to this
            company's data.
          </p>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Deactivate <span className="font-medium text-[var(--text-primary)]">{confirm?.user.name}</span>?
            They'll be signed out immediately and blocked from logging in, but all their data and
            settings are preserved. You can reactivate them anytime.
          </p>
        )}
      </Modal>
    </>
  )
}
