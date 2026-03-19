'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

export function useSettingsSocket(tenantId: string | undefined, enabled: boolean): void {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !tenantId) return;

    const socket = io(`${WS_URL}/ws`, {
      query: { tenantId },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('settings:updated', (data: Record<string, string>) => {
      queryClient.setQueryData(['settings'], data);
    });

    socket.on('connect', () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId, enabled, queryClient]);
}
