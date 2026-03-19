import { api } from '@/lib/api';
import type {
  User,
  AuthTokens,
  LoginCredentials,
  RegisterData,
  ChangePasswordData,
  TenantUser,
} from '@/types';

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  tenants: TenantUser[];
}

export const authService = {
  register: (data: RegisterData) =>
    api.post<AuthResponse>('/auth/register', data),

  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>('/auth/login', credentials),

  refreshTokens: (refreshToken: string) =>
    api.post<AuthTokens>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string | null) =>
    api.post<{ message: string }>('/auth/logout', { refreshToken: refreshToken ?? '' }),

  getMe: (token: string) =>
    api.get<{ user: User; tenants: TenantUser[] }>('/auth/me', token),

  updateMe: (data: Partial<Pick<User, 'fullName' | 'email' | 'phone'>>, token: string) =>
    api.put<User>('/auth/me', data, token),

  changePassword: (data: ChangePasswordData, token: string) =>
    api.post<{ message: string }>('/auth/change-password', data, token),
};
