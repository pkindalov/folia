import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tokenStorage } from '../../lib/api-client';
import * as notificationsApi from './api';

const UNREAD_COUNT_POLL_INTERVAL_MS = 30_000;

export function useUnreadNotificationCount() {
  const token = tokenStorage.get();
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.getUnreadNotificationCount,
    enabled: token !== null && token !== '',
    refetchInterval: UNREAD_COUNT_POLL_INTERVAL_MS,
  });
}

// Only fetched while the notification panel is open (via `enabled`) — no
// point polling a list the user isn't looking at.
export function useNotifications(page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'list', { page }],
    queryFn: () => notificationsApi.listNotifications(page),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkNotificationUnread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markNotificationUnread,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.dismissNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsUnread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllNotificationsUnread,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.deleteAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
