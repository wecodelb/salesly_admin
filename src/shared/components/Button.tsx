import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[var(--accent-primary)] hover:bg-[#0b3577] text-white',
  secondary: 'bg-[var(--bg-surface-raised)] hover:bg-[var(--border-default)] text-[var(--text-primary)]',
  ghost: 'bg-transparent hover:bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]',
  danger: 'bg-[var(--accent-red)] hover:bg-red-700 text-white',
  outline: 'border border-[var(--border-default)] bg-transparent hover:bg-[var(--bg-surface-raised)] text-[var(--text-primary)]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center font-medium transition-colors rounded-[var(--radius-btn)] cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
