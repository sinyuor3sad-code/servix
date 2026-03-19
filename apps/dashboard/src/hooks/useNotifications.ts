'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { notificationsService } from '@/services/notifications.service';
import type { Notification } from '@/services/notifications.service';

interface UseNotificationsOptions {
  page?: number;
  type?: string;
  isRead?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['notifications', options],
    queryFn: () => notificationsService.getAll(accessToken!, options),
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(accessToken!, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previousData = queryClient.getQueriesData({ queryKey: ['notifications'] });

      queryClient.setQueriesData<{ data: Notification[]; meta: Record<string, number> }>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((n) =>
              n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(accessToken!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previousData = queryClient.getQueriesData({ queryKey: ['notifications'] });

      queryClient.setQueriesData<{ data: Notification[]; meta: Record<string, number> }>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;
          const now = new Date().toISOString();
          return {
            ...old,
            data: old.data.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? now })),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });

  const markAsRead = useCallback(
    (id: string) => markAsReadMutation.mutate(id),
    [markAsReadMutation],
  );

  const markAllAsRead = useCallback(
    () => markAllAsReadMutation.mutate(),
    [markAllAsReadMutation],
  );

  const notifications = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, perPage: 10, total: 0, totalPages: 1 };
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    meta,
    unreadCount,
    isLoading,
    isFetching,
    markAsRead,
    markAllAsRead,
  };
}

export function useUnreadCount() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const { data } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => notificationsService.getAll(accessToken!, { isRead: false }),
    enabled: !!accessToken,
    refetchInterval: 30_000,
    select: (response) => response.meta.total,
  });

  return data ?? 0;
}
