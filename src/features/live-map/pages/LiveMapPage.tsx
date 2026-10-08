import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Layers, Lock, Map as MapIcon, SlidersHorizontal } from 'lucide-react'
import { useAuthStore } from '@/core/auth/auth-store'
import { MODULES } from '@/core/auth/modules'
import { useModules } from '@/core/auth/use-modules'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton/LoadingSkeleton'
import { ReplayBar } from '../components/ReplayBar'
import { SalesmanCard } from '../components/SalesmanCard'
import { TeamMap, type TileStyle } from '../components/TeamMap'
import { TeamPanel } from '../components/TeamPanel'
import { useFieldTeam, useTrail } from '../hooks/use-live-map'
import { useReplay } from '../hooks/use-replay'
import {
  filterTeam,
  formatAgo,
  isoDate,
  positionAt,
  splitTrailAt,
  stopMarks,
  timeAt,
  trailWindow,
  type LatLng,
} from '../live-map-logic'
import type { TeamFilter, TrailPoint } from '../types'

const NO_POINTS: TrailPoint[] = []

/**
 * The live map: where the field team is right now, and the trail each van
 * drove today, played back on demand.
 *
 * Laid out as the admin console design draws it — the team down the left, the
 * map filling the rest, the picked salesman's card over it, the replay along
 * the bottom. The map is OpenStreetMap through Leaflet: no key, no per-load
 * bill.
 */
export function LiveMapPage() {
  const { has } = useModules()
  const bought = has(MODULES.LIVE_MAP)
  const company = useAuthStore((s) => s.user?.company)

  const team = useFieldTeam(bought)

  const [filter, setFilter] = useState<TeamFilter>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tileStyle, setTileStyle] = useState<TileStyle>('streets')
  const [showTrail, setShowTrail] = useState(true)
  const [showStops, setShowStops] = useState(true)
  const [showOffline, setShowOffline] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const today = isoDate(new Date())
  const [date, setDate] = useState(today)
  const replay = useReplay()

  const trail = useTrail(selectedId, date, date === today)
  const now = useNow()

  // A new salesman, or a new day, starts from the day as it stands.
  const { reset } = replay
  useEffect(() => {
    reset()
  }, [selectedId, date, reset])

  const members = team.data?.members ?? []
  const serverTime = team.data?.serverTime ?? new Date().toISOString()
  const listed = filterTeam(members, filter)
  const onMap = showOffline ? listed : listed.filter((m) => m.status !== 'offline')
  const selected = members.find((m) => m.id === selectedId) ?? null

  // The trail, cut at the replay's moment. At 100% that is the whole day so
  // far, solid; while replaying, what was still ahead of him is dashed.
  const points = trail.data?.points ?? NO_POINTS
  const span = useMemo(() => trailWindow(points), [points])
  const cutAt = span ? timeAt(span, replay.pct) : null
  const { done, ahead } = useMemo(
    () => (cutAt != null && showTrail ? splitTrailAt(points, cutAt) : { done: [] as LatLng[], ahead: [] as LatLng[] }),
    [points, cutAt, showTrail],
  )
  const ghost = span && replay.pct < 100 && cutAt != null ? positionAt(points, cutAt) : null
  const stops = showStops && selected ? trail.data?.stops ?? [] : []
  const marks = span && trail.data ? stopMarks(trail.data.stops, span) : []

  // ── Not bought, not allowed, or broken ──────────────────────────────────
  const refusal = refusalOf(team.error)
  if (!bought || refusal === 'module') {
    return (
      <EmptyState
        icon={<Lock size={28} />}
        title="The live map isn't part of your plan"
        description="See where your field team is in real time and replay the trail each van drove. Ask your Salesly provider to switch it on for your company."
      />
    )
  }
  if (refusal === 'forbidden') {
    return (
      <EmptyState
        icon={<Lock size={28} />}
        title="You don't have access to the live map"
        description="An admin can give you the “Watch the field team on the live map” permission."
      />
    )
  }
  if (team.isError && !team.data) {
    return <ErrorState message="The field team could not be loaded." onRetry={() => team.refetch()} />
  }
  if (team.isLoading) return <LoadingSkeleton />

  const updatedAgo = formatAgo(Math.max(0, Math.round((now - team.dataUpdatedAt) / 1000)))
  const summary = team.data?.summary ?? { active: 0, idle: 0, offline: 0, total: 0 }
  const title = selected ? `${selected.name} · ${date === today ? 'Today' : date}` : `${company ?? 'Your team'} · All salesmen`

  return (
    // Full-bleed: cancels the shell's padding and fills the height under the
    // top bar, the way the design lays the map out.
    <div className="-m-6 flex h-[calc(100vh-4rem)] min-h-[520px]">
      <TeamPanel
        members={listed}
        serverTime={serverTime}
        filter={filter}
        onFilter={setFilter}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
        updatedAgo={updatedAgo}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4">
          <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{title}</span>
          <div className="flex-1" />
          <span className="flex items-center gap-1.5 rounded-full bg-[rgba(45,212,191,.12)] px-2.5 py-1 text-[11.5px] font-semibold text-[#0E9F6E]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-teal)]" />
            Live · updated {updatedAgo}
          </span>

          <div className="relative">
            <ToolbarButton icon={<SlidersHorizontal size={15} />} label="Filters" onClick={() => setFiltersOpen((o) => !o)} pressed={filtersOpen} />
            {filtersOpen && (
              <FiltersPopover onClose={() => setFiltersOpen(false)}>
                <Check label="Show the trail" checked={showTrail} onChange={setShowTrail} />
                <Check label="Show calls along it" checked={showStops} onChange={setShowStops} />
                <Check label="Show offline salesmen" checked={showOffline} onChange={setShowOffline} />
              </FiltersPopover>
            )}
          </div>
          <ToolbarButton
            icon={<Layers size={15} />}
            label={tileStyle === 'streets' ? 'Style: Streets' : 'Style: Muted'}
            onClick={() => setTileStyle((s) => (s === 'streets' ? 'muted' : 'streets'))}
          />
        </div>

        <div className="relative min-h-0 flex-1">
          {members.length === 0 ? (
            <EmptyState
              icon={<MapIcon size={28} />}
              title="No salesmen yet"
              description="Salesmen appear here once they are added to the company and their phone reports a position."
            />
          ) : (
            <TeamMap
              members={onMap}
              selectedId={selectedId}
              onSelect={setSelectedId}
              trailDone={selected ? done : []}
              trailAhead={selected ? ahead : []}
              stops={stops}
              ghost={ghost}
              tileStyle={tileStyle}
              fitKey={selected ? `trail-${selected.id}-${date}-${points.length > 0}` : 'team'}
            />
          )}

          {selected && (
            <SalesmanCard member={selected} serverTime={serverTime} trail={trail.data} onClose={() => setSelectedId(null)} />
          )}

          <div className="lm-overlay absolute bottom-4 left-4 flex gap-3 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-1.5 shadow-[var(--shadow-card)]">
            <span className="text-xs font-semibold text-[var(--accent-teal)]">● {summary.active} active</span>
            <span className="text-xs font-semibold text-[var(--accent-amber)]">● {summary.idle} idle</span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">● {summary.offline} offline</span>
          </div>
        </div>

        <ReplayBar
          window={selected ? span : null}
          pct={replay.pct}
          playing={replay.playing}
          speed={replay.speed}
          marks={marks}
          date={date}
          today={today}
          hasSelection={selected != null}
          onToggle={replay.toggle}
          onSeek={replay.seek}
          onSpeed={replay.setSpeed}
          onDate={setDate}
        />
      </div>
    </div>
  )
}

/** Why the server said no, if it did: the company has not bought it, or this person may not. */
function refusalOf(error: unknown): 'module' | 'forbidden' | null {
  const response = (error as { response?: { status?: number; data?: { data?: { module?: string } } } } | null)?.response
  if (response?.status !== 403) return null
  return response.data?.data?.module ? 'module' : 'forbidden'
}

/** The clock, ticking each second, so "updated 12s ago" counts up between polls. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function ToolbarButton({ icon, label, onClick, pressed }: { icon: ReactNode; label: string; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]"
    >
      {icon}
      {label}
    </button>
  )
}

function FiltersPopover({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  // Closes on a click anywhere else, the way a dropdown should.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const id = setTimeout(() => document.addEventListener('mousedown', onDown))
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="lm-overlay absolute right-0 top-10 w-56 space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-modal)]"
    >
      {children}
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--text-primary)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#0A3D8F]" />
      {label}
    </label>
  )
}
