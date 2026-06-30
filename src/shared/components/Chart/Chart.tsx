interface ChartPlaceholderProps {
  type?: 'area' | 'bar' | 'donut' | 'gauge'
  height?: number
  label?: string
}

export function ChartPlaceholder({ type = 'area', height = 200, label }: ChartPlaceholderProps) {
  return (
    <div
      className="flex items-center justify-center bg-[var(--bg-surface-raised)] rounded-xl text-[var(--text-muted)] text-sm"
      style={{ height }}
    >
      {label ?? `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`}
    </div>
  )
}

export { ChartPlaceholder as AreaChart }
export { ChartPlaceholder as BarChart }
export { ChartPlaceholder as DonutChart }
export { ChartPlaceholder as GaugeChart }
