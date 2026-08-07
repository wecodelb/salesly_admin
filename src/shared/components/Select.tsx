import { useId, type SelectHTMLAttributes } from 'react'
import type { SelectOption } from '@/core/types/common'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export function Select({
  label,
  error,
  options,
  placeholder,
  className = '',
  id,
  ...rest
}: Props) {
  // Same fix as Input: the label was rendered beside the control but never
  // bound to it, so the <select> had no accessible name.
  const autoId = useId()
  const selectId = id ?? autoId

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <select
        {...rest}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={[
          'w-full h-10 px-3 text-sm rounded-[var(--radius-btn)]',
          'bg-[var(--bg-surface)] border border-[var(--border-default)]',
          'text-[var(--text-primary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]',
          'transition-colors cursor-pointer',
          error ? 'border-[var(--accent-red)]' : '',
          className,
        ].join(' ')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[var(--accent-red)]">{error}</p>}
    </div>
  )
}
