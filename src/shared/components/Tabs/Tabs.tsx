import type { ReactNode } from 'react'

interface Tab {
  key: string
  label: string
  count?: number
}

interface Props {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  children?: ReactNode
}

export function Tabs({ tabs, active, onChange, children }: Props) {
  return (
    <div>
      <div className="flex border-b border-[var(--border-default)] mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={[
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              active === tab.key
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={[
                'ml-2 px-1.5 py-0.5 text-xs rounded-full',
                active === tab.key
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)]',
              ].join(' ')}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}
