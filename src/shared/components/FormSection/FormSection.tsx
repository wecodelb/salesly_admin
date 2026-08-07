import type { ReactNode } from 'react'

interface Props {
  title: string
  /** One line on what this group is for — worth it on a long form. */
  description?: string
  icon?: ReactNode
  /** Sits opposite the title, e.g. an "Add address" button. */
  action?: ReactNode
  children: ReactNode
  /** Suppress the rule above — set on the first section of a form. */
  first?: boolean
}

/**
 * One titled group of fields in a drawer form.
 *
 * The rule above each section (rather than a border around it) is what turns a
 * long single-column form into readable chunks without boxing everything in.
 * The first section skips it, so the form doesn't open with a stray line.
 */
export function FormSection({ title, description, icon, action, children, first }: Props) {
  return (
    <section
      className={
        first
          ? 'pb-2'
          : 'border-t border-[var(--border-default)] pt-6 mt-6 pb-2'
      }
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon && (
            <span className="text-[var(--text-muted)] mt-0.5 flex-shrink-0">{icon}</span>
          )}
          <div className="min-w-0">
            <h3
              className="text-sm font-semibold tracking-wide text-[var(--heading-accent)]"
              style={{ textShadow: '0 0 14px var(--heading-glow)' }}
            >
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/**
 * A row of fields sitting side by side, collapsing to stacked on narrow
 * viewports. Wide drawers waste a lot of space one-field-per-line.
 */
export function FormRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 ${
        cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
      }`}
    >
      {children}
    </div>
  )
}
