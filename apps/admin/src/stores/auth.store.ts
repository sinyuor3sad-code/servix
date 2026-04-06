'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthActions {
  setUser: (user: AdminUser | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: AdminUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  _hasHydrated: boolean;
  _setHasHydrated: (v: boolean) => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

// Sync auth state to cookie so Next.js middleware can read it
function syncToCookie(state: AuthState) {
  if (typeof document === 'undefined') return;
  if (state.accessToken && state.user) {
    const value = JSON.stringify({ state: { accessToken: state.accessToken, user: state.user } });
    document.cookie = `servix-admin-auth=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  } else {
    document.cookie = 'servix-admin-auth=; path=/; max-age=0';
  }
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      _hasHydrated: false,
      _setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),

      setUser: (user) => set((s) => {
        const next = { ...s, user };
        syncToCookie(next);
        return next;
      }),

      setTokens: (accessToken, refreshToken) => set((s) => {
        const next = { ...s, accessToken, refreshToken };
        syncToCookie(next);
        return next;
      }),

      login: (user, accessToken, refreshToken) => {
        const next = { user, accessToken, refreshToken };
        syncToCookie(next);
        set(next);
      },

      logout: () => {
        // Clear React Query cache
        if (typeof window !== 'undefined') {
          try {
            const { QueryClient } = require('@tanstack/react-query');
            const queryClient = new QueryClient();
            queryClient.clear();
          } catch {
            // React Query not available
          }
        }
        syncToCookie(initialState);
        set({ ...initialState });
      },
    }),
    {
      name: 'servix-admin-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    },
  ),
);
