import { useRef, useState, type MouseEvent } from 'react'
import { money, type TrendPoint } from '../types'

interface Props {
  data: TrendPoint[]
  height?: number
}

/**
 * A rounded ceiling for the axis, chosen from the data's own magnitude.
 *
 * The old chart snapped to the next 1000, which is fine for a five-figure week
 * and useless for a real one: a day that took $54 was drawn as a flat line
 * along the bottom of a $1000 axis. This steps 1/2/5 through each power of ten
 * instead, so the line uses the box it is given whatever the scale.
 */
function niceTop(max: number): number {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const normalized = max / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

/**
 * Single-series area chart of what was invoiced per day.
 *
 * Guarded against the shapes real data actually takes and demo data never did:
 * an empty range, a single point, and — most commonly — a stretch of days where
 * nothing was sold at all. Each of those divided by zero or spread an array of
 * nothing in the version this replaced.
 */
export function SalesTrendChart({ data, height = 210 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--text-muted)]"
        style={{ height }}
      >
        No sales in this period.
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.value))
  const top = niceTop(max)
  const W = 600
  const H = 100
  // A single day has no span to divide across, so it sits at the left edge
  // rather than dividing by zero.
  const stepX = data.length > 1 ? W / (data.length - 1) : 0
  const y = (v: number) => H - (v / top) * H
  const pts = data.map((d, i) => [i * stepX, y(d.value)] as const)

  const linePath = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`).join(' ')
  const lastX = pts[pts.length - 1][0]
  const areaPath = `${linePath} L${lastX},${H} L0,${H} Z`

  const onMove = (e: MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || data.length < 2) return
    const frac = (e.clientX - rect.left) / rect.width
    const idx = Math.round(frac * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, idx)))
  }

  const gridLevels = [0.25, 0.5, 0.75]
  const allZero = max === 0

  return (
    <div className="select-none">
      <div className="flex" style={{ height }}>
        <div className="flex w-14 flex-shrink-0 flex-col justify-between py-0.5 pr-2 text-right font-mono text-[10px] text-[var(--text-muted)]">
          <span>{money(top)}</span>
          <span>{money(top / 2)}</span>
          <span>$0</span>
        </div>

        <div
          ref={wrapRef}
          className="relative min-w-0 flex-1"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {gridLevels.map((g) => (
              <line
                key={g}
                x1="0"
                x2={W}
                y1={H * g}
                y2={H * g}
                stroke="var(--border-default)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {!allZero && <path d={areaPath} fill="url(#salesTrendFill)" />}
            <path
              d={linePath}
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {hover !== null && (
              <line
                x1={pts[hover][0]}
                x2={pts[hover][0]}
                y1="0"
                y2={H}
                stroke="var(--text-muted)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {hover !== null && (
            <>
              <div
                className="pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-[var(--accent-blue)] ring-2 ring-[var(--bg-surface)]"
                style={{
                  left: `calc(${(pts[hover][0] / W) * 100}% - 5px)`,
                  top: `calc(${(pts[hover][1] / H) * 100}% - 5px)`,
                }}
              />
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[var(--text-primary)] px-2.5 py-1.5 text-xs text-[var(--bg-surface)] shadow-[var(--shadow-card)]"
                style={{
                  left: `${(pts[hover][0] / W) * 100}%`,
                  top: `calc(${(pts[hover][1] / H) * 100}% - 10px)`,
                }}
              >
                <span className="opacity-70">{data[hover].label} · </span>
                <span className="font-mono font-semibold">{money(data[hover].value)}</span>
              </div>
            </>
          )}

          {allZero && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-[var(--radius-pill)] bg-[var(--bg-surface-raised)] px-3 py-1 text-xs text-[var(--text-muted)]">
                Nothing invoiced in these {data.length} days
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pl-14 pt-1.5 text-[10px] text-[var(--text-muted)]">
        <span>{data[0].label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)].label}</span>}
        {data.length > 1 && <span>{data[data.length - 1].label}</span>}
      </div>
    </div>
  )
}
