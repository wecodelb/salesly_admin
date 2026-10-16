interface Props {
  label: string
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}

const INPUT =
  'rounded-[var(--radius-btn)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm text-[var(--text-primary)]'

/** A labelled pair of days, either end left open: "taken from … to …". */
export function DateRangeFilter({ label, from, to, onChange }: Props) {
  return (
    <fieldset className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden>{label}</span>
      <input
        type="date"
        aria-label={`${label} from`}
        value={from}
        max={to || undefined}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className={INPUT}
      />
      <span aria-hidden>–</span>
      <input
        type="date"
        aria-label={`${label} to`}
        value={to}
        min={from || undefined}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className={INPUT}
      />
    </fieldset>
  )
}
