import { useEffect, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { PhoneInput } from '@/shared/components/PhoneInput/PhoneInput'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import type { Permission } from '@/core/auth/permissions'
import { PermissionMatrix } from './PermissionMatrix'
import { ROLE_OPTIONS, ROLE_PRESETS } from '../permission-catalog'
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
  role: AssignableRole
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

// A backend role string may be "owner" (not selectable here); fall back to
// "salesman" for the dropdown so the form always has a valid assignable role.
function toAssignableRole(role: string): AssignableRole {
  return role === 'admin' || role === 'manager' || role === 'salesman' ? role : 'salesman'
}

export function UserFormDrawer({ open, onClose, user }: Props) {
  const isEdit = !!user
  const { run } = useActionProgress()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

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
        role: toAssignableRole(user.role),
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
  const onRoleChange = (role: AssignableRole) =>
    setForm((f) => ({ ...f, role, permissions: ROLE_PRESETS[role] }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
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
        role: form.role,
        permissions: form.permissions,
      }
      if (form.password) payload.password = form.password
      const saved = await run(
        { label: 'Saving user', detail: form.name, success: `${form.name} has been saved.` },
        () => updateUser.mutateAsync({ id: user.id, payload }),
      )
      if (saved !== null) onClose()
    } else {
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
            onChange={(e) => onRoleChange(e.target.value as AssignableRole)}
            options={ROLE_OPTIONS}
          />
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
              onClick={() => set('permissions', ROLE_PRESETS[form.role])}
              className="text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              Reset to role defaults
            </button>
          </div>
          <PermissionMatrix
            value={form.permissions}
            onChange={(next) => set('permissions', next)}
          />
        </section>
      </div>
    </SideDrawer>
  )
}
