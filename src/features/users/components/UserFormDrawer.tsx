import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { PhoneInput } from '@/shared/components/PhoneInput/PhoneInput'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import type { Permission } from '@/core/auth/permissions'
import { useAuthStore } from '@/core/auth/auth-store'
import { usePermissions } from '@/core/auth/use-permissions'
import { PermissionMatrix } from './PermissionMatrix'
import { ROLE_OPTIONS, ROLE_PRESETS } from '../permission-catalog'
import { grantableRoles, isAssignableRole, memberLocks } from '../member-locks'
import { useCreateUser, useUpdateUser } from '../hooks/use-users'
import type { AssignableRole, CompanyUser, CreateUserPayload, UpdateUserPayload } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  user?: CompanyUser | null // null/undefined = create mode
}

interface FormState {
  name: string
  email: string
  phone: string
  image: string
  password: string
  /** Empty when the member's current role is not one this form can express
   *  (the owner, a legacy role, none at all) and nobody has picked one. */
  role: AssignableRole | ''
  permissions: Permission[]
}

const EMPTY: FormState = {
  name: '',
  email: '',
  phone: '',
  image: '',
  password: '',
  role: 'salesman',
  permissions: ROLE_PRESETS.salesman,
}

export function UserFormDrawer({ open, onClose, user }: Props) {
  const isEdit = !!user
  const { run } = useActionProgress()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const editorId = useAuthStore((s) => s.user?.id)
  const { isAdmin } = usePermissions()
  const locks = user ? memberLocks(user, { id: editorId, isAdmin }) : null
  const accessLocked = locks?.access != null
  const roleOptions = grantableRoles(ROLE_OPTIONS, { isAdmin })

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Seed the form whenever the drawer opens (or the target user changes).
  useEffect(() => {
    if (!open) return
    if (user) {
      setForm({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        image: user.image ?? '',
        password: '',
        // Never guessed: an owner seeded as "salesman" was saved as one.
        role: isAssignableRole(user.role) ? user.role : '',
        permissions: user.permissions,
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, user])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  // Picking a role pre-fills its default permission set (editable afterward).
  const onRoleChange = (role: AssignableRole | '') =>
    setForm((f) => ({ ...f, role, permissions: role ? ROLE_PRESETS[role] : f.permissions }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    if (!isEdit && !form.role) e.role = 'Choose a role'
    if (!isEdit && form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (isEdit && form.password && form.password.length < 6)
      e.password = 'Password must be at least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    if (isEdit && user) {
      const payload: UpdateUserPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        image: form.image.trim() || null,
      }
      // Access is only sent when this editor may change it, and the role only
      // once there is one to send — the update writes whatever arrives, so
      // anything sent here is a decision, not a default.
      if (!accessLocked) {
        if (form.role) payload.role = form.role
        payload.permissions = form.permissions
      }
      if (form.password) payload.password = form.password
      const saved = await run(
        { label: 'Saving user', detail: form.name, success: `${form.name} has been saved.` },
        () => updateUser.mutateAsync({ id: user.id, payload }),
      )
      if (saved !== null) onClose()
    } else if (form.role) {
      const payload: CreateUserPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        image: form.image.trim() || null,
        password: form.password,
        role: form.role,
        permissions: form.permissions,
      }
      const created = await run(
        { label: 'Creating user', detail: form.name, success: `${form.name} can now sign in.` },
        () => createUser.mutateAsync(payload),
      )
      if (created !== null) onClose()
    }
  }

  const saving = createUser.isPending || updateUser.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'Create user'}
      width="w-[520px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Profile */}
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Profile
          </h3>
          <Input
            label="Full name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            placeholder="Jane Doe"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            placeholder="jane@company.com"
          />
          <PhoneInput
            label="Phone (optional)"
            value={form.phone}
            onChange={(v) => set('phone', v)}
            placeholder="3 000 000"
          />
          <Input
            label="Avatar URL (optional)"
            value={form.image}
            onChange={(e) => set('image', e.target.value)}
            placeholder="https://…"
          />
          <Input
            label={isEdit ? 'New password (leave blank to keep current)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            error={errors.password}
            placeholder="••••••••"
          />
        </section>

        {/* Role */}
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Role
          </h3>
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => onRoleChange(e.target.value as AssignableRole | '')}
            // A role this editor can't grant still has to be shown as what
            // it is, not as whichever option happens to come first.
            options={
              form.role && !roleOptions.some((o) => o.value === form.role)
                ? ROLE_OPTIONS.filter((o) => o.value === form.role).concat(roleOptions)
                : roleOptions
            }
            placeholder={
              form.role ? undefined : user ? `Keep current role (${user.role || 'none'})` : 'Choose a role'
            }
            disabled={accessLocked}
            error={errors.role}
          />
          {locks?.access && (
            <p className="text-xs text-[var(--text-muted)]">{locks.access}</p>
          )}
        </section>

        {/* Permissions */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
              Permissions
              <span className="ml-2 font-normal normal-case text-[var(--text-muted)]">
                {form.permissions.length} selected
              </span>
            </h3>
            <button
              type="button"
              disabled={accessLocked || !form.role}
              onClick={() => form.role && set('permissions', ROLE_PRESETS[form.role])}
              className="text-xs font-medium text-[var(--accent-primary)] hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
            >
              Reset to role defaults
            </button>
          </div>
          <PermissionMatrix
            value={form.permissions}
            onChange={(next) => set('permissions', next)}
            disabled={accessLocked}
          />
        </section>
      </div>
    </SideDrawer>
  )
}
