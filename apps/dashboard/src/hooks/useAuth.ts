'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type UserRole } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import type { LoginCredentials, RegisterData, TenantUser } from '@/types';

/**
 * Determine the landing page for a given role after login.
 */
export function getLandingRoute(role: UserRole | null, isOwner: boolean): string {
  if (role === 'cashier' && !isOwner) return '/pos';
  return '/';
}

/** Extract role info from the first tenant-user entry */
function extractRole(tenants: TenantUser[]): { role: UserRole; isOwner: boolean } {
  if (tenants.length === 0) return { role: 'staff', isOwner: false };
  const tu = tenants[0];
  const roleName = (tu.role?.name ?? 'staff') as UserRole;
  return { role: roleName, isOwner: tu.isOwner };
}

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    user,
    accessToken,
    currentTenant,
    userRole,
    isOwner,
    login: storeLogin,
    logout: storeLogout,
    setUser,
    setCurrentTenant,
    setUserRole,
  } = useAuthStore();

  // Client-side hydration: useEffect fires AFTER zustand loads from localStorage
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  // Background user data fetch — NEVER causes logout
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => {
      const latestToken = useAuthStore.getState().accessToken;
      return authService.getMe(latestToken!);
    },
    enabled: hydrated && !!accessToken,
    staleTime: 10 * 60 * 1000, // 10 min cache
    retry: false,              // api.ts handles 401 refresh internally
    meta: { skipAuthError: true },
  });

  // isLoading = only during initial hydration (one React tick)
  const isLoading = !hydrated;

  // Sync user data from query into store
  if (data?.user && data.user.id !== user?.id) {
    setUser(data.user);
  }

  // Sync role and tenant data
  if (data?.tenants && data.tenants.length > 0) {
    const { role, isOwner: owner } = extractRole(data.tenants);
    if (role !== userRole || owner !== isOwner) {
      setUserRole(role, owner);
    }
    const tenantFromApi = data.tenants[0].tenant;
    if (tenantFromApi && tenantFromApi.id !== currentTenant?.id) {
      setCurrentTenant(tenantFromApi);
    }
  }

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const result = await authService.login(credentials);
      storeLogin(result.user, result.tokens.accessToken, result.tokens.refreshToken);
      const { role, isOwner: owner } = extractRole(result.tenants);
      setUserRole(role, owner);
      if (result.tenants.length > 0) {
        setCurrentTenant(result.tenants[0].tenant);
      }
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      return result;
    },
    [storeLogin, setCurrentTenant, setUserRole, queryClient],
  );

  const register = useCallback(
    async (data: RegisterData) => {
      const result = await authService.register(data);
      storeLogin(result.user, result.tokens.accessToken, result.tokens.refreshToken);
      const { role, isOwner: owner } = extractRole(result.tenants);
      setUserRole(role, owner);
      if (result.tenants.length > 0) {
        setCurrentTenant(result.tenants[0].tenant);
      }
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      return result;
    },
    [storeLogin, setCurrentTenant, setUserRole, queryClient],
  );

  const logout = useCallback(async () => {
    const rt = useAuthStore.getState().refreshToken;
    try {
      await authService.logout(rt);
    } catch {
      // ignore
    }
    storeLogout();
    queryClient.clear();
  }, [storeLogout, queryClient]);

  return {
    user: data?.user ?? user,
    tenants: data?.tenants ?? [],
    currentTenant,
    userRole,
    isOwner,
    isAuthenticated: !!accessToken,
    isLoading,
    accessToken,
    login,
    register,
    logout,
    setCurrentTenant,
    landingRoute: getLandingRoute(userRole, isOwner),
  };
}
