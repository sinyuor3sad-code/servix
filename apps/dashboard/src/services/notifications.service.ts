import { api } from '@/lib/api';

interface Notification {
  id: string;
  recipientType: string;
  recipientId: string;
  titleAr: string;
  bodyAr: string;
  type: 'booking_new' | 'booking_confirmed' | 'booking_cancelled' | 'payment' | 'reminder' | 'general';
  channel: string;
  isRead: boolean;
  data: Record<string, unknown> | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  bookingNotifications: boolean;
  paymentNotifications: boolean;
  reminderNotifications: boolean;
}

export const notificationsService = {
  getAll: (token: string, params?: { page?: number; type?: string; isRead?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.type) searchParams.set('type', params.type);
    if (params?.isRead !== undefined) searchParams.set('isRead', String(params.isRead));
    const qs = searchParams.toString();
    return api.get<NotificationsResponse>(`/notifications${qs ? `?${qs}` : ''}`, token);
  },

  markAsRead: (token: string, id: string) =>
    api.put<void>(`/notifications/${id}/read`, {}, token),

  markAllAsRead: (token: string) =>
    api.put<void>(`/notifications/read-all`, {}, token),

  getSettings: (token: string) =>
    api.get<NotificationSettings>(`/notifications/settings`, token),

  updateSettings: (token: string, data: Partial<NotificationSettings>) =>
    api.put<NotificationSettings>(`/notifications/settings`, data, token),
};

export type { Notification, NotificationsResponse, NotificationSettings };
