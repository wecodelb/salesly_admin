import type { ReactNode } from 'react'

export interface TimelineItem {
  id: string | number
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
}

interface Props {
  /** Newest first — the first entry is highlighted as the current one. */
  items: TimelineItem[]
  emptyMessage?: string
}

export function Timeline({ items, emptyMessage = 'Nothing recorded yet.' }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">{emptyMessage}</p>
  }

  return (
    <ol className="flex flex-col">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <li key={item.id} className={['relative pl-6', isLast ? '' : 'pb-5'].join(' ')}>
            <span
              className={[
                'absolute left-0 top-1 h-3 w-3 rounded-full',
                i === 0 ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]',
              ].join(' ')}
            />
            {!isLast && (
              <span className="absolute left-[5px] top-4 bottom-0 w-px bg-[var(--border-default)]" />
            )}
            <div className="text-sm font-medium text-[var(--text-primary)]">{item.title}</div>
            {item.subtitle && (
              <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{item.subtitle}</div>
            )}
            {item.meta && <div className="mt-1 text-xs text-[var(--text-muted)]">{item.meta}</div>}
          </li>
        )
      })}
    </ol>
  )
}
