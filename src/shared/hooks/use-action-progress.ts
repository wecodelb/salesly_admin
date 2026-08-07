import { useCallback } from 'react'
import { create } from 'zustand'
import { apiErrorMessage } from '@/core/api/api-error'

export type ActionStatus = 'working' | 'success' | 'error'

export interface ActionProgress {
  id: string
  /** What is happening, in progressive form: "Verifying customer". */
  label: string
  /** What it is happening to: "Al Watan Grocery". */
  detail?: string
  status: ActionStatus
  /** Outcome line, shown once the action settles. */
  message?: string
}

interface ActionProgressStore {
  action: ActionProgress | null
  start: (label: string, detail?: string) => string
  succeed: (id: string, message?: string) => void
  fail: (id: string, message: string) => void
  dismiss: () => void
}

export const useActionProgressStore = create<ActionProgressStore>((set) => ({
  action: null,
  start: (label, detail) => {
    const id = Math.random().toString(36).slice(2)
    set({ action: { id, label, detail, status: 'working' } })
    return id
  },
  // Settling is keyed by id so a slow request that resolves after the user has
  // moved on can't reopen the dialog over whatever is running now.
  succeed: (id, message) =>
    set((s) => (s.action?.id === id ? { action: { ...s.action, status: 'success', message } } : s)),
  fail: (id, message) =>
    set((s) => (s.action?.id === id ? { action: { ...s.action, status: 'error', message } } : s)),
  dismiss: () => set({ action: null }),
}))

interface RunOptions {
  /** Progressive form — the dialog appends the ellipsis: "Creating product". */
  label: string
  detail?: string
  /** Line shown with the checkmark. Defaults to a plain "Done". */
  success?: string
  /** Overrides the message derived from the server's error response. */
  error?: string
}

/**
 * Runs a mutation behind the centre-screen progress dialog: spinner while it
 * is in flight, checkmark when it lands, the server's message when it doesn't.
 *
 * Resolves to the task's result, or `null` if it failed — so callers can close
 * a drawer on success without a second try/catch:
 *
 *     const saved = await run({ label: 'Saving customer' }, () => save.mutateAsync(form))
 *     if (saved) onClose()
 *
 * Errors are surfaced in the dialog and deliberately not re-thrown; the failed
 * mutation's own `onError` still fires for anything else that needs to react.
 */
export function useActionProgress() {
  const start = useActionProgressStore((s) => s.start)
  const succeed = useActionProgressStore((s) => s.succeed)
  const fail = useActionProgressStore((s) => s.fail)

  const run = useCallback(
    async <T>(options: RunOptions, task: () => Promise<T>): Promise<T | null> => {
      const id = start(options.label, options.detail)
      try {
        const result = await task()
        succeed(id, options.success)
        return result
      } catch (err) {
        fail(id, options.error ?? apiErrorMessage(err))
        return null
      }
    },
    [start, succeed, fail],
  )

  return { run }
}
