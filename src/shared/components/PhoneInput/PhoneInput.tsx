import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { COUNTRY_CODES, countryByIso, flagFor } from './country-codes'
import { joinPhone, sanitizeNational, splitPhone } from './phone-value'

interface Props {
  label?: string
  /** The whole number as stored, e.g. "+961 3 456 789". */
  value: string
  onChange: (value: string) => void
  error?: string
  /** National-format example; the dialling code is shown by the picker. */
  placeholder?: string
  disabled?: boolean
}

const PANEL_WIDTH = 288
const GAP = 6
const ESTIMATED_PANEL_HEIGHT = 300

/**
 * A phone field with the country code chosen from a list and the rest typed —
 * Lebanon (+961) pre-selected, since that is where the customers are.
 *
 * The value stays a single string ("+961 3 456 789") in and out, so nothing
 * downstream — the customers search, the table, the mobile app — has to learn
 * about a second field. `splitPhone`/`joinPhone` own that translation.
 *
 * The list is portal-rendered: these fields sit inside `SideDrawer`, whose body
 * scrolls, and an inline panel would be clipped by it.
 */
export function PhoneInput({
  label,
  value,
  onChange,
  error,
  placeholder = '3 456 789',
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)

  const baseId = useId()
  const inputId = `${baseId}-number`
  const listboxId = `${baseId}-countries`

  const { iso, national } = splitPhone(value)
  const country = countryByIso(iso)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRY_CODES
    // Matching the dial code with or without its plus: people type "961".
    const bare = q.replace(/^\+/, '')
    return COUNTRY_CODES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.replace('+', '').startsWith(bare),
    )
  }, [query])

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const height = panelRef.current?.offsetHeight ?? ESTIMATED_PANEL_HEIGHT
    const spaceBelow = window.innerHeight - rect.bottom - GAP
    const up = spaceBelow < height && rect.top - GAP > spaceBelow

    setPos({
      top: up ? Math.max(GAP, rect.top - height - GAP) : rect.bottom + GAP,
      left: Math.min(Math.max(GAP, rect.left), window.innerWidth - PANEL_WIDTH - GAP),
      up,
    })
  }, [])

  const openList = () => {
    if (disabled) return
    place()
    setQuery('')
    setHighlight(Math.max(0, COUNTRY_CODES.findIndex((c) => c.iso === country.iso)))
    setOpen(true)
  }

  const closeList = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const pick = (isoCode: string) => {
    const next = countryByIso(isoCode)
    // Re-joined rather than string-replaced: switching country must not disturb
    // the number, and an empty number stays empty rather than becoming a code.
    onChange(joinPhone(next.dial, national))
    setOpen(false)
    // Straight on to typing the number, which is what the picker was for.
    numberRef.current?.focus()
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const row = listRef.current?.querySelector('[data-highlighted="true"]')
    if (row instanceof HTMLElement && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' })
    }
  }, [highlight, open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const reposition = () => place()

    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, place])

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlight((h) => (filtered.length ? (h + 1) % filtered.length : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlight((h) => (filtered.length ? (h - 1 + filtered.length) % filtered.length : 0))
        break
      case 'Home':
        e.preventDefault()
        setHighlight(0)
        break
      case 'End':
        e.preventDefault()
        setHighlight(Math.max(0, filtered.length - 1))
        break
      case 'Enter': {
        e.preventDefault()
        const choice = filtered[highlight]
        if (choice) pick(choice.iso)
        break
      }
      case 'Escape':
        e.preventDefault()
        closeList()
        break
      case 'Tab':
        closeList(false)
        break
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}

      <div
        ref={wrapRef}
        className={[
          'flex h-10 rounded-[var(--radius-btn)] overflow-hidden',
          'bg-[var(--bg-surface)] border transition-colors',
          // The ring belongs to the pair, not to whichever half has focus —
          // otherwise the control looks like two unrelated boxes.
          'focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/30 focus-within:border-[var(--accent-primary)]',
          error ? 'border-[var(--accent-red)]' : 'border-[var(--border-default)]',
          disabled ? 'opacity-60' : '',
        ].join(' ')}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-label={`Country code: ${country.name} ${country.dial}`}
          onClick={() => (open ? closeList() : openList())}
          className={[
            'flex items-center gap-1.5 pl-3 pr-2 flex-shrink-0 cursor-pointer',
            'border-r border-[var(--border-default)] focus:outline-none',
            'hover:bg-[var(--bg-surface-raised)] transition-colors',
          ].join(' ')}
        >
          <span aria-hidden className="text-base leading-none">
            {flagFor(country.iso)}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
            {country.dial}
          </span>
          <ChevronDown
            size={14}
            aria-hidden
            className={[
              'text-[var(--text-muted)] transition-transform duration-200 motion-reduce:transition-none',
              open ? 'rotate-180' : '',
            ].join(' ')}
          />
        </button>

        <input
          ref={numberRef}
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          value={national}
          onChange={(e) => onChange(joinPhone(country.dial, sanitizeNational(e.target.value)))}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 text-sm bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {error && <p className="text-xs text-[var(--accent-red)]">{error}</p>}

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            onKeyDown={onPanelKeyDown}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: PANEL_WIDTH }}
            className={[
              'z-[100] rounded-[var(--radius-card)] overflow-hidden',
              'bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-[var(--shadow-modal)]',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 px-3 h-10 border-b border-[var(--border-subtle)]">
              <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlight(0)
                }}
                placeholder="Country or code…"
                aria-label="Search countries"
                aria-controls={listboxId}
                className="w-full text-sm bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Country code"
              className="max-h-64 overflow-y-auto py-1"
            >
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-center text-[var(--text-muted)]">
                  No country matches “{query}”
                </p>
              )}

              {filtered.map((c, i) => {
                const isSelected = c.iso === country.iso
                return (
                  <div
                    key={c.iso}
                    role="option"
                    aria-selected={isSelected}
                    data-highlighted={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(c.iso)}
                    className={[
                      'mx-1 px-2.5 py-2 rounded-[var(--radius-btn)] cursor-pointer',
                      'flex items-center gap-2 text-sm transition-colors duration-100',
                      i === highlight ? 'bg-[var(--bg-surface-raised)]' : '',
                      isSelected
                        ? 'text-[var(--accent-primary)] font-medium'
                        : 'text-[var(--text-primary)]',
                    ].join(' ')}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {flagFor(c.iso)}
                    </span>
                    <span className="flex-1 min-w-0 truncate">{c.name}</span>
                    <span className="flex-shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                      {c.dial}
                    </span>
                    <Check
                      size={14}
                      aria-hidden
                      className={[
                        'flex-shrink-0 transition-opacity duration-150 motion-reduce:transition-none',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}
                    />
                  </div>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
