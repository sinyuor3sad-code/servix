'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type UserRole } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { tryRefreshToken } from '@/lib/api';
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
 * Read persisted auth state directly from localStorage (synchronous).
 * This is the ONLY reliable way to check auth on first render
 * because zustand persist hydrates asynchronously.
 *
 * V-39: accessToken is only present for dev mock logins — real access
 * tokens live in memory and are re-acquired via the cookie refresh flow
 * (csrfToken signals a resumable cookie session).
 */
function readAuthFromStorage(): {
  accessToken: string | null;
  csrfToken: string | null;
} {
  if (typeof window === 'undefined') return { accessToken: null, csrfToken: null };
  try {
    const raw = localStorage.getItem('servix-auth');
    if (!raw) return { accessToken: null, csrfToken: null };
    const parsed = JSON.parse(raw);
    return {
      accessToken: parsed?.state?.accessToken || null,
      csrfToken: parsed?.state?.csrfToken || null,
    };
  } catch {
    return { accessToken: null, csrfToken: null };
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
    const { accessToken: storedAccess, csrfToken } = readAuthFromStorage();

    // Force-sync persisted user/role/tenant into zustand immediately
    // (zustand persist hydrates asynchronously).
    try {
      const raw = localStorage.getItem('servix-auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        const state = parsed?.state;
        if (state) {
          if (state.user && !useAuthStore.getState().user) setUser(state.user);
          if (state.userRole) setUserRole(state.userRole, state.isOwner ?? false);
          if (state.currentTenant) setCurrentTenant(state.currentTenant);
        }
      }
    } catch { /* ignore */ }

    if (storedAccess) {
      // Dev mock session — the only accessToken that persists (V-39).
      setStoredToken(storedAccess);
      if (!accessToken) setTokens(storedAccess);
      setHydrated(true);
      return;
    }

    if (useAuthStore.getState().accessToken || !csrfToken) {
      // Already authenticated in memory, or no cookie session to resume.
      setHydrated(true);
      return;
    }

    // V-39 bootstrap: re-acquire an in-memory access token through the
    // httpOnly refresh cookie. Stay in isLoading until it settles so
    // route guards don't bounce a valid session to /login.
    let cancelled = false;
    void tryRefreshToken()
      .then((newToken) => {
        if (cancelled) return;
        if (newToken) {
          // tryRefreshToken already dispatched servix:token-refresh, but
          // set directly too — this effect can run before the listener.
          useAuthStore.getState().setTokens(newToken);
          setStoredToken(newToken);
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Token Refresh Sync ──
  // Listen for token refresh events from api.ts
  useEffect(() => {
    const handler = (e: Event) => {
      const { accessToken: newAT, csrfToken: newCsrf } = (e as CustomEvent).detail;
      if (newAT) {
        useAuthStore.getState().setTokens(newAT, newCsrf);
      }
    };
    window.addEventListener('servix:token-refresh', handler);
    return () => window.removeEventListener('servix:token-refresh', handler);
  }, []);

  // ── SECURITY: Force-logout when session mismatch detected ──
  useEffect(() => {
    const handler = () => {
      storeLogout();
      queryClient.clear();
      window.location.href = '/login';
    };
    window.addEventListener('servix:force-logout', handler);
    return () => window.removeEventListener('servix:force-logout', handler);
  }, [storeLogout, queryClient]);

  // ── SECURITY: Cross-tab session detection ──
  // When another tab logs in as a different user, localStorage changes.
  // We detect this and force-logout to prevent session leaking.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'servix-auth') return;
      const currentUserId = useAuthStore.getState().user?.id;
      if (!currentUserId) return; // not logged in, nothing to protect

      if (!e.newValue) {
        // Another tab logged out — log out this tab too
        storeLogout();
        queryClient.clear();
        window.location.href = '/login';
        return;
      }

      try {
        const newState = JSON.parse(e.newValue);
        const newUserId = newState?.state?.user?.id;
        if (newUserId && newUserId !== currentUserId) {
          // Different user logged in on another tab — force logout this tab
          console.warn('[SERVIX Security] Another user logged in — logging out this tab');
          storeLogout();
          queryClient.clear();
          window.location.href = '/login';
        }
      } catch { /* ignore parse errors */ }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [storeLogout, queryClient]);

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
      // V-39: the refresh token stays in the httpOnly cookie — the SPA
      // only keeps the access token (memory) and the CSRF token.
      storeLogin(result.user, result.tokens.accessToken, result.csrfToken);
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
    const at = useAuthStore.getState().accessToken;
    try {
      // V-39: server reads the refresh token from the httpOnly cookie
      // and clears it; the access token is only passed to detect dev mode.
      await authService.logout(at);
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
