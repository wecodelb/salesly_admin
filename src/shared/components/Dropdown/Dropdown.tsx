import { useState, useRef, useEffect, type ReactNode } from 'react'

interface DropdownItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  divider?: boolean
}

interface Props {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

export function Dropdown({ trigger, items, align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className={[
            'absolute z-50 mt-1 min-w-[160px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] py-1',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.divider && i > 0 && <div className="my-1 border-t border-[var(--border-subtle)]" />}
              <button
                onClick={() => { item.onClick(); setOpen(false) }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left',
                  item.danger
                    ? 'text-[var(--accent-red)] hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]',
                ].join(' ')}
              >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
