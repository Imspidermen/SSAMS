import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as notificationService from '@/services/notification.service';
import { queryKeys } from '@/services/queryKeys';
import { NOTIFICATION_POLL_MS } from '@/utils/constants';

/** Polls the notification feed while the tab is visible. */
export function useNotifications(enabled = true, pollMs = NOTIFICATION_POLL_MS) {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: notificationService.listNotifications,
    enabled,
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
