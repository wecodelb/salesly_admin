import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useActionProgressStore } from '@/shared/hooks/use-action-progress'

/** How long the checkmark stays up before the dialog bows out. */
const SUCCESS_HOLD_MS = 1000
/** Must outlast the exit transition below. */
const EXIT_MS = 180

/**
 * The centre-screen dialog that covers a single write: "Verifying customer…"
 * with a spinner, then a checkmark, then it leaves on its own.
 *
 * Toasts report after the fact, from the corner — fine for background news,
 * but a verify/create/delete is a deliberate act whose outcome the user is
 * waiting on, and the wait is exactly when the app looks broken if nothing
 * acknowledges the click. This blocks the surface for the duration so a second
 * click can't fire the same mutation twice, and holds on failure (the only
 * state worth reading slowly) until dismissed.
 *
 * Driven entirely by `useActionProgress().run()`; mounted once in AppShell.
 */
export function ActionProgressDialog() {
  const action = useActionProgressStore((s) => s.action)
  const dismiss = useActionProgressStore((s) => s.dismiss)

  // Keeps the last action on screen through its exit transition, after the
  // store has already dropped it.
  const [visible, setVisible] = useState(false)
  const lastAction = useRef(action)
  if (action) lastAction.current = action
  const shown = lastAction.current

  useEffect(() => {
    if (!action) {
      setVisible(false)
      return
    }
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [action])

  // Success is self-dismissing: the point is confirmation, not a click target.
  // Failure stays put — it carries the reason.
  useEffect(() => {
    if (action?.status !== 'success') return
    const timer = setTimeout(dismiss, SUCCESS_HOLD_MS)
    return () => clearTimeout(timer)
  }, [action?.status, action?.id, dismiss])

  useEffect(() => {
    if (action?.status !== 'error') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [action?.status, dismiss])

  // Nothing to draw before the first action, or once the exit has finished.
  const [lingering, setLingering] = useState(false)
  useEffect(() => {
    if (action) {
      setLingering(true)
      return
    }
    const timer = setTimeout(() => setLingering(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [action])

  if (!shown || (!action && !lingering)) return null

  const { label, detail, status, message } = shown
  const working = status === 'working'
  const failed = status === 'error'

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-busy={working}
      aria-label={label}
      className={[
        'fixed inset-0 z-[110] flex items-center justify-center p-4',
        'transition-opacity duration-150 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        // Only a settled dialog can be dismissed by clicking away; clicking
        // through a write in flight would suggest it had been cancelled.
        onClick={working ? undefined : dismiss}
      />

      <div
        className={[
          'relative w-[320px] px-6 py-7 text-center',
          'bg-[var(--bg-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-modal)]',
          'border border-[var(--border-default)]',
          'transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'motion-reduce:transition-none',
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2',
        ].join(' ')}
      >
        <div className="relative w-16 h-16 mx-auto mb-4">
          {working && (
            <>
              {/* Halo, track, and the arc that actually spins. */}
              <span className="absolute inset-0 rounded-full bg-[var(--accent-primary)]/10 animate-ping motion-reduce:animate-none" />
              <span className="absolute inset-0 rounded-full border-2 border-[var(--border-default)]" />
              <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent-primary)] border-r-[var(--accent-primary)] animate-spin motion-reduce:animate-none" />
            </>
          )}

          {!working && (
            <div
              className={[
                'salesly-pop absolute inset-0 rounded-full flex items-center justify-center',
                failed ? 'bg-[var(--accent-red)]/12' : 'bg-[var(--accent-green)]/12',
              ].join(' ')}
            >
              {failed ? (
                <X size={28} className="text-[var(--accent-red)]" strokeWidth={2.5} />
              ) : (
                <Check size={28} className="text-[var(--accent-green)]" strokeWidth={2.5} />
              )}
            </div>
          )}
        </div>

        <p className="text-base font-semibold font-heading text-[var(--text-primary)]">
          {working ? `${label}…` : failed ? `${label} failed` : (message ?? 'Done')}
        </p>

        {detail && (
          <p className="mt-1 text-sm text-[var(--text-secondary)] truncate" title={detail}>
            {detail}
          </p>
        )}

        {failed && message && (
          <p className="mt-2 text-sm text-[var(--accent-red)]">{message}</p>
        )}

        {/* Indeterminate while working — the request has no progress to report —
            then a filled bar so the transition to done reads as completion. */}
        <div className="mt-5 h-1 rounded-full bg-[var(--bg-surface-raised)] overflow-hidden">
          {working ? (
            <div className="salesly-sweep h-full w-1/3 rounded-full bg-[var(--accent-primary)]" />
          ) : (
            <div
              className={[
                'h-full w-full rounded-full origin-left',
                'transition-transform duration-300 motion-reduce:transition-none',
                failed ? 'bg-[var(--accent-red)]' : 'bg-[var(--accent-green)]',
                visible ? 'scale-x-100' : 'scale-x-0',
              ].join(' ')}
            />
          )}
        </div>

        {failed && (
          <button
            type="button"
            onClick={dismiss}
            className="mt-5 w-full h-9 text-sm font-medium rounded-[var(--radius-btn)] bg-[var(--bg-surface-raised)] text-[var(--text-primary)] hover:bg-[var(--border-default)] transition-colors cursor-pointer"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
