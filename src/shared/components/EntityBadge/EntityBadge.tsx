import type { ReactNode } from 'react'

interface Props {
  /** Drives both the initials and the colour, so a row keeps its identity. */
  name: string
  /** Replaces the initials — use where the row type has a natural icon. */
  icon?: ReactNode
  size?: 'sm' | 'md'
}

// The six accent hues, in a fixed order. Picking by hash rather than by index
// means a row keeps its colour when the list is re-sorted or filtered.
const HUES = [
  'var(--accent-primary)',
  'var(--accent-blue)',
  'var(--accent-teal)',
  'var(--accent-green)',
  'var(--accent-amber)',
  'var(--accent-red)',
] as const

function hueFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return HUES[hash % HUES.length]
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * The coloured square that anchors each row of a reference list. Without it a
 * two-column table of short strings reads as an undifferentiated wall of text.
 */
export function EntityBadge({ name, icon, size = 'md' }: Props) {
  const hue = hueFor(name)
  const box = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'

  return (
    <div
      aria-hidden
      className={`${box} rounded-[var(--radius-btn)] flex items-center justify-center flex-shrink-0 font-semibold`}
      style={{ backgroundColor: `color-mix(in srgb, ${hue} 14%, transparent)`, color: hue }}
    >
      {icon ?? initialsFor(name)}
    </div>
  )
}
