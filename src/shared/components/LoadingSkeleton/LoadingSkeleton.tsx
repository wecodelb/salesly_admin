interface Props {
  rows?: number
  className?: string
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-[var(--border-default)]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[var(--border-default)] rounded w-3/4" />
        <div className="h-3 bg-[var(--border-subtle)] rounded w-1/2" />
      </div>
      <div className="h-3 bg-[var(--border-default)] rounded w-16" />
    </div>
  )
}

export function LoadingSkeleton({ rows = 5, className = '' }: Props) {
  return (
    <div className={['space-y-4 p-4', className].join(' ')}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={['animate-pulse rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)]', className].join(' ')}>
      <div className="h-4 bg-[var(--border-default)] rounded w-1/3 mb-3" />
      <div className="h-8 bg-[var(--border-default)] rounded w-1/2 mb-2" />
      <div className="h-3 bg-[var(--border-subtle)] rounded w-2/3" />
    </div>
  )
}
