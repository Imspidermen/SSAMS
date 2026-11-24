/** In-app notifications (`/api/notifications`, any authenticated role). */
import type { NotificationList } from '@/types';
import { api } from './api';

export function listNotifications(): Promise<NotificationList> {
  return api.get<NotificationList>('/notifications');
}

export function markNotificationRead(id: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`/notifications/${id}/read`);
}

export function markAllNotificationsRead(): Promise<{ message: string }> {
  return api.post<{ message: string }>('/notifications/read-all');
}
