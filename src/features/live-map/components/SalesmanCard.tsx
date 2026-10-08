import { BatteryMedium, Navigation, X } from 'lucide-react'
import { STATUS_COLORS, avatarColor, describeWhere, formatMoney, initials } from '../live-map-logic'
import type { FieldMember, Trail } from '../types'

interface Props {
  member: FieldMember
  serverTime: string
  trail: Trail | undefined
  onClose: () => void
}

/**
 * The picked salesman, over the map: how his day is going and where he is.
 *
 * The design's "route progress, 8 of 12 stops" and "next stop, ETA" need a
 * planned route for the day, and Salesly has none yet — so the card shows what
 * is actually known instead: the calls he has made and the distance he drove.
 */
export function SalesmanCard({ member, serverTime, trail, onClose }: Props) {
  const status = STATUS_COLORS[member.status]

  return (
    <div className="lm-overlay absolute right-4 top-4 w-[290px] overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)]">
      <div className="flex items-center gap-2.5 bg-[#0A3D8F] px-4 py-3 text-white">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 font-heading text-xs font-bold"
          style={{ background: avatarColor(member.id), borderColor: status.ring }}
        >
          {initials(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-sm font-bold">{member.name}</div>
          <div className="text-[11.5px] capitalize opacity-85">{member.status}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to the whole team"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2.5 p-4">
        <div className="flex justify-between text-xs text-[var(--text-secondary)]">
          <span>Calls today</span>
          <span className="font-bold text-[var(--text-primary)]">
            {member.today.visits}
            {trail ? ` · ${trail.distance_km.toFixed(1)} km driven` : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Figure label="Today's Sales" value={formatMoney(member.today.sales)} />
          <Figure label="Collected" value={formatMoney(member.today.collected)} />
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface-raised)] px-3 py-2">
          <Navigation size={15} className="flex-shrink-0 text-[var(--accent-blue)]" />
          <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-primary)]">{describeWhere(member, serverTime)}</span>
          {member.position?.battery != null && (
            <span className="flex items-center gap-0.5 text-[11px] text-[var(--text-muted)]" title="Phone battery">
              <BatteryMedium size={14} />
              {member.position.battery}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[9px] bg-[var(--bg-surface-raised)] p-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="font-mono text-[15px] font-bold text-[var(--text-primary)]">{value}</div>
    </div>
  )
}
