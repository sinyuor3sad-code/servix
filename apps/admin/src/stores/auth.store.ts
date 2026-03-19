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
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      login: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      logout: () => set({ ...initialState }),
    }),
    {
      name: 'servix-admin-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
