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

// `min-h` rather than a hard `h`, so a label that needs more room than the
// nominal height gets it instead of being clipped by its own box. The heights are
// still what every button lands on in practice — the minimum only gives way when
// the alternative is unreadable.
const sizeClasses: Record<Size, string> = {
  sm: 'min-h-8 px-3 py-1.5 text-sm gap-1.5',
  md: 'min-h-10 px-4 py-2 text-sm gap-2',
  lg: 'min-h-11 px-5 py-2.5 text-base gap-2',
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
        // `whitespace-nowrap` because a button's label is a name, not prose: in a
        // narrow table cell "Create load" would otherwise break across two lines
        // and be cut off by the button's own height. Squeezing the row is the
        // lesser evil against a label nobody can read.
        'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors rounded-[var(--radius-btn)] cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Icons keep their intrinsic size instead of being squashed by the flex.
        '[&>svg]:shrink-0',
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
