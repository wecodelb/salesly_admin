import { apiClient } from '@/core/api/client'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  route: string | null
  is_read: boolean
  created_at: string | null
}

export interface NotificationsPage {
  items: AppNotification[]
  unread: number
}

export async function fetchNotifications(): Promise<NotificationsPage> {
  const res = await apiClient.get('/notifications')
  const data = res.data?.data ?? {}
  return { items: data.data ?? [], unread: data.unread_count ?? 0 }
}

export async function markRead(id: string): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`)
}

export async function markAllRead(): Promise<void> {
  await apiClient.post('/notifications/read-all')
}
