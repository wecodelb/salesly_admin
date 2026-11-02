import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchNotifications, markAllRead, markRead } from './notifications-api'

/** How often the bell asks; the website has no push of its own. */
const POLL_MS = 60_000

/** The bell in the top bar: what is new, and a way to clear it. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const client = useQueryClient()
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: POLL_MS,
  })
  const refresh = () => client.invalidateQueries({ queryKey: ['notifications'] })
  const readOne = useMutation({ mutationFn: markRead, onSuccess: refresh })
  const readAll = useMutation({ mutationFn: markAllRead, onSuccess: refresh })

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const unread = data?.unread ?? 0
  const items = data?.items ?? []

  return (
    <div className="relative" ref={box}>
      <button
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            data-testid="bell-count"
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--accent-red)] text-white text-[10px] leading-4 text-center"
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button className="text-xs text-[var(--accent-blue)]" onClick={() => readAll.mutate()}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 && <p className="p-4 text-sm text-[var(--text-muted)]">Nothing new.</p>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && readOne.mutate(n.id)}
              className={`block w-full text-left px-3 py-2 border-b border-[var(--border)] ${n.is_read ? 'opacity-60' : ''}`}
            >
              <span className="block text-sm font-medium">{n.title}</span>
              <span className="block text-xs text-[var(--text-muted)]">{n.body}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
