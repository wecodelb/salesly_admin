import type { Permission } from '@/core/auth/permissions'
import { PERMISSION_GROUPS } from '../permission-catalog'

interface Props {
  value: Permission[]
  onChange: (next: Permission[]) => void
  disabled?: boolean
}

export function PermissionMatrix({ value, onChange, disabled = false }: Props) {
  const selected = new Set(value)

  const toggle = (key: Permission) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange([...next])
  }

  const toggleGroup = (keys: Permission[], allOn: boolean) => {
    const next = new Set(selected)
    for (const k of keys) {
      if (allOn) next.delete(k)
      else next.add(k)
    }
    onChange([...next])
  }

  return (
    <div className="flex flex-col gap-4">
      {PERMISSION_GROUPS.map((group) => {
        const keys = group.items.map((i) => i.key)
        const allOn = keys.every((k) => selected.has(k))
        const someOn = keys.some((k) => selected.has(k))

        return (
          <div
            key={group.label}
            className="rounded-[var(--radius-btn)] border border-[var(--border-default)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-surface-raised)]">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {group.label}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleGroup(keys, allOn)}
                className="text-xs font-medium text-[var(--accent-primary)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {allOn ? 'Clear' : someOn ? 'Select all' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              {group.items.map((item) => {
                const on = selected.has(item.key)
                return (
                  <label
                    key={item.key}
                    className={[
                      'flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer select-none',
                      'border-t border-[var(--border-subtle)]',
                      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--bg-surface-raised)]',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggle(item.key)}
                      className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--accent-primary)] cursor-pointer"
                    />
                    <span className="text-[var(--text-primary)]">{item.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-[var(--text-muted)]">{item.key}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
