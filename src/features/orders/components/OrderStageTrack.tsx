import { Check } from 'lucide-react'
import { goodsStage } from '../order-stage'
import type { Order } from '../types'

const STEPS = [
  { title: 'Taken', hint: 'by the salesman' },
  { title: 'Approved', hint: 'goods held in the warehouse' },
  { title: 'On the van', hint: 'signed for on his load' },
  { title: 'Delivered', hint: 'invoiced at the shop' },
]

/**
 * The order's way to the shop, four steps, with how far it has come. The
 * second and third are the ones that get confused: approving holds the goods
 * in the warehouse, and only the salesman signing for his load moves them.
 */
export function OrderStageTrack({ order }: { order: Order }) {
  const stage = goodsStage(order)
  const ended = stage.key === 'ended'

  return (
    <ol className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Where this order is">
      {STEPS.map((step, i) => {
        const done = i < stage.reached
        const current = !ended && i === stage.reached - 1
        return (
          <li
            key={step.title}
            aria-current={current ? 'step' : undefined}
            className={[
              'flex items-start gap-2.5 rounded-[var(--radius-card)] border p-3',
              current ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/6' : 'border-[var(--border-default)]',
              ended && i > 0 ? 'opacity-50' : '',
            ].join(' ')}
          >
            <span
              className={[
                'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                done ? 'bg-[var(--accent-primary)] text-white' : 'border border-[var(--border-default)] text-[var(--text-muted)]',
              ].join(' ')}
            >
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--text-primary)]">{step.title}</span>
              <span className="block text-xs text-[var(--text-muted)]">{step.hint}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
