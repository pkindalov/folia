import { api } from '../../lib/api-client';
import {
  notificationsResponseSchema,
  notificationResponseSchema,
  unreadCountResponseSchema,
  bulkUpdateResponseSchema,
  bulkDeleteResponseSchema,
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

export async function markNotificationUnread(id: string): Promise<AppNotification> {
  const data = await api(`/api/notifications/${id}/unread`, { method: 'PUT' });
  return notificationResponseSchema.parse(data).notification;
}

export async function dismissNotification(id: string): Promise<void> {
  await api(`/api/notifications/${id}`, { method: 'DELETE' });
}

export async function markAllNotificationsRead(): Promise<number> {
  const data = await api('/api/notifications/read-all', { method: 'PUT' });
  return bulkUpdateResponseSchema.parse(data).count;
}

export async function markAllNotificationsUnread(): Promise<number> {
  const data = await api('/api/notifications/unread-all', { method: 'PUT' });
  return bulkUpdateResponseSchema.parse(data).count;
}

export async function deleteAllNotifications(): Promise<number> {
  const data = await api('/api/notifications', { method: 'DELETE' });
  return bulkDeleteResponseSchema.parse(data).count;
}
