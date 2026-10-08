import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './live-map.css'
import { STATUS_COLORS, avatarColor, initials, type LatLng } from '../live-map-logic'
import type { FieldMember, TrailStop } from '../types'

/**
 * Free map tiles: OpenStreetMap's by default, no key and no bill. The URL is
 * configurable so a busier deployment can move to its own tile server, or to a
 * provider's free tier, without touching this file — OSM's public servers are
 * meant for light use, which a handful of managers watching their vans is.
 */
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Where the map opens before anybody has reported a position: Beirut. */
const FALLBACK_CENTER: LatLng = [33.8938, 35.5018]

export type TileStyle = 'streets' | 'muted'

interface Props {
  members: FieldMember[]
  selectedId: number | null
  onSelect: (id: number) => void
  /** Solid: driven by the replay's moment. Dashed: still ahead of it. */
  trailDone: LatLng[]
  trailAhead: LatLng[]
  stops: TrailStop[]
  /** Where the selected salesman was at the replay's moment, while replaying. */
  ghost: LatLng | null
  tileStyle: TileStyle
  /** Changes when the map should re-frame: the team, or one salesman's day. */
  fitKey: string
}

export function TeamMap({ members, selectedId, onSelect, trailDone, trailAhead, stops, ghost, tileStyle, fitKey }: Props) {
  const selected = members.find((m) => m.id === selectedId) ?? null

  // What the view is framed around: one salesman's day when one is picked,
  // otherwise everybody with a position.
  const framing = useMemo<LatLng[]>(() => {
    if (selected) {
      const trail = [...trailDone, ...trailAhead]
      if (trail.length > 0) return trail
      return selected.position ? [[selected.position.latitude, selected.position.longitude]] : []
    }
    return members.filter((m) => m.position).map((m) => [m.position!.latitude, m.position!.longitude] as LatLng)
  }, [selected, members, trailDone, trailAhead])

  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={12}
      zoomControl={false}
      className="lm-map h-full w-full"
    >
      <TileLayer
        url={TILE_URL}
        attribution={TILE_ATTRIBUTION}
        className={tileStyle === 'muted' ? 'lm-tiles lm-tiles--muted' : 'lm-tiles'}
      />
      <ZoomControl position="bottomright" />
      <FitView fitKey={fitKey} points={framing} />

      {trailDone.length > 1 && (
        <Polyline positions={trailDone} pathOptions={{ color: '#16A34A', weight: 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }} />
      )}
      {trailAhead.length > 1 && (
        <Polyline positions={trailAhead} pathOptions={{ color: '#1A5FA8', weight: 4, opacity: 0.8, dashArray: '7 7', lineCap: 'round' }} />
      )}

      {stops.map((stop) =>
        stop.latitude != null && stop.longitude != null ? (
          <Marker key={`stop-${stop.id}`} position={[stop.latitude, stop.longitude]} icon={stopIcon(stop)} zIndexOffset={-100}>
            <Tooltip direction="top" offset={[0, -10]}>
              {stop.number}. {stop.customer_name ?? 'Customer'}
              {stop.duration_minutes != null ? ` · ${stop.duration_minutes} min` : stop.is_open ? ' · in the shop now' : ''}
            </Tooltip>
          </Marker>
        ) : null,
      )}

      {members.map((m) =>
        m.position ? (
          <Marker
            key={m.id}
            position={[m.position.latitude, m.position.longitude]}
            icon={salesmanIcon(m, m.id === selectedId, false)}
            zIndexOffset={m.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(m.id) }}
            title={m.name}
          />
        ) : null,
      )}

      {ghost && selected && (
        <Marker position={ghost} icon={salesmanIcon(selected, true, true)} zIndexOffset={2000} interactive={false} />
      )}
    </MapContainer>
  )
}

/**
 * Re-frames the view when what it is about changes — picking a salesman, or
 * going back to the team — and otherwise leaves it alone. Re-framing on every
 * poll would yank the map out from under somebody who has just zoomed in.
 */
function FitView({ fitKey, points }: { fitKey: string; points: LatLng[] }) {
  const map = useMap()
  const framed = useRef<string | null>(null)

  useEffect(() => {
    if (points.length === 0 || framed.current === fitKey) return
    framed.current = fitKey

    if (points.length === 1) map.setView(points[0], 15)
    else map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 16 })
  }, [fitKey, points, map])

  return null
}

function salesmanIcon(member: FieldMember, selected: boolean, ghost: boolean): L.DivIcon {
  const ring = STATUS_COLORS[member.status].ring
  const classes = ['lm-pin', selected && 'lm-pin--selected', member.status === 'offline' && 'lm-pin--offline', ghost && 'lm-pin--ghost']
    .filter(Boolean)
    .join(' ')
  const pulse = member.status === 'active' && !ghost ? '<span class="lm-pin__pulse"></span>' : ''

  return L.divIcon({
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div class="${classes}" style="--pin-bg:${avatarColor(member.id)};--pin-ring:${ring}">${pulse}<div class="lm-pin__face">${escapeHtml(initials(member.name))}</div></div>`,
  })
}

/** Green once he has left the shop, blue while he is still in it. */
function stopIcon(stop: TrailStop): L.DivIcon {
  const bg = stop.is_open ? '#1A5FA8' : '#16A34A'

  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div class="lm-stop" style="--stop-bg:${bg}">${stop.number}</div>`,
  })
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
