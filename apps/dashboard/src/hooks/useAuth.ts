'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type UserRole } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import type { LoginCredentials, RegisterData, TenantUser } from '@/types';

/**
 * Determine the landing page for a given role after login.
 *
 * - cashier → /pos (point of sale, fullscreen)
 * - owner / manager → / (dashboard home)
 * - receptionist / staff → / (dashboard home)
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

  // Client-side hydration check: useEffect runs AFTER zustand has loaded from localStorage
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const { data, isLoading: queryLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => {
      const latestToken = useAuthStore.getState().accessToken;
      return authService.getMe(latestToken!);
    },
    enabled: hydrated && !!accessToken,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryDelay: 500,
    meta: { skipAuthError: true },
  });

  // isLoading = only during SSR→Client hydration (one tick)
  const isLoading = !hydrated;

  // Background validation: if getMe fails, the token is invalid — force logout
  useEffect(() => {
    if (isError && accessToken && hydrated) {
      storeLogout();
      queryClient.clear();
    }
  }, [isError, accessToken, hydrated, storeLogout, queryClient]);

  // Sync user data from query into store (with safe null checks)
  if (data?.user && data.user.id !== user?.id) {
    setUser(data.user);
  }

  // Sync role and tenant data from query into store
  if (data?.tenants && data.tenants.length > 0) {
    const { role, isOwner: owner } = extractRole(data.tenants);
    if (role !== userRole || owner !== isOwner) {
      setUserRole(role, owner);
    }
    // Keep tenant data in sync (White-Label)
    const tenantFromApi = data.tenants[0].tenant;
    if (tenantFromApi && tenantFromApi.id !== currentTenant?.id) {
      setCurrentTenant(tenantFromApi);
    }
  }

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const result = await authService.login(credentials);
      storeLogin(result.user, result.tokens.accessToken, result.tokens.refreshToken);

      // Store role info
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
      // ignore — clear local state regardless
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
    /** Get the correct landing page for the current user's role */
    landingRoute: getLandingRoute(userRole, isOwner),
  };
}
