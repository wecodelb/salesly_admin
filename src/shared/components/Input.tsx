import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...rest
}: Props) {
  // A bare <label> next to an <input> labels nothing: no htmlFor, no accessible
  // name, and clicking it doesn't focus the field. Generate an id when the
  // caller hasn't supplied one so every labelled Input is actually labelled.
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-[var(--text-muted)] pointer-events-none">{leftIcon}</span>
        )}
        <input
          {...rest}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={[
            'w-full h-10 px-3 text-sm rounded-[var(--radius-btn)]',
            'bg-[var(--bg-surface)] border border-[var(--border-default)]',
            'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]',
            'transition-colors',
            error ? 'border-[var(--accent-red)]' : '',
            leftIcon ? 'pl-9' : '',
            rightIcon ? 'pr-9' : '',
            className,
          ].join(' ')}
        />
        {rightIcon && (
          <span className="absolute right-3 text-[var(--text-muted)]">{rightIcon}</span>
        )}
      </div>
      {error && <p className="text-xs text-[var(--accent-red)]">{error}</p>}
    </div>
  )
}
