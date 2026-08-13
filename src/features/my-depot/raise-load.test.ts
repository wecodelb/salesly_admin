import { describe, expect, it, vi } from 'vitest'

import { raiseLoad, type RaiseLoadOps } from './raise-load'
import type { CreateDepotTransferPayload, DepotTransfer } from './types'

const PAYLOAD = {
  warehouse_id: 1,
  des_warehouse_id: 2,
  rows: [{ item_id: 11, uom_id: 3, qty: 10 }],
} as CreateDepotTransferPayload

/** Records the order the calls actually happened in. */
function ops(overrides: Partial<RaiseLoadOps> = {}) {
  const order: string[] = []
  const built: RaiseLoadOps = {
    approve: vi.fn(async () => {
      order.push('approve')
    }),
    create: vi.fn(async () => {
      order.push('create')
      return { transfer: { id: 501 } as DepotTransfer, warnings: [] }
    }),
    ...overrides,
  }
  return { ops: built, order }
}

describe('raiseLoad', () => {
  it('asks the server to issue the load as it creates it', async () => {
    // The bug this pins: creating alone left a draft, the phone's row already
    // read "Load issued", and there was no Receive to press and nothing saying
    // why. `issue: true` makes it one transaction on the server rather than two
    // calls a dying browser could leave half-done.
    const { ops: o } = ops()

    await raiseLoad(o, { payload: PAYLOAD })

    expect(o.create).toHaveBeenCalledWith(expect.objectContaining({ issue: true }))
  })

  it('carries the rest of the payload through untouched', async () => {
    const { ops: o } = ops()

    await raiseLoad(o, { payload: PAYLOAD })

    expect(o.create).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouse_id: 1,
        des_warehouse_id: 2,
        rows: [{ item_id: 11, uom_id: 3, qty: 10 }],
      }),
    )
  })

  it('approves first when the request is still unanswered', async () => {
    // The server refuses `from_request_id` on an unapproved request, so creating
    // first is a guaranteed 422.
    const { ops: o, order } = ops()

    await raiseLoad(o, { payload: PAYLOAD, approveRequestId: 90 })

    expect(order).toEqual(['approve', 'create'])
    expect(o.approve).toHaveBeenCalledWith(90)
  })

  it('skips the approval when the request was already approved', async () => {
    const { ops: o, order } = ops()

    await raiseLoad(o, { payload: PAYLOAD, approveRequestId: null })

    expect(o.approve).not.toHaveBeenCalled()
    expect(order).toEqual(['create'])
  })

  it('never creates when the approval was refused', async () => {
    // A load against an unapproved request is the state the two documents must
    // never be left in, so a failed approval stops everything.
    const { ops: o } = ops({ approve: vi.fn().mockRejectedValue(new Error('nope')) })

    await expect(raiseLoad(o, { payload: PAYLOAD, approveRequestId: 90 })).rejects.toThrow('nope')

    expect(o.create).not.toHaveBeenCalled()
  })

  it('surfaces a refused create rather than reporting success', async () => {
    const { ops: o } = ops({ create: vi.fn().mockRejectedValue(new Error('no stock')) })

    await expect(raiseLoad(o, { payload: PAYLOAD })).rejects.toThrow('no stock')
  })

  it('hands back what the server returned, so the caller has the new load', async () => {
    const { ops: o } = ops()

    const result = await raiseLoad(o, { payload: PAYLOAD })

    expect(result.transfer.id).toBe(501)
  })
})
