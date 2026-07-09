import { api } from '../../lib/api-client';
import {
  notificationsResponseSchema,
  notificationResponseSchema,
  unreadCountResponseSchema,
  type PaginatedNotifications,
  type AppNotification,
} from './schemas';

export async function listNotifications(page: number): Promise<PaginatedNotifications> {
  const params = new URLSearchParams({ page: String(page) });
  const data = await api(`/api/notifications?${params}`);
  return notificationsResponseSchema.parse(data);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const data = await api('/api/notifications/unread-count');
  return unreadCountResponseSchema.parse(data).count;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const data = await api(`/api/notifications/${id}/read`, { method: 'PUT' });
  return notificationResponseSchema.parse(data).notification;
}

export async function dismissNotification(id: string): Promise<void> {
  await api(`/api/notifications/${id}`, { method: 'DELETE' });
}
