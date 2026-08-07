import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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

const MENU_WIDTH = 176
const GAP = 4
/** Enough room to be worth opening downward; otherwise the menu flips up. */
const MIN_SPACE_BELOW = 180

/**
 * A row-actions menu.
 *
 * Rendered through a portal onto <body> rather than inline: every DataTable
 * wraps its table in `overflow-x-auto` for wide columns, and an overflow
 * container clips absolutely-positioned children — so an inline menu on the
 * last visible row was being cut off. Fixed positioning off the trigger's
 * rect escapes that entirely, and lets the menu flip upward near the bottom of
 * the viewport instead of running off-screen.
 */
export function Dropdown({ trigger, items, align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? items.length * 38 + 8
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < Math.min(MIN_SPACE_BELOW, menuHeight + GAP)

    setPos({
      top: flipUp ? rect.top - menuHeight - GAP : rect.bottom + GAP,
      left:
        align === 'right'
          ? Math.max(GAP, rect.right - MENU_WIDTH)
          : Math.min(rect.left, window.innerWidth - MENU_WIDTH - GAP),
    })
  }, [align, items.length])

  const toggle = () => {
    // Position before opening, in the same batch: waiting for a layout effect
    // to supply it means the first render has nowhere to put the menu, so it
    // renders nothing at all.
    if (!open) place()
    setOpen((o) => !o)
  }

  // Re-measure once the menu exists, since its real height may differ from the
  // estimate used above and decide whether it should have flipped upward.
  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // A fixed menu doesn't travel with the page, so close rather than let it
    // drift away from its row.
    const onScroll = () => setOpen(false)

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <div ref={triggerRef} className="relative inline-block">
      <div onClick={toggle} className="cursor-pointer">
        {trigger}
      </div>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            // Deliberately not role="menu"/"menuitem": that pattern promises
            // arrow-key navigation this doesn't implement, and native buttons
            // already announce and behave correctly.
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="z-[100] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] py-1"
          >
            {items.map((item, i) => (
              <div key={i}>
                {item.divider && i > 0 && (
                  <div className="my-1 border-t border-[var(--border-subtle)]" />
                )}
                <button
                  onClick={() => {
                    item.onClick()
                    setOpen(false)
                  }}
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
          </div>,
          document.body,
        )}
    </div>
  )
}
