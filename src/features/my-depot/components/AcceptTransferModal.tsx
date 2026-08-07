import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/shared/components/Modal/Modal'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { useAcceptDepotTransfer, useDepotTransfer } from '../hooks/use-my-depot'
import {
  clampAccepted,
  formatQty,
  shortfallOf,
  type AcceptTransferRowPayload,
  type DepotTransfer,
} from '../types'

interface Props {
  /** The issued load being signed for; null closes the modal. */
  transfer: DepotTransfer | null
  onClose: () => void
}

interface Count {
  /** Kept as the typed string so a half-erased figure doesn't snap back to 0
   *  under the cursor; the clamp runs on the number it parses to. */
  qty: string
  note: string
}

/**
 * Signing for a load.
 *
 * Every line starts at the quantity that left the warehouse, because that is
 * what usually turns up and a driver in a hurry should be able to tap straight
 * through. A figure may only be lowered: accepting more than was issued is the
 * one thing the backend refuses outright, and letting the box go past the
 * issued quantity only moves that refusal to after the whole count is keyed.
 *
 * Whatever is refused goes back to the source in the same transaction — the
 * goods were debited when they left, so the shortfall is not a loss, it is
 * stock that never travelled. Saying so on screen is what stops a short count
 * reading like a mistake somebody has to correct.
 */
export function AcceptTransferModal({ transfer, onClose }: Props) {
  const { run } = useActionProgress()
  // The list carries headers only, so the lines being counted come from here.
  const { data: detail, isLoading } = useDepotTransfer(transfer?.id ?? null)
  const acceptTransfer = useAcceptDepotTransfer()

  const [counts, setCounts] = useState<Record<number, Count>>({})
  const [memo, setMemo] = useState('')

  const rows = useMemo(() => detail?.rows ?? [], [detail])

  useEffect(() => {
    if (!transfer) return
    setCounts(
      Object.fromEntries(rows.map((row) => [row.id, { qty: String(row.trs_qty), note: '' }])),
    )
    setMemo('')
  }, [transfer, rows])

  const setCount = (rowId: number, changes: Partial<Count>) =>
    setCounts((current) => ({
      ...current,
      [rowId]: { ...(current[rowId] ?? { qty: '', note: '' }), ...changes },
    }))

  /** What each line comes to once the ceiling is applied, in the packaging it
   *  was issued in and in the base units the shortfall is credited back in. */
  const counted = rows.map((row) => {
    const entry = counts[row.id]
    const accepted = clampAccepted(Number(entry?.qty ?? row.trs_qty), row.trs_qty)
    return {
      row,
      accepted,
      note: entry?.note ?? '',
      shortfall: shortfallOf(row.trs_qty, accepted),
      shortfallBase: shortfallOf(row.qty, accepted * row.unit),
    }
  })

  const shortfallTotal = counted.reduce((sum, line) => sum + line.shortfallBase, 0)

  const handleAccept = async () => {
    if (!transfer) return

    // Only the disputed lines are sent: silence on a line means it arrived as
    // issued, and a note is worth keeping even when the count agreed.
    const disputed: AcceptTransferRowPayload[] = counted
      .filter((line) => line.shortfall > 0 || line.note.trim())
      .map((line) => ({
        row_id: line.row.id,
        qty: line.accepted,
        ...(line.note.trim() ? { note: line.note.trim() } : {}),
      }))

    const accepted = await run(
      {
        label: 'Accepting load',
        detail: transfer.trs_number,
        success:
          shortfallTotal > 0
            ? `Signed for, ${formatQty(shortfallTotal)} short — the rest went back to ${transfer.source?.name ?? 'the source'}.`
            : 'Signed for in full — the goods are in the depot.',
      },
      () =>
        acceptTransfer.mutateAsync({
          id: transfer.id,
          payload: {
            ...(disputed.length > 0 ? { rows: disputed } : {}),
            memo: memo.trim(),
          },
        }),
    )

    if (accepted !== null) onClose()
  }

  return (
    <Modal
      open={!!transfer}
      onClose={onClose}
      title={`Accept ${transfer?.trs_number ?? 'load'}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={acceptTransfer.isPending}>
            Cancel
          </Button>
          <Button onClick={handleAccept} loading={acceptTransfer.isPending} disabled={isLoading}>
            {shortfallTotal > 0 ? 'Sign for what arrived' : 'Sign for the whole load'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Every line starts at what left{' '}
          <span className="font-medium text-[var(--text-primary)]">
            {transfer?.source?.name ?? 'the warehouse'}
          </span>
          . Lower any that came up short — nothing may be signed for above the quantity issued, and
          whatever you refuse is credited straight back to the source.
        </p>

        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface-raised)]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Product
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Issued
                </th>
                <th className="w-32 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Accepted
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Short
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Why
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    Loading the lines…
                  </td>
                </tr>
              )}

              {counted.map((line) => (
                <tr key={line.row.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="text-[var(--text-primary)]">{line.row.item_name}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">
                      {line.row.item_code}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatQty(line.row.trs_qty)} {line.row.uom_name}
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      max={line.row.trs_qty}
                      step="any"
                      value={counts[line.row.id]?.qty ?? ''}
                      onChange={(e) => setCount(line.row.id, { qty: e.target.value })}
                      aria-label={`Accepted quantity for ${line.row.item_name}`}
                      className="text-right"
                    />
                  </td>
                  <td
                    className={[
                      'whitespace-nowrap px-4 py-2.5 text-right tabular-nums',
                      line.shortfall > 0
                        ? 'font-medium text-[var(--accent-red)]'
                        : 'text-[var(--text-muted)]',
                    ].join(' ')}
                  >
                    {line.shortfall > 0 ? formatQty(line.shortfall) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      value={counts[line.row.id]?.note ?? ''}
                      onChange={(e) => setCount(line.row.id, { note: e.target.value })}
                      aria-label={`Note for ${line.row.item_name}`}
                      placeholder={line.shortfall > 0 ? 'Two cartons damaged' : 'Optional'}
                    />
                  </td>
                </tr>
              ))}

              {!isLoading && counted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    This load has no lines to count.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {shortfallTotal > 0 && (
          <p className="rounded-[var(--radius-card)] bg-[var(--accent-amber)]/10 px-3.5 py-2.5 text-sm text-[var(--accent-amber)]">
            {formatQty(shortfallTotal)} short overall. That much goes back to{' '}
            {transfer?.source?.name ?? 'the source warehouse'}, and the discrepancy is recorded
            against each line.
          </p>
        )}

        <Input
          label="Memo (optional)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Counted at the gate with the driver"
        />
      </div>
    </Modal>
  )
}
