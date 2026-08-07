import { Box, Truck, Weight } from 'lucide-react'
import { CapacityBar } from './CapacityBar'
import {
  VOLUME_UNIT,
  WEIGHT_UNIT,
  depotUtilisation,
  formatVolume,
  formatWeight,
  inTransitToward,
  type DepotStock,
  type DepotTransfer,
} from '../types'

interface Props {
  stock: DepotStock | undefined
  /** The movements feed, for the loads already travelling toward this depot. */
  transfers: DepotTransfer[]
  loading?: boolean
}

/**
 * Whether what this depot is carrying still fits in it.
 *
 * Weight and volume are asked separately because a depot runs out of one long
 * before the other: a pallet of water is heavy and small, a pallet of crisps is
 * light and enormous, and a single "fullness" figure would let either fill the
 * vehicle unnoticed.
 */
export function DepotCapacityPanel({ stock, transfers, loading = false }: Props) {
  const usage = depotUtilisation(stock, transfers)
  const travelling = inTransitToward(transfers, stock?.warehouse?.id)

  const incomingNote =
    travelling.count > 0
      ? `on the road in ${travelling.count} ${travelling.count === 1 ? 'load' : 'loads'}`
      : 'on the road'

  return (
    <section className="mb-5 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Truck size={15} aria-hidden className="text-[var(--accent-primary)]" />
        <h2 className="font-heading text-sm font-semibold text-[var(--text-primary)]">
          What it can carry
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-12 animate-pulse rounded bg-[var(--border-default)]" />
          <div className="h-12 animate-pulse rounded bg-[var(--border-default)]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CapacityBar
            label="Weight"
            icon={<Weight size={13} aria-hidden />}
            usage={usage.weight}
            format={formatWeight}
            unit={WEIGHT_UNIT}
            incomingNote={incomingNote}
          />
          <CapacityBar
            label="Volume"
            icon={<Box size={13} aria-hidden />}
            usage={usage.volume}
            format={formatVolume}
            unit={VOLUME_UNIT}
            incomingNote={incomingNote}
          />
        </div>
      )}

      {/* Said once, plainly: an uncapped depot behaves exactly as it always has,
          and nobody should be left wondering why the bars never move. */}
      {!loading && usage.weight.uncapped && usage.volume.uncapped && (
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          No maximum weight or volume on record for{' '}
          {stock?.warehouse?.name ?? 'this warehouse'}, so nothing here will warn you before a load
          goes past what it can hold.
        </p>
      )}
    </section>
  )
}
