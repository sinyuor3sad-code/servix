'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Tenant } from '@/types';

/** Roles recognized by the dashboard for routing & access control */
export type UserRole = 'owner' | 'manager' | 'receptionist' | 'cashier' | 'staff';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentTenant: Tenant | null;
  /** Current user's role within the active tenant */
  userRole: UserRole | null;
  /** Whether the user is the tenant owner (supersedes role) */
  isOwner: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  setUserRole: (role: UserRole | null, isOwner: boolean) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  currentTenant: null,
  userRole: null,
  isOwner: false,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setCurrentTenant: (currentTenant) => set({ currentTenant }),

      setUserRole: (userRole, isOwner) => set({ userRole, isOwner }),

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
        userRole: state.userRole,
        isOwner: state.isOwner,
      }),
      // If localStorage data is corrupted/incompatible, reset instead of crashing
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[AuthStore] Failed to hydrate from localStorage, resetting:', error);
          try {
            localStorage.removeItem('servix-auth');
          } catch {
            // ignore
          }
        }
      },
    },
  ),
);
