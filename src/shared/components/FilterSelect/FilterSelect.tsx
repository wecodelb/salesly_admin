import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
  /** Matching rows in the current dataset — rendered right-aligned. */
  count?: number
  /** Options sharing a group are rendered under a sticky heading. */
  group?: string
  icon?: ReactNode
}

interface Props {
  /** Field name — shown alone when nothing is picked, then as the value's prefix. */
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  /** Label of the reset row, e.g. "All salesmen". Defaults to `All ${label}`. */
  allLabel?: string
  icon?: ReactNode
  /** Force the search box on or off; by default it appears past SEARCH_THRESHOLD options. */
  searchable?: boolean
  searchPlaceholder?: string
}

const GAP = 6
const MIN_PANEL_WIDTH = 208
const MAX_PANEL_WIDTH = 320
const ESTIMATED_PANEL_HEIGHT = 260
const SEARCH_THRESHOLD = 7
/** Must outlast the closing transition below, or the panel vanishes mid-fade. */
const EXIT_MS = 110

/**
 * The dropdown used in list-page filter bars.
 *
 * A native `<select>` (what these filters used to be) can't be styled past its
 * trigger: the option list is drawn by the OS, so it can't show counts, group
 * headings, a check on the current value, or animate. This renders its own
 * listbox instead — through a portal, since a filter bar sitting above an
 * `overflow-x-auto` table would clip an inline panel — and keeps the keyboard
 * contract a `<select>` gives you for free: arrows to move, Home/End, Enter to
 * pick, Escape to dismiss, type-ahead via the search box.
 *
 * For form fields use `SearchableSelect`/`Select`; this one is deliberately
 * filter-shaped (compact pill, "All …" reset row, inline clear button).
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  icon,
  searchable,
  searchPlaceholder = 'Search…',
}: Props) {
  const [open, setOpen] = useState(false)
  // `mounted` keeps the panel in the DOM through its exit transition, so
  // closing fades out instead of snapping away.
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(
    null,
  )

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  const resetLabel = allLabel ?? `All ${label.toLowerCase()}`

  // The reset row is a real option rather than a footer button: it then takes
  // part in search, keyboard navigation and the selected checkmark like the
  // rest, with no special cases anywhere below.
  const withReset = useMemo<FilterOption[]>(
    () => [{ value: '', label: resetLabel }, ...options],
    [options, resetLabel],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return withReset
    return withReset.filter((o) => o.label.toLowerCase().includes(q))
  }, [withReset, query])

  // Preserves the caller's ordering while collecting each group's options.
  const groups = useMemo(() => {
    const byGroup = new Map<string, { option: FilterOption; index: number }[]>()
    filtered.forEach((option, index) => {
      const key = option.group ?? ''
      const bucket = byGroup.get(key)
      if (bucket) bucket.push({ option, index })
      else byGroup.set(key, [{ option, index }])
    })
    return [...byGroup.entries()]
  }, [filtered])

  const selected = options.find((o) => o.value === value)
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const height = panelRef.current?.offsetHeight ?? ESTIMATED_PANEL_HEIGHT
    const spaceBelow = window.innerHeight - rect.bottom - GAP
    // Only flip when there is genuinely more room above — near the top of a
    // short viewport, cramped-below still beats clipped-above.
    const up = spaceBelow < height && rect.top - GAP > spaceBelow
    const width = Math.min(Math.max(rect.width, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH)

    setPos({
      top: up ? Math.max(GAP, rect.top - height - GAP) : rect.bottom + GAP,
      left: Math.min(Math.max(GAP, rect.left), window.innerWidth - width - GAP),
      width,
      up,
    })
  }, [])

  const openMenu = useCallback(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current)
    // Position in the same batch as the open flag: deferring it to an effect
    // means the first paint has no coordinates and the panel flashes at 0,0.
    place()
    setQuery('')
    setHighlight(Math.max(0, withReset.findIndex((o) => o.value === value)))
    setMounted(true)
    setOpen(true)
  }, [place, value, withReset])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setShown(false)
    exitTimer.current = setTimeout(() => setMounted(false), EXIT_MS)
    triggerRef.current?.focus()
  }, [])

  const select = useCallback(
    (option: FilterOption) => {
      onChange(option.value)
      closeMenu()
    },
    [closeMenu, onChange],
  )

  // Re-measure once the panel is real: its actual height decides whether the
  // upward flip was the right call, and the search box changes that height.
  useLayoutEffect(() => {
    if (!mounted) return
    place()
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [mounted, place])

  useEffect(() => {
    if (!open) return
    if (showSearch) searchRef.current?.focus()
    else panelRef.current?.focus()
  }, [open, showSearch])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      // Not closeMenu(): clicking elsewhere shouldn't yank focus back to the
      // trigger and undo whatever the click was aiming at.
      setOpen(false)
      setShown(false)
      exitTimer.current = setTimeout(() => setMounted(false), EXIT_MS)
    }
    // The panel is fixed-position, so it has to be told when its anchor moves.
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

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current) }, [])

  // Keep the highlighted row in view when the arrows walk past the fold.
  // jsdom has no scrollIntoView, hence the guard rather than a bare call.
  useEffect(() => {
    if (!open) return
    const row = listRef.current?.querySelector('[data-highlighted="true"]')
    if (row instanceof HTMLElement && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' })
    }
  }, [highlight, open])

  const move = (delta: number) => {
    setHighlight((h) => {
      if (filtered.length === 0) return 0
      return (h + delta + filtered.length) % filtered.length
    })
  }

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
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
        const option = filtered[highlight]
        if (option) select(option)
        break
      }
      case 'Escape':
        e.preventDefault()
        closeMenu()
        break
      case 'Tab':
        closeMenu()
        break
    }
  }

  const onTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (open) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openMenu()
    }
  }

  const active = value !== ''

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={selected ? `${label}: ${selected.label}` : `${label}: ${resetLabel}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={[
          'group h-10 w-full pl-3 pr-2 text-sm rounded-[var(--radius-btn)]',
          'flex items-center gap-2 cursor-pointer select-none',
          'border transition-[background-color,border-color,box-shadow,color] duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30',
          active
            ? 'bg-[var(--accent-primary)]/8 border-[var(--accent-primary)]/45 text-[var(--text-primary)]'
            : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--text-muted)]/50 hover:bg-[var(--bg-surface-raised)]',
          open ? 'ring-2 ring-[var(--accent-primary)]/30 border-[var(--accent-primary)]' : '',
        ].join(' ')}
      >
        {icon && (
          <span
            className={active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}
            aria-hidden
          >
            {icon}
          </span>
        )}

        <span className="flex-1 min-w-0 text-left truncate">
          {selected ? (
            <>
              <span className="text-[var(--text-muted)]">{label}: </span>
              <span className="font-medium text-[var(--accent-primary)]">{selected.label}</span>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">{resetLabel}</span>
          )}
        </span>

        {active && (
          // A nested <button> would be invalid inside the trigger, so this is a
          // span that swallows the click before the trigger's own handler runs.
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Clear ${label.toLowerCase()} filter`}
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
            className="flex-shrink-0 p-0.5 rounded-full text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 transition-colors"
          >
            <X size={13} />
          </span>
        )}

        <ChevronDown
          size={15}
          aria-hidden
          className={[
            'flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none',
            active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {mounted &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
            className={[
              'z-[100] rounded-[var(--radius-card)] overflow-hidden focus:outline-none',
              'bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-[var(--shadow-modal)]',
              'transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
              'motion-reduce:transition-none',
              pos.up ? 'origin-bottom' : 'origin-top',
              shown
                ? 'opacity-100 scale-100 translate-y-0'
                : `opacity-0 scale-[0.96] ${pos.up ? 'translate-y-1' : '-translate-y-1'}`,
            ].join(' ')}
          >
            {showSearch && (
              <div className="flex items-center gap-2 px-3 h-10 border-b border-[var(--border-subtle)]">
                <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setHighlight(0)
                  }}
                  onKeyDown={onPanelKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={`Search ${label.toLowerCase()}`}
                  aria-controls={listboxId}
                  aria-activedescendant={filtered[highlight] ? optionId(highlight) : undefined}
                  className="w-full text-sm bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
            )}

            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={label}
              aria-activedescendant={
                !showSearch && filtered[highlight] ? optionId(highlight) : undefined
              }
              className="max-h-64 overflow-y-auto py-1"
            >
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-center text-[var(--text-muted)]">
                  No matches for “{query}”
                </p>
              )}

              {groups.map(([group, entries]) => (
                <div key={group || '_'}>
                  {group && (
                    <p className="sticky top-0 z-10 bg-[var(--bg-surface)] px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {group}
                    </p>
                  )}
                  {entries.map(({ option, index }) => {
                    const isSelected = option.value === value
                    const isHighlighted = index === highlight
                    return (
                      <div
                        key={option.value || '_all'}
                        id={optionId(index)}
                        role="option"
                        aria-selected={isSelected}
                        data-highlighted={isHighlighted}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => select(option)}
                        className={[
                          'relative mx-1 px-2.5 py-2 rounded-[var(--radius-btn)] cursor-pointer',
                          'flex items-center gap-2 text-sm transition-colors duration-100',
                          isHighlighted ? 'bg-[var(--bg-surface-raised)]' : '',
                          isSelected
                            ? 'text-[var(--accent-primary)] font-medium'
                            : 'text-[var(--text-primary)]',
                        ].join(' ')}
                      >
                        {/* Selection marker on the left edge; it grows in so the
                            pick registers even when the row is already hovered. */}
                        <span
                          aria-hidden
                          className={[
                            'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full bg-[var(--accent-primary)]',
                            'transition-[height] duration-150 motion-reduce:transition-none',
                            isSelected ? 'h-4' : 'h-0',
                          ].join(' ')}
                        />
                        {option.icon && (
                          <span className="flex-shrink-0 text-[var(--text-muted)]" aria-hidden>
                            {option.icon}
                          </span>
                        )}
                        <span className="flex-1 min-w-0 truncate">{option.label}</span>
                        {option.count !== undefined && (
                          <span
                            className={[
                              'flex-shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded-full',
                              isSelected
                                ? 'bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]'
                                : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)]',
                            ].join(' ')}
                          >
                            {option.count}
                          </span>
                        )}
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
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
