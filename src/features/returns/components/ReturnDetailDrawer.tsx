import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Button } from '@/shared/components/Button'
import { useReturn } from '../hooks/use-returns'
import {
  formatMoney,
  formatQty,
  owesRefund,
  rowsOf,
  type SalesReturn,
} from '../types'

interface Props {
  /** The return being read; null closes the drawer. */
  document: SalesReturn | null
  onClose: () => void
}

/**
 * What came back, line by line.
 *
 * A drawer rather than a page because there is nothing to do here — a return
 * is written at the counter and never answered, so this is a document somebody
 * glances at while scanning the list, not a screen they navigate to.
 *
 * Every line names the invoice it came off. That is not decoration: it is the
 * price the credit was worth, and it is what settles the argument six weeks
 * later about whether these crates were the ones sold in March at four or the
 * ones sold in April at six.
 */
export function ReturnDetailDrawer({ document, onClose }: Props) {
  // The list carries headers only, so the lines come from here.
  const { data: detail, isLoading } = useReturn(document?.id ?? null)
  const rows = rowsOf(detail ?? ({} as SalesReturn))
  const shown = detail ?? document

  return (
    <SideDrawer
      open={!!document}
      onClose={onClose}
      title={`Return #${document?.trs_number ?? ''}`.trim()}
      width="w-[680px]"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Customer" value={shown?.customer?.name ?? '—'} />
          <Field label="Salesman" value={shown?.salesman?.name ?? '—'} />
          <Field label="Taken" value={shown?.trs_date ?? '—'} />
          <Field label="Back into" value={shown?.warehouse?.name ?? '—'} />
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Credited
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[var(--accent-green)]">
            {formatMoney(shown?.credit_applied)}
          </div>

          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">Goods worth</span>
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {formatMoney(shown?.credit_value)}
            </span>
          </div>

          {/* Only when there is one. A nil refund line on every document would
              train people to stop reading the place the real one appears. */}
          {shown && owesRefund(shown) && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-[var(--accent-amber)]">
                Refund owing — these goods were already paid for
              </span>
              <span className="font-mono font-medium tabular-nums text-[var(--accent-amber)]">
                {formatMoney(shown.credit_excess)}
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface-raised)]">
                <Th>Product</Th>
                <Th>From invoice</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Unit price</Th>
                <Th align="right">Value</Th>
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

              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="text-[var(--text-primary)]">{row.item_name}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">
                      {row.item_code}
                    </div>
                    {row.note.trim() && (
                      <div className="mt-0.5 text-xs italic text-[var(--text-muted)]">
                        {row.note}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">
                    {/* Null on a row written before this was recorded — a dash
                        rather than "#0", which would read as a real document. */}
                    {row.invoice_number == null ? '—' : `#${row.invoice_number}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[var(--text-primary)]">
                    {formatQty(row.trs_qty)} {row.uom_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatMoney(row.unit_price)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums text-[var(--text-primary)]">
                    {formatMoney(row.line_value)}
                  </td>
                </tr>
              ))}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    This return has no lines.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {shown?.memo?.trim() && (
          <div className="rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)]">
            {shown.memo}
          </div>
        )}
      </div>
    </SideDrawer>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="text-[var(--text-primary)]">{value}</div>
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={[
        'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]',
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </th>
  )
}
