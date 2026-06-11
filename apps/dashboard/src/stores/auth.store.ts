'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Tenant } from '@/types';

/** Roles recognized by the dashboard for routing & access control */
export type UserRole = 'owner' | 'manager' | 'receptionist' | 'cashier' | 'staff';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  /**
   * V-39: the refresh token now lives in an httpOnly cookie (servix_rt) —
   * it is never stored in JS. The SPA only holds the CSRF double-submit
   * token, echoed in the x-csrf-token header on refresh/logout.
   */
  csrfToken: string | null;
  currentTenant: Tenant | null;
  userRole: UserRole | null;
  isOwner: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, csrfToken?: string) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  setUserRole: (role: UserRole | null, isOwner: boolean) => void;
  login: (user: User, accessToken: string, csrfToken?: string) => void;
  logout: () => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  csrfToken: null,
  currentTenant: null,
  userRole: null,
  isOwner: false,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, csrfToken) =>
        set((state) => ({
          accessToken,
          csrfToken: csrfToken ?? state.csrfToken,
        })),

      setCurrentTenant: (currentTenant) => set({ currentTenant }),

      setUserRole: (userRole, isOwner) => set({ userRole, isOwner }),

      login: (user, accessToken, csrfToken) =>
        set({ user, accessToken, csrfToken: csrfToken ?? null }),

      logout: () => set({ ...initialState }),
    }),
    {
      name: 'servix-auth',
      partialize: (state) => ({
        user: state.user,
        // V-39: real access tokens live in memory only — a page reload
        // re-acquires one via the cookie refresh flow. Dev mock tokens
        // (localhost, no backend session) are persisted so dev logins
        // survive reloads.
        accessToken: state.accessToken?.startsWith('dev-access-token-')
          ? state.accessToken
          : null,
        csrfToken: state.csrfToken,
        currentTenant: state.currentTenant,
        userRole: state.userRole,
        isOwner: state.isOwner,
      }),
      // DO NOT use onRehydrateStorage — it causes circular reference
      // errors in production builds (minified variable names).
      // Hydration is handled by useAuth hook reading localStorage directly.
    },
  ),
);
