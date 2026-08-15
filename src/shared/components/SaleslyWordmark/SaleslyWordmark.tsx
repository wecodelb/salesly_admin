interface Props {
  /** Everything else is derived from this, so one number scales the whole mark. */
  fontSize?: number
  color?: string
  accentColor?: string
}

/**
 * The Salesly logotype: "Sales" extra-bold against "ly" light, with a small teal
 * arrow above its right edge.
 *
 * A port of the mobile app's `SaleslyWordmark` widget, down to the ratios — the
 * tracking, the arrow's size and where it sits are all fractions of the font
 * size, which is what lets the same mark read correctly at 16px in the sidebar
 * and at 54px on the splash. The two apps show the same logo to the same people
 * on the same day, so the geometry is copied rather than re-eyeballed.
 *
 * The weight split is the whole idea: "Sales" is the word that carries, "ly"
 * is the suffix that turns it into a name. Setting both to bold — which is what
 * this console did before — loses that and reads as one heavy block.
 */
export function SaleslyWordmark({
  fontSize = 54,
  color = '#ffffff',
  accentColor = 'var(--color-salesly-teal, #2DD4BF)',
}: Props) {
  // Negative tracking, shared by both halves so they close up into one word
  // rather than two that happen to be adjacent.
  const letterSpacing = -fontSize * 0.037
  const arrowSize = fontSize * 0.37

  const half = {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize,
    lineHeight: 1,
    letterSpacing,
    color,
  } as const

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        // Bottom-aligned, so the two weights sit on one baseline.
        alignItems: 'flex-end',
      }}
    >
      <span style={{ ...half, fontWeight: 800 }}>Sales</span>
      <span style={{ ...half, fontWeight: 300 }}>ly</span>

      {/* Decorative: the name is already spelled out by the text beside it, so
          this is hidden rather than announced as an image. */}
      <svg
        width={arrowSize}
        height={arrowSize}
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
        style={{
          position: 'absolute',
          // Clear of the cap height rather than overlapping it.
          top: -fontSize * 0.4,
          right: 0,
        }}
      >
        <path
          d="M4 16L16 4M16 4H8M16 4V12"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
