import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { FieldMember, FieldTeam, Trail } from '../types'

// Backend envelope: { status, message, data }
interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface TeamData {
  data: FieldMember[]
  summary: FieldTeam['summary']
  server_time: string
}

/** The whole field team as it stands. Polled. */
export async function fetchTeam(): Promise<FieldTeam> {
  const { data } = await apiClient.get<Envelope<TeamData>>(ENDPOINTS.LIVE_MAP)
  const body = data?.data

  return {
    members: Array.isArray(body?.data) ? body.data : [],
    summary: body?.summary ?? { active: 0, idle: 0, offline: 0, total: 0 },
    serverTime: body?.server_time ?? new Date().toISOString(),
  }
}

/** One salesman's day: the path he drove and the calls along it. */
export async function fetchTrail(userId: number, date?: string): Promise<Trail> {
  const { data } = await apiClient.get<Envelope<{ data: Trail }>>(ENDPOINTS.LIVE_MAP_TRAIL(userId), {
    params: date ? { date } : {},
  })

  return data.data.data
}
