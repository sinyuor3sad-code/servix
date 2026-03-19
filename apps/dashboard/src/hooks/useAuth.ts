'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import type { LoginCredentials, RegisterData } from '@/types';

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    user,
    accessToken,
    currentTenant,
    login: storeLogin,
    logout: storeLogout,
    setUser,
    setCurrentTenant,
  } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.getMe(accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
    meta: { skipAuthError: true },
  });

  if (data && data.user.id !== user?.id) {
    setUser(data.user);
  }

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const result = await authService.login(credentials);
      storeLogin(result.user, result.tokens.accessToken, result.tokens.refreshToken);

      if (result.tenants.length > 0) {
        setCurrentTenant(result.tenants[0].tenant);
      }

      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      return result;
    },
    [storeLogin, setCurrentTenant, queryClient],
  );

  const register = useCallback(
    async (data: RegisterData) => {
      const result = await authService.register(data);
      storeLogin(result.user, result.tokens.accessToken, result.tokens.refreshToken);

      if (result.tenants.length > 0) {
        setCurrentTenant(result.tenants[0].tenant);
      }

      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      return result;
    },
    [storeLogin, setCurrentTenant, queryClient],
  );

  const logout = useCallback(async () => {
    const rt = useAuthStore.getState().refreshToken;
    try {
      await authService.logout(rt);
    } catch {
      // ignore — clear local state regardless
    }
    storeLogout();
    queryClient.clear();
  }, [storeLogout, queryClient]);

  return {
    user: data?.user ?? user,
    tenants: data?.tenants ?? [],
    currentTenant,
    isAuthenticated: !!accessToken && !!user,
    isLoading,
    accessToken,
    login,
    register,
    logout,
    setCurrentTenant,
  };
}
