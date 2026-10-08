/**
 * Whether he is working, decided on the server so this screen and the phone
 * never disagree about it:
 *
 *  - active: reporting, and either moving or inside a customer's shop;
 *  - idle: reporting, outside any visit, and gone nowhere for a while;
 *  - offline: no fix for ten minutes, or none ever.
 */
export type FieldStatus = 'active' | 'idle' | 'offline'

/** What he is doing within that status. */
export type FieldActivity = 'moving' | 'at_customer' | 'idle' | 'offline'

export interface FieldPosition {
  latitude: number
  longitude: number
  /** Metres. */
  accuracy: number | null
  /** Metres per second. */
  speed: number | null
  heading: number | null
  /** Percent. */
  battery: number | null
  /** ISO 8601, the phone's clock. */
  recorded_at: string
}

/** One salesman as the field team list and the map show him. */
export interface FieldMember {
  id: number
  name: string
  status: FieldStatus
  activity: FieldActivity
  /** Last known fix. Kept when offline, for "last seen here"; null if never. */
  position: FieldPosition | null
  /** When he last went somewhere. Idle for server_time − this. */
  moved_at: string | null
  /** The shop he is standing in, while he is in one. */
  visit: {
    id: number
    customer_id: number
    customer_name: string | null
    checked_in_at: string
  } | null
  today: {
    sales: number
    invoices: number
    visits: number
    collected: number
  }
}

export interface FieldTeam {
  members: FieldMember[]
  summary: { active: number; idle: number; offline: number; total: number }
  /** The server's clock. Every "x ago" is measured against this, not ours. */
  serverTime: string
}

export interface TrailPoint {
  latitude: number
  longitude: number
  speed: number | null
  recorded_at: string
}

/** A call on a customer along the way, numbered in the order he made them. */
export interface TrailStop {
  number: number
  id: number
  customer_id: number
  customer_name: string | null
  /** Where he checked in. Null when the phone had no fix inside the shop. */
  latitude: number | null
  longitude: number | null
  checked_in_at: string
  checked_out_at: string | null
  duration_minutes: number | null
  is_open: boolean
}

export interface Trail {
  salesman: { id: number; name: string }
  /** YYYY-MM-DD. */
  date: string
  started_at: string | null
  ended_at: string | null
  distance_km: number
  points: TrailPoint[]
  stops: TrailStop[]
}

/** The chips over the list. Offline is left out on purpose, as in the design: nobody filters to who is not working. */
export type TeamFilter = 'all' | 'active' | 'idle'
