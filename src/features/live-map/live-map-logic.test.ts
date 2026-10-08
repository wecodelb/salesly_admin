import { describe, expect, it } from 'vitest'
import {
  describeWhere,
  filterTeam,
  formatAgo,
  formatDuration,
  formatMoney,
  initials,
  positionAt,
  replayStep,
  secondsBetween,
  splitTrailAt,
  stopMarks,
  timeAt,
  trailWindow,
} from './live-map-logic'
import type { FieldMember, TrailPoint, TrailStop } from './types'

const NOW = '2026-10-08T12:00:00+00:00'

function member(over: Partial<FieldMember> = {}): FieldMember {
  return {
    id: 1,
    name: 'Ahmad Khalil',
    status: 'active',
    activity: 'moving',
    position: {
      latitude: 33.8966,
      longitude: 35.4823,
      accuracy: 10,
      speed: null,
      heading: null,
      battery: 80,
      recorded_at: '2026-10-08T11:59:30+00:00',
    },
    moved_at: '2026-10-08T11:59:30+00:00',
    visit: null,
    today: { sales: 0, invoices: 0, visits: 0, collected: 0 },
    ...over,
  }
}

const point = (lat: number, lng: number, at: string): TrailPoint => ({
  latitude: lat,
  longitude: lng,
  speed: null,
  recorded_at: at,
})

/** Three fixes, an hour apart, walking north-east in a straight line. */
const TRAIL = [
  point(33.0, 35.0, '2026-10-08T08:00:00+00:00'),
  point(33.2, 35.2, '2026-10-08T09:00:00+00:00'),
  point(33.4, 35.4, '2026-10-08T10:00:00+00:00'),
]

describe('how long ago', () => {
  it('counts on the server clock and never goes negative', () => {
    expect(secondsBetween('2026-10-08T11:59:48+00:00', NOW)).toBe(12)
    // A phone whose clock runs a little ahead must not read as "-5s ago".
    expect(secondsBetween('2026-10-08T12:00:05+00:00', NOW)).toBe(0)
  })

  it('says it in the largest unit that fits', () => {
    expect(formatAgo(12)).toBe('12s ago')
    expect(formatAgo(4 * 60 + 30)).toBe('4m ago')
    expect(formatAgo(2 * 3600 + 59 * 60)).toBe('2h ago')
    expect(formatAgo(3 * 86_400)).toBe('3d ago')
  })

  it('writes a duration the way the design does', () => {
    expect(formatDuration(48)).toBe('48m')
    expect(formatDuration(72)).toBe('1h12m')
    expect(formatDuration(125)).toBe('2h05m')
  })
})

describe('what he is doing, in words', () => {
  it('names the shop he is standing in', () => {
    const inShop = member({
      activity: 'at_customer',
      visit: { id: 4, customer_id: 9, customer_name: 'Al Watan Grocery', checked_in_at: NOW },
    })
    expect(describeWhere(inShop, NOW)).toBe('At Al Watan Grocery')
  })

  it('says how long he has been idle, from when he last went anywhere', () => {
    const parked = member({ status: 'idle', activity: 'idle', moved_at: '2026-10-08T10:48:00+00:00' })
    expect(describeWhere(parked, NOW)).toBe('Idle 1h12m')
  })

  it('gives his speed on the road, but not a walking pace', () => {
    expect(describeWhere(member({ position: { ...member().position!, speed: 8.9 } }), NOW)).toBe('En route · 32 km/h')
    expect(describeWhere(member({ position: { ...member().position!, speed: 0.5 } }), NOW)).toBe('En route')
  })

  it('says when an offline phone was last heard from, or that it never was', () => {
    const silent = member({
      status: 'offline',
      activity: 'offline',
      position: { ...member().position!, recorded_at: '2026-10-08T10:00:00+00:00' },
    })
    expect(describeWhere(silent, NOW)).toBe('Offline · last seen 2h ago')
    expect(describeWhere(member({ status: 'offline', activity: 'offline', position: null }), NOW)).toBe('No location yet')
  })
})

describe('the list', () => {
  it('filters by status, and shows everybody under All', () => {
    const team = [member({ id: 1 }), member({ id: 2, status: 'idle' }), member({ id: 3, status: 'offline' })]
    expect(filterTeam(team, 'all')).toHaveLength(3)
    expect(filterTeam(team, 'active').map((m) => m.id)).toEqual([1])
    expect(filterTeam(team, 'idle').map((m) => m.id)).toEqual([2])
  })

  it('initials a name, and copes with one word', () => {
    expect(initials('Ahmad Khalil')).toBe('AK')
    expect(initials('  sara  el haddad ')).toBe('SH')
    expect(initials('Omar')).toBe('O')
  })

  it('shows cents only when there are any', () => {
    expect(formatMoney(1240)).toBe('$1,240')
    expect(formatMoney(120.5)).toBe('$120.50')
  })
})

describe('the replay', () => {
  it('spans the first fix to the last, and needs two to span anything', () => {
    expect(trailWindow(TRAIL)).toEqual({
      start: Date.parse('2026-10-08T08:00:00+00:00'),
      end: Date.parse('2026-10-08T10:00:00+00:00'),
    })
    expect(trailWindow(TRAIL.slice(0, 1))).toBeNull()
  })

  it('finds the moment a share of the way through', () => {
    const window = trailWindow(TRAIL)!
    expect(timeAt(window, 50)).toBe(Date.parse('2026-10-08T09:00:00+00:00'))
    expect(timeAt(window, 150)).toBe(window.end)
  })

  it('puts him between the fixes either side, in proportion', () => {
    const halfPastEight = Date.parse('2026-10-08T08:30:00+00:00')
    const [lat, lng] = positionAt(TRAIL, halfPastEight)!
    expect(lat).toBeCloseTo(33.1)
    expect(lng).toBeCloseTo(35.1)
  })

  it('holds him at the ends before the first fix and after the last', () => {
    expect(positionAt(TRAIL, Date.parse('2026-10-08T07:00:00+00:00'))).toEqual([33.0, 35.0])
    expect(positionAt(TRAIL, Date.parse('2026-10-08T11:00:00+00:00'))).toEqual([33.4, 35.4])
    expect(positionAt([], 0)).toBeNull()
  })

  it('cuts the trail where he is, so the driven and the ahead meet', () => {
    const { done, ahead } = splitTrailAt(TRAIL, Date.parse('2026-10-08T09:30:00+00:00'))
    expect(done).toHaveLength(3) // two fixes driven, and the cut
    expect(ahead).toHaveLength(2) // the cut, and the one fix ahead
    expect(done[done.length - 1]).toEqual(ahead[0])
  })

  it('leaves nothing ahead at the end of the day', () => {
    const { done, ahead } = splitTrailAt(TRAIL, Date.parse('2026-10-08T10:00:00+00:00'))
    expect(done.length).toBeGreaterThan(0)
    expect(ahead).toEqual([])
  })

  it('marks each call along the bar where it happened, and drops one outside it', () => {
    const stop = (at: string): TrailStop => ({
      number: 1,
      id: 1,
      customer_id: 1,
      customer_name: 'Shop',
      latitude: null,
      longitude: null,
      checked_in_at: at,
      checked_out_at: null,
      duration_minutes: null,
      is_open: false,
    })
    const window = trailWindow(TRAIL)!
    expect(stopMarks([stop('2026-10-08T08:30:00+00:00'), stop('2026-10-08T07:00:00+00:00')], window)).toEqual([25])
  })

  it('plays the whole day in a minute at 1×, and twice as fast at 2×', () => {
    expect(replayStep(60_000, 1)).toBeCloseTo(100)
    expect(replayStep(15_000, 2)).toBeCloseTo(50)
  })
})
