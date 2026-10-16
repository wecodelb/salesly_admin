import { useContext, useState } from 'react'
import { QueryClientContext } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

/**
 * Re-reads everything the screen is showing.
 *
 * The lists poll on their own, but a manager who has just been told on the
 * phone that an order went in should not have to wait for the next poll or
 * reload the whole console to see it. Every query mounted on the page is
 * fetched again; nothing else is touched. Renders nothing outside a query
 * client, so a header drawn on its own in a test has no button to explain.
 */
export function ReloadButton() {
  const client = useContext(QueryClientContext)
  const [busy, setBusy] = useState(false)
  if (!client) return null

  const reload = async () => {
    setBusy(true)
    try {
      await client.refetchQueries({ type: 'active' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={reload}
      disabled={busy}
      title="Reload what this screen shows"
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[var(--radius-btn)] border border-[var(--border-default)] px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-60"
    >
      <RefreshCw size={14} className={busy ? 'animate-spin' : ''} aria-hidden />
      Reload
    </button>
  )
}
