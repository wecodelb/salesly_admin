import { Pause, Play } from 'lucide-react'
import { formatClock, timeAt, type TrailWindow } from '../live-map-logic'

interface Props {
  /** The day being replayed; null when there is nothing to replay. */
  window: TrailWindow | null
  pct: number
  playing: boolean
  speed: number
  marks: number[]
  date: string
  today: string
  /** No salesman picked: the bar explains itself instead of sitting dead. */
  hasSelection: boolean
  onToggle: () => void
  onSeek: (pct: number) => void
  onSpeed: (speed: number) => void
  onDate: (date: string) => void
}

const SPEEDS = [1, 2, 4]

/**
 * Plays a salesman's day back along his trail: the whole day in a minute at
 * 1×, faster at 2× and 4×. The ticks on the bar are his calls.
 */
export function ReplayBar({ window, pct, playing, speed, marks, date, today, hasSelection, onToggle, onSeek, onSpeed, onDate }: Props) {
  const ready = window != null
  const replaying = ready && pct < 100

  return (
    <div className="flex h-[60px] flex-shrink-0 items-center gap-3 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4">
      <button
        type="button"
        onClick={onToggle}
        disabled={!ready}
        aria-label={playing ? 'Pause the replay' : 'Play the day back'}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#0A3D8F] text-white disabled:opacity-40"
      >
        {playing ? <Pause size={19} /> : <Play size={19} className="ml-0.5" />}
      </button>

      <div className="flex flex-shrink-0 flex-col">
        <span className="font-heading text-[12.5px] font-bold text-[var(--text-primary)]">Trail Replay</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onDate(e.target.value)}
          disabled={!hasSelection}
          aria-label="Day to replay"
          className="bg-transparent text-[11px] text-[var(--text-muted)] disabled:opacity-50"
        />
      </div>

      {hasSelection ? (
        <div className="relative mx-2 h-2 flex-1 rounded bg-[var(--bg-surface-raised)]">
          <div className="absolute inset-y-0 left-0 rounded bg-[var(--accent-teal)]" style={{ width: `${ready ? pct : 0}%` }} />
          {ready &&
            marks.map((m, i) => (
              <span
                key={i}
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-[var(--accent-green)]"
                style={{ left: `${m}%` }}
              />
            ))}
          {ready && (
            <span
              className="pointer-events-none absolute top-1/2 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#0A3D8F] bg-white shadow"
              style={{ left: `${pct}%` }}
            />
          )}
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={ready ? pct : 0}
            disabled={!ready}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Replay position"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
          />
        </div>
      ) : (
        <p className="flex-1 text-xs text-[var(--text-muted)]">Pick a salesman to replay his day.</p>
      )}

      <div className="w-[118px] flex-shrink-0 text-right font-mono text-[11.5px] text-[var(--text-secondary)]">
        {!ready
          ? hasSelection
            ? 'No trail yet'
            : '—'
          : replaying
            ? <span className="font-bold text-[var(--text-primary)]">{formatClock(timeAt(window, pct))}</span>
            : `${formatClock(window.start)} → ${formatClock(window.end)}`}
      </div>

      <select
        value={speed}
        onChange={(e) => onSpeed(Number(e.target.value))}
        disabled={!ready}
        aria-label="Replay speed"
        className="h-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] disabled:opacity-40"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>
    </div>
  )
}
