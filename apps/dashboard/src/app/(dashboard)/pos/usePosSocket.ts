'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { playBeep } from './pos-sounds';

export interface PosNotification {
  id: string;
  type: 'order' | 'appointment' | 'attendance' | 'alert';
  title: string;
  body: string;
  time: string;
}

export function usePosSocket() {
  const { accessToken, currentTenant } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [notifications, setNotifications] = useState<PosNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!accessToken || !currentTenant?.id) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.servi-x.com';
    // Strip /api/v1 to get base URL for WebSocket
    const wsUrl = apiUrl.replace(/\/api(\/v\d+)?$/, '');

    // V-01: hand the JWT to the WS handshake. The server pins tenantId
    // and userId from the verified token — query params are no longer
    // trusted on the server side.
    const socket = io(`${wsUrl}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    const addNotif = (notif: PosNotification) => {
      setNotifications(prev => [notif, ...prev].slice(0, 20));
      setUnreadCount(prev => prev + 1);
    };

    // ── طلب ذاتي جديد ──
    socket.on('order:new', (data: Record<string, unknown>) => {
      playBeep();
      const notif: PosNotification = {
        id: Date.now().toString(),
        type: 'order',
        title: '🛎️ طلب ذاتي جديد',
        body: `${(data.clientName as string) || 'عميلة'} — ${(data.itemCount as number) || '?'} خدمات`,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      addNotif(notif);
      toast.info(notif.title, { description: notif.body });
    });

    // ── حضور موظفة ──
    socket.on('attendance:updated', (data: Record<string, unknown>) => {
      const emp = data.employee as { fullName?: string } | undefined;
      const notif: PosNotification = {
        id: Date.now().toString(),
        type: 'attendance',
        title: '👤 تحديث حضور',
        body: `${emp?.fullName || 'موظفة'} — ${data.checkIn ? 'حضور' : 'انصراف'}`,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      addNotif(notif);
    });

    // ── فاتورة مدفوعة ──
    socket.on('invoice:paid', (data: Record<string, unknown>) => {
      const notif: PosNotification = {
        id: Date.now().toString(),
        type: 'alert',
        title: '💰 فاتورة مدفوعة',
        body: `${(data.clientName as string) || ''} — ${(data.total as number) || 0} ر.س`,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      addNotif(notif);
    });

    // ── موعد جديد ──
    socket.on('appointment:new', (data: Record<string, unknown>) => {
      playBeep();
      const notif: PosNotification = {
        id: Date.now().toString(),
        type: 'appointment',
        title: '📅 موعد جديد',
        body: `${(data.clientName as string) || 'عميلة'} — ${(data.startTime as string) || ''}`,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      addNotif(notif);
      toast.info(notif.title, { description: notif.body });
    });

    // ── تغيير حالة موعد ──
    socket.on('appointment:status', (data: Record<string, unknown>) => {
      const statusMap: Record<string, string> = { confirmed: 'مؤكد', cancelled: 'ملغي', completed: 'مكتمل', no_show: 'لم تحضر' };
      const notif: PosNotification = {
        id: Date.now().toString(),
        type: 'appointment',
        title: '📋 تحديث موعد',
        body: `${(data.clientName as string) || 'عميلة'} — ${statusMap[(data.status as string) || ''] || (data.status as string)}`,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      addNotif(notif);
    });

    // ── إعدادات ──
    socket.on('settings:updated', () => {
      toast.info('تم تحديث إعدادات الصالون');
    });

    socket.on('connect_error', (err) => {
      console.warn('[POS Socket] Connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // V-01: dropping user?.id — tenantId+userId now come from the JWT
    // on the server side, so changes to the user object alone don't
    // need to reconnect the socket.
  }, [accessToken, currentTenant?.id]);

  const clearNotifications = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    unreadCount,
    clearNotifications,
    dismissNotification,
  };
}
