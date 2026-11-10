import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { ImportResult } from '../api/products-api'

/** The pieces the Import products dialog is laid out from. */

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-3">
      <div className="h-6 w-6 rounded-full bg-[var(--accent-primary)] text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">{title}</h3>
        {children}
      </div>
    </section>
  )
}

export function ImportSummary({ result }: { result: ImportResult }) {
  const made = [
    result.new.categories.length && `categories: ${result.new.categories.join(', ')}`,
    result.new.brands.length && `brands: ${result.new.brands.join(', ')}`,
    result.new.units.length && `units: ${result.new.units.join(', ')}`,
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <p className="flex gap-2 text-sm font-medium text-[var(--accent-green)]">
        <CheckCircle2 size={18} className="flex-shrink-0" />
        The file was imported.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ['Created', result.created],
            ['Updated', result.updated],
            ['Unchanged', result.unchanged],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] px-4 py-3">
            <div className="text-xs text-[var(--text-muted)]">{label}</div>
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
          </div>
        ))}
      </div>
      {made.length > 0 && (
        <p className="text-sm text-[var(--text-secondary)]">Also created {made.join('; ')}.</p>
      )}
    </div>
  )
}
