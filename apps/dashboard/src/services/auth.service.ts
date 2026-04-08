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

/* ── Dev-mode mock logins (localhost only, credentials from env) ── */
const DEV_PASS = process.env.NEXT_PUBLIC_DEV_PASS || '';

const DEV_TENANT = {
  id: 'dev-tenant-001',
  nameAr: 'صالون الأناقة',
  nameEn: 'Elegance Salon',
  slug: 'elegance-salon',
  logoUrl: null,
  primaryColor: '#a855f7',
  theme: 'velvet' as const,
  status: 'active' as const,
  trialEndsAt: null,
  phone: '+966501234567',
  email: 'salon@example.com',
  city: 'الرياض',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
};

/** Dev accounts: email → { user, role, isOwner } */
const DEV_ACCOUNTS: Record<string, { userId: string; fullName: string; phone: string; roleName: string; roleNameAr: string; isOwner: boolean }> = {
  'servix@dev.local': {
    userId: 'dev-user-001', fullName: 'مدير الصالون', phone: '+966500000001',
    roleName: 'owner', roleNameAr: 'مالك', isOwner: true,
  },
  'cashier@dev.local': {
    userId: 'dev-user-002', fullName: 'كاشير الصالون', phone: '+966500000002',
    roleName: 'cashier', roleNameAr: 'كاشير', isOwner: false,
  },
  'manager@dev.local': {
    userId: 'dev-user-003', fullName: 'مدير الفرع', phone: '+966500000003',
    roleName: 'manager', roleNameAr: 'مدير', isOwner: false,
  },
};

function buildDevResponse(email: string): AuthResponse {
  const account = DEV_ACCOUNTS[email];
  if (!account) throw new Error('Dev account not found');
  return {
    user: {
      id: account.userId,
      fullName: account.fullName,
      email,
      phone: account.phone,
      avatarUrl: null,
      isEmailVerified: true,
      isPhoneVerified: true,
      lastLoginAt: new Date().toISOString(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    tokens: {
      accessToken: `dev-access-token-${account.roleName}`,
      refreshToken: `dev-refresh-token-${account.roleName}`,
    },
    tenants: [{
      id: `dev-tu-${account.roleName}`,
      tenantId: DEV_TENANT.id,
      userId: account.userId,
      roleId: `dev-role-${account.roleName}`,
      isOwner: account.isOwner,
      status: 'active',
      tenant: DEV_TENANT,
      role: {
        id: `dev-role-${account.roleName}`,
        name: account.roleName,
        nameAr: account.roleNameAr,
        isSystem: true,
      },
    }],
  };
}

function getDevAccount(credentials: LoginCredentials): AuthResponse | null {
  if (typeof window === 'undefined' || window.location.hostname !== 'localhost') return null;
  if (!DEV_PASS || credentials.password !== DEV_PASS) return null;
  if (!DEV_ACCOUNTS[credentials.emailOrPhone]) return null;
  return buildDevResponse(credentials.emailOrPhone);
}

interface RegisterResponse {
  user: User;
  tenant: { id: string; nameAr: string; nameEn: string; slug: string };
  requiresVerification: boolean;
  message: string;
}

interface VerifyOtpResponse {
  user: User;
  tokens: AuthTokens;
  tenants: TenantUser[];
}

export const authService = {
  register: (data: RegisterData) =>
    api.post<RegisterResponse>('/auth/register', data),

  verifyOtp: (email: string, code: string) =>
    api.post<VerifyOtpResponse>('/auth/verify-otp', { email, code }),

  resendOtp: (email: string) =>
    api.post<{ message: string }>('/auth/resend-otp', { email }),

  login: (credentials: LoginCredentials) => {
    const devResponse = getDevAccount(credentials);
    if (devResponse) return Promise.resolve(devResponse);
    return api.post<AuthResponse>('/auth/login', credentials);
  },

  refreshTokens: (refreshToken: string) =>
    api.post<AuthTokens>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string | null) => {
    if (refreshToken?.startsWith('dev-refresh-token-')) {
      return Promise.resolve({ message: 'ok' });
    }
    return api.post<{ message: string }>('/auth/logout', { refreshToken: refreshToken ?? '' });
  },

  getMe: (token: string) => {
    // Handle all dev tokens (dev-access-token-owner, dev-access-token-cashier, etc.)
    if (token.startsWith('dev-access-token-')) {
      const roleName = token.replace('dev-access-token-', '');
      const email = Object.keys(DEV_ACCOUNTS).find(
        (e) => DEV_ACCOUNTS[e].roleName === roleName,
      );
      if (email) {
        const resp = buildDevResponse(email);
        return Promise.resolve({ user: resp.user, tenants: resp.tenants });
      }
    }
    return api.get<{ user: User; tenants: TenantUser[] }>('/auth/me', token);
  },

  updateMe: (data: Partial<Pick<User, 'fullName' | 'email' | 'phone'>>, token: string) =>
    api.put<User>('/auth/me', data, token),

  changePassword: (data: ChangePasswordData, token: string) =>
    api.post<{ message: string }>('/auth/change-password', data, token),
};
