import { ArrowRight, Truck, Warehouse } from 'lucide-react'
import type { DepotWarehouseRef } from '../types'

interface Props {
  source: DepotWarehouseRef
  destination: DepotWarehouseRef
  /** Renders the two ends stacked with their codes — for a detail header rather
   *  than a table cell. */
  size?: 'sm' | 'md'
}

/** A truck icon on the end that is a depot is the whole reading: the same pair of
 *  documents is a load out or an evening's return depending on which side it
 *  sits, and nothing else on the row says so. */
function End({ warehouse, size }: { warehouse: DepotWarehouseRef; size: 'sm' | 'md' }) {
  const Icon = warehouse.is_depot ? Truck : Warehouse
  const iconSize = size === 'md' ? 15 : 13

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon
        size={iconSize}
        aria-hidden
        className={
          warehouse.is_depot
            ? 'flex-shrink-0 text-[var(--accent-primary)]'
            : 'flex-shrink-0 text-[var(--text-muted)]'
        }
      />
      <span className={size === 'md' ? 'truncate' : 'truncate text-sm'}>
        {warehouse.name ?? '—'}
      </span>
    </span>
  )
}

export function TransferRoute({ source, destination, size = 'sm' }: Props) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-[var(--text-primary)]">
      <End warehouse={source} size={size} />
      <ArrowRight size={13} aria-hidden className="flex-shrink-0 text-[var(--text-muted)]" />
      <End warehouse={destination} size={size} />
    </span>
  )
}
