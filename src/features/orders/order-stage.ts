import type { Order } from './types'

export type GoodsStageKey = 'waiting' | 'held' | 'delivered' | 'ended'

export interface GoodsStage {
  key: GoodsStageKey
  /** Steps done on the track: taken (1), approved & held (2), on the van (3), delivered (4). */
  reached: number
  /** Where the goods are, in one sentence for the office. */
  sentence: string
}

/**
 * Where an order's goods are.
 *
 * Approval does not move stock: it holds the goods in the source warehouse for
 * the order, and they stay there — counted in the warehouse, unavailable to
 * anyone else — until the salesman signs for them on his load. Only delivery
 * takes them out for good.
 */
export function goodsStage(order: Pick<Order, 'status' | 'warehouse' | 'deliverer' | 'invoice'>): GoodsStage {
  const warehouse = order.warehouse.name ?? 'the warehouse'
  const deliverer = order.deliverer.name ?? 'the salesman'

  switch (order.status) {
    case 'SUBMITTED':
      return {
        key: 'waiting',
        reached: 1,
        sentence: 'Nothing is held yet — the goods stay free in the warehouse until the order is approved.',
      }
    case 'APPROVED':
    case 'DRAFT':
      return {
        key: 'held',
        reached: 2,
        sentence: `Held for this order in ${warehouse} — still in the warehouse. They move to ${deliverer}'s van only when he signs for them on his load.`,
      }
    case 'COMPLETED':
    case 'CONFIRMED':
      return {
        key: 'delivered',
        reached: 4,
        sentence: order.invoice ? `Delivered, as invoice #${order.invoice.trs_number}.` : 'Delivered.',
      }
    case 'REJECTED':
      return { key: 'ended', reached: 1, sentence: 'Rejected — nothing was held for it.' }
    default:
      return { key: 'ended', reached: 1, sentence: 'Cancelled — nothing is held for it.' }
  }
}
