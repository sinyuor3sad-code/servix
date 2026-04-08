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

/**
 * Read auth token directly from localStorage (synchronous).
 * This is the ONLY reliable way to check auth on first render
 * because zustand persist hydrates asynchronously.
 */
function readTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('servix-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.accessToken || null;
  } catch {
    return null;
  }
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
    setTokens,
    setCurrentTenant,
    setUserRole,
  } = useAuthStore();

  // ── Hydration ──
  // On the very first client render, zustand may not have hydrated yet.
  // We read directly from localStorage as the source of truth.
  const [hydrated, setHydrated] = useState(false);
  const [storedToken, setStoredToken] = useState<string | null>(null);

  useEffect(() => {
    const token = readTokenFromStorage();
    setStoredToken(token);

    // If zustand hasn't hydrated yet but localStorage has a token,
    // force-sync it into the zustand store immediately.
    if (token && !accessToken) {
      try {
        const raw = localStorage.getItem('servix-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          const state = parsed?.state;
          if (state?.accessToken) {
            setTokens(state.accessToken, state.refreshToken || '');
            if (state.user) setUser(state.user);
            if (state.userRole) setUserRole(state.userRole, state.isOwner ?? false);
            if (state.currentTenant) setCurrentTenant(state.currentTenant);
          }
        }
      } catch { /* ignore */ }
    }

    setHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Token Refresh Sync ──
  // Listen for token refresh events from api.ts
  useEffect(() => {
    const handler = (e: Event) => {
      const { accessToken: newAT, refreshToken: newRT } = (e as CustomEvent).detail;
      if (newAT) {
        useAuthStore.getState().setTokens(newAT, newRT);
      }
    };
    window.addEventListener('servix:token-refresh', handler);
    return () => window.removeEventListener('servix:token-refresh', handler);
  }, []);

  // ── Effective token: use zustand (if hydrated) or fallback to localStorage read ──
  const effectiveToken = accessToken || storedToken;

  // ── Background user data fetch ──
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => {
      const latestToken = useAuthStore.getState().accessToken || storedToken;
      return authService.getMe(latestToken!);
    },
    enabled: hydrated && !!effectiveToken,
    staleTime: 10 * 60 * 1000,
    retry: false,
    meta: { skipAuthError: true },
  });

  // isLoading = ONLY during first render (before useEffect)
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
      // Don't store tokens — user must verify email first
      return result;
    },
    [],
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
    isAuthenticated: !!effectiveToken,
    isLoading,
    accessToken: effectiveToken,
    login,
    register,
    logout,
    setCurrentTenant,
    landingRoute: getLandingRoute(userRole, isOwner),
  };
}
