import { useRef, useState } from 'react'
import { money, type DayPoint } from '../data'

interface Props {
  data: DayPoint[]
  height?: number
}

/** Single-series area chart (14-day sales). One brand hue, recessive grid,
 *  crosshair + tooltip on hover; HTML axis labels so text never stretches. */
export function SalesTrendChart({ data, height = 210 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const max = Math.max(...data.map((d) => d.value))
  const top = Math.ceil(max / 1000) * 1000
  const W = 600
  const H = 100
  const stepX = W / (data.length - 1)
  const y = (v: number) => H - (v / top) * H
  const pts = data.map((d, i) => [i * stepX, y(d.value)] as const)

  const linePath = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`).join(' ')
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const frac = (e.clientX - rect.left) / rect.width
    const idx = Math.round(frac * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, idx)))
  }

  const gridLevels = [0.25, 0.5, 0.75]

  return (
    <div className="select-none">
      <div className="flex" style={{ height }}>
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2 py-0.5 text-[10px] text-[var(--text-muted)] font-mono text-right w-12 flex-shrink-0">
          <span>{money(top)}</span>
          <span>{money(top / 2)}</span>
          <span>$0</span>
        </div>

        {/* Plot */}
        <div
          ref={wrapRef}
          className="relative flex-1 min-w-0"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
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
            <path d={areaPath} fill="var(--accent-blue)" opacity="0.10" />
            <path
              d={linePath}
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="2"
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

          {/* Hover marker + tooltip (HTML so it never stretches) */}
          {hover !== null && (
            <>
              <div
                className="absolute h-2.5 w-2.5 rounded-full bg-[var(--accent-blue)] ring-2 ring-[var(--bg-surface)] pointer-events-none"
                style={{
                  left: `calc(${(pts[hover][0] / W) * 100}% - 5px)`,
                  top: `calc(${(pts[hover][1] / H) * 100}% - 5px)`,
                }}
              />
              <div
                className="absolute -translate-x-1/2 -translate-y-full pointer-events-none rounded-lg bg-[var(--text-primary)] text-[var(--bg-surface)] text-xs px-2.5 py-1.5 whitespace-nowrap shadow-[var(--shadow-card)]"
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
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between pl-12 pt-1.5 text-[10px] text-[var(--text-muted)]">
        <span>{data[0].label}</span>
        <span>{data[Math.floor(data.length / 2)].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  )
}
