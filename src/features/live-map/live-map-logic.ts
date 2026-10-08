import type { FieldMember, TeamFilter, TrailPoint, TrailStop } from './types'

/**
 * The arithmetic behind the live map, kept out of the components so it can be
 * tested without a map: how long ago, what he is doing in words, and where he
 * was at a given moment of the replay.
 */

export type LatLng = [number, number]

/** Seconds from one ISO time to another; never negative. */
export function secondsBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(toIso) - Date.parse(fromIso)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0
}

/** "12s ago", "4m ago", "2h ago", "3d ago". */
export function formatAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86_400)}d ago`
}

/** "48m", "1h12m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes))
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

/** "AK" for Ahmad Khalil; one letter for a single name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

/**
 * A colour per salesman that stays his across reloads, so a manager learns to
 * find "the purple one" on the map without reading names.
 */
const AVATAR_COLORS = ['#0A3D8F', '#7C3AED', '#0891B2', '#BE185D', '#B45309', '#475569', '#0E9F6E', '#9333EA']
export function avatarColor(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length]
}

/** What the status pill and the pin ring are coloured. */
export const STATUS_COLORS = {
  active: { fg: '#0E9F6E', bg: 'rgba(45,212,191,.14)', ring: '#2DD4BF' },
  idle: { fg: '#D97706', bg: 'rgba(217,118,6,.14)', ring: '#D97706' },
  offline: { fg: '#697586', bg: 'rgba(105,117,134,.14)', ring: '#9CA3AF' },
} as const

/**
 * Where he is and what he is doing, in one line:
 * "At Al Watan Grocery", "Idle 1h12m", "En route · 32 km/h",
 * "Offline · last seen 2h ago".
 */
export function describeWhere(member: FieldMember, serverTime: string): string {
  switch (member.activity) {
    case 'at_customer':
      return member.visit?.customer_name ? `At ${member.visit.customer_name}` : 'At a customer'
    case 'idle':
      return member.moved_at ? `Idle ${formatDuration(secondsBetween(member.moved_at, serverTime) / 60)}` : 'Idle'
    case 'moving': {
      const kmh = member.position?.speed != null ? Math.round(member.position.speed * 3.6) : null
      return kmh != null && kmh >= 3 ? `En route · ${kmh} km/h` : 'En route'
    }
    default:
      return member.position
        ? `Offline · last seen ${formatAgo(secondsBetween(member.position.recorded_at, serverTime))}`
        : 'No location yet'
  }
}

export function filterTeam(members: FieldMember[], filter: TeamFilter): FieldMember[] {
  return filter === 'all' ? members : members.filter((m) => m.status === filter)
}

/** "$1,240", "$120.50": cents only when there are any. */
export function formatMoney(amount: number): string {
  const whole = Math.round(amount * 100) % 100 === 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** "08:14", in the browser's own time. */
export function formatClock(at: string | number): string {
  const date = new Date(typeof at === 'number' ? at : Date.parse(at))
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Today in the browser's calendar, as the trail endpoint wants it. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ── Replay ───────────────────────────────────────────────────────────────

export interface TrailWindow {
  start: number
  end: number
}

/** First and last fix of the trail, in milliseconds; null with fewer than two. */
export function trailWindow(points: TrailPoint[]): TrailWindow | null {
  if (points.length < 2) return null
  const start = Date.parse(points[0].recorded_at)
  const end = Date.parse(points[points.length - 1].recorded_at)
  return end > start ? { start, end } : null
}

/** The moment `pct` (0–100) of the way through the window. */
export function timeAt(window: TrailWindow, pct: number): number {
  const clamped = Math.min(100, Math.max(0, pct))
  return window.start + ((window.end - window.start) * clamped) / 100
}

/**
 * Where he was at `t`, drawn as a straight line between the fixes either side.
 * Before the first fix he is at the first; after the last, at the last.
 */
export function positionAt(points: TrailPoint[], t: number): LatLng | null {
  if (points.length === 0) return null

  const first = points[0]
  if (t <= Date.parse(first.recorded_at)) return [first.latitude, first.longitude]

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const ta = Date.parse(a.recorded_at)
    const tb = Date.parse(b.recorded_at)
    if (t <= tb) {
      const f = tb > ta ? (t - ta) / (tb - ta) : 1
      return [a.latitude + (b.latitude - a.latitude) * f, a.longitude + (b.longitude - a.longitude) * f]
    }
  }

  const last = points[points.length - 1]
  return [last.latitude, last.longitude]
}

/**
 * The trail cut at `t`: what he had driven by then (drawn solid), and what was
 * still ahead of him (drawn dashed). The cut point belongs to both, so the two
 * lines meet rather than leaving a gap.
 */
export function splitTrailAt(points: TrailPoint[], t: number): { done: LatLng[]; ahead: LatLng[] } {
  const cut = positionAt(points, t)
  if (!cut) return { done: [], ahead: [] }

  const done: LatLng[] = []
  const ahead: LatLng[] = []
  for (const p of points) {
    const at = Date.parse(p.recorded_at)
    if (at <= t) done.push([p.latitude, p.longitude])
    else ahead.push([p.latitude, p.longitude])
  }

  done.push(cut)
  if (ahead.length > 0) ahead.unshift(cut)
  return { done, ahead }
}

/** Where each call sits along the replay bar, as a percentage. */
export function stopMarks(stops: TrailStop[], window: TrailWindow): number[] {
  const span = window.end - window.start
  return stops
    .map((s) => ((Date.parse(s.checked_in_at) - window.start) / span) * 100)
    .filter((pct) => pct >= 0 && pct <= 100)
}

/** The whole day plays in this long at 1×; 2× and 4× are twice and four times as fast. */
export const REPLAY_SECONDS_AT_1X = 60

/** How far the replay moves in `elapsedMs` at `speed`. */
export function replayStep(elapsedMs: number, speed: number): number {
  return (elapsedMs / (REPLAY_SECONDS_AT_1X * 1000)) * 100 * speed
}
