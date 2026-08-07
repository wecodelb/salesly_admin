import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { SelectOption } from '@/core/types/common'

interface Props {
  label?: string
  error?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  searchPlaceholder?: string
}

/**
 * A filterable dropdown — `Select` is a plain native `<select>` with no
 * search, which doesn't scale to a currency/product picker with dozens of
 * options. Built on the same open/outside-click pattern as `Dropdown`.
 */
export function SearchableSelect({
  label,
  error,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // The trigger is a <button>, so htmlFor can't bind it. Pointing
  // aria-labelledby at the label *and* the button itself keeps the current
  // selection in the accessible name — "Price list, Wholesale" rather than
  // either half alone.
  const baseId = useId()
  const labelId = `${baseId}-label`
  const buttonId = `${baseId}-button`

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && (
        <label id={labelId} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          id={buttonId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={label ? `${labelId} ${buttonId}` : undefined}
          onClick={() => setOpen((o) => !o)}
          className={[
            'w-full h-10 px-3 text-sm rounded-[var(--radius-btn)] flex items-center justify-between gap-2',
            'bg-[var(--bg-surface)] border border-[var(--border-default)]',
            'text-left cursor-pointer transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]',
            error ? 'border-[var(--accent-red)]' : '',
          ].join(' ')}
        >
          <span className={selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={15} className="text-[var(--text-muted)] flex-shrink-0" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] overflow-hidden">
            <div className="p-2 border-b border-[var(--border-subtle)] flex items-center gap-2">
              <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full text-sm bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-[var(--text-muted)]">No matches</div>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={[
                    'w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer',
                    opt.value === value
                      ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-[var(--accent-red)]">{error}</p>}
    </div>
  )
}
