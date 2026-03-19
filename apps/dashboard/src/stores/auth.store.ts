'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Tenant } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentTenant: Tenant | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  currentTenant: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setCurrentTenant: (currentTenant) => set({ currentTenant }),

      login: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      logout: () => set({ ...initialState }),
    }),
    {
      name: 'servix-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        currentTenant: state.currentTenant,
      }),
    },
  ),
);
