import { useEffect, useMemo, useState } from 'react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { useApproveUnload, useDepotTransfer } from '../hooks/use-my-depot'
import {
  clampAccepted,
  formatQty,
  shortfallOf,
  type AcceptTransferRowPayload,
  type DepotTransfer,
} from '../types'

interface Props {
  /** The unload being answered; null closes the drawer. */
  unload: DepotTransfer | null
  onClose: () => void
}

interface Count {
  /** Held as the typed string so a half-erased figure doesn't snap back to 0
   *  under the cursor; the clamp runs on the number it parses to. */
  qty: string
  note: string
}

/**
 * Taking back what a salesman is sending in.
 *
 * The mirror of signing for a load, and deliberately the same surface: every
 * line starts at what he declared, a figure may only be lowered, and a note
 * explains any that was. What differs is where the refused goods go. On a load
 * a shortfall means stock that never left the warehouse; here it means crates
 * still on his van, which he can still sell — so the wording says his van
 * rather than "the source", because that is the difference somebody reading
 * this at the bay actually cares about.
 *
 * Nothing has moved yet when this opens. An unload waits as a draft with the
 * goods reserved on the van, and this is the call that moves them.
 */
export function ApproveUnloadDrawer({ unload, onClose }: Props) {
  const { run } = useActionProgress()
  // The list carries headers only, so the lines being counted come from here.
  const { data: detail, isLoading } = useDepotTransfer(unload?.id ?? null)
  const approve = useApproveUnload()

  const [counts, setCounts] = useState<Record<number, Count>>({})
  const [memo, setMemo] = useState('')

  const rows = useMemo(() => detail?.rows ?? [], [detail])

  useEffect(() => {
    if (!unload) return
    setCounts(
      Object.fromEntries(rows.map((row) => [row.id, { qty: String(row.trs_qty), note: '' }])),
    )
    setMemo('')
  }, [unload, rows])

  const setCount = (rowId: number, changes: Partial<Count>) =>
    setCounts((current) => ({
      ...current,
      [rowId]: { ...(current[rowId] ?? { qty: '', note: '' }), ...changes },
    }))

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
  const vanName = unload?.source?.name ?? 'his van'

  const handleApprove = async () => {
    if (!unload) return

    // Only the disputed lines travel: silence on a line means it came off the
    // van as declared, and a note is worth keeping even where the count agreed.
    const disputed: AcceptTransferRowPayload[] = counted
      .filter((line) => line.shortfall > 0 || line.note.trim())
      .map((line) => ({
        row_id: line.row.id,
        qty: line.accepted,
        ...(line.note.trim() ? { note: line.note.trim() } : {}),
      }))

    const done = await run(
      {
        label: 'Taking the stock back',
        detail: unload.trs_number,
        success:
          shortfallTotal > 0
            ? `Taken back, ${formatQty(shortfallTotal)} short — the rest stays on ${vanName}.`
            : 'Taken back in full — the stock is on the warehouse shelf.',
      },
      () =>
        approve.mutateAsync({
          id: unload.id,
          payload: {
            ...(disputed.length > 0 ? { rows: disputed } : {}),
            memo: memo.trim(),
          },
        }),
    )

    if (done !== null) onClose()
  }

  return (
    <SideDrawer
      open={!!unload}
      onClose={onClose}
      title={`Unload ${unload?.trs_number ?? ''}`.trim()}
      width="w-[720px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={approve.isPending}>
            Cancel
          </Button>
          <Button onClick={handleApprove} loading={approve.isPending} disabled={isLoading}>
            {shortfallTotal > 0 ? 'Take back what arrived' : 'Take it all back'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">
            {unload?.salesman?.name ?? 'The salesman'}
          </span>{' '}
          is sending this back from {vanName}. Nothing has moved yet — the goods are set aside on
          the van until you approve. Lower any line that came up short; anything you refuse stays
          on his van and he can still sell it.
        </p>

        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface-raised)]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Product
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Declared
                </th>
                <th className="w-32 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Receiving
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Stays on van
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
                <tr
                  key={line.row.id}
                  className="border-b border-[var(--border-subtle)] last:border-0"
                >
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
                      // The ceiling is what he declared. Letting the box go
                      // above it only moves the server's refusal to after the
                      // whole count is keyed.
                      max={line.row.trs_qty}
                      step="any"
                      value={counts[line.row.id]?.qty ?? ''}
                      onChange={(e) => setCount(line.row.id, { qty: e.target.value })}
                      aria-label={`Receiving quantity for ${line.row.item_name}`}
                      className="text-right"
                    />
                  </td>
                  <td
                    className={[
                      'whitespace-nowrap px-4 py-2.5 text-right tabular-nums',
                      line.shortfall > 0
                        ? 'font-medium text-[var(--accent-amber)]'
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
                      placeholder={line.shortfall > 0 ? 'Two cartons stayed on the van' : 'Optional'}
                    />
                  </td>
                </tr>
              ))}

              {!isLoading && counted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    This unload has no lines.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {shortfallTotal > 0 && (
          <p className="rounded-[var(--radius-card)] bg-[var(--accent-amber)]/10 px-3.5 py-2.5 text-sm text-[var(--accent-amber)]">
            {formatQty(shortfallTotal)} short overall. That much stays on {vanName} and is his to
            sell; the difference is recorded against each line.
          </p>
        )}

        <Input
          label="Memo (optional)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Counted at the bay with the driver"
        />
      </div>
    </SideDrawer>
  )
}
