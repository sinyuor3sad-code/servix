import { api } from '@/lib/api';
import type { PaginatedResult } from '@/lib/api';

// ═══════════════════ Types ═══════════════════

export interface Tenant {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  email: string;
  phone: string;
  city: string;
  status: 'active' | 'suspended' | 'trial' | 'cancelled' | 'pending_deletion';
  dbName: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDetail extends Tenant {
  subscription: Subscription | null;
  users: TenantUser[];
}

export interface TenantUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  tenantName: string;
  planName: string;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startDate: string;
  endDate: string;
  billingCycle: 'monthly' | 'yearly';
  price: number;
}

export interface PlatformInvoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  total: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  tenant?: Tenant;
}

export interface Plan {
  id: string;
  nameAr: string;
  nameEn: string;
  code: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxEmployees: number;
  maxClients: number;
  isActive: boolean;
  features: PlanFeature[];
}

export interface PlanFeature {
  id: string;
  featureId: string;
  featureCode: string;
  featureNameAr: string;
  enabled: boolean;
}

export interface Feature {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAt: string;
}

export interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  pendingTenants: number;
  totalUsers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalRevenue: number;
  revenueThisMonth: number;
  newTenantsThisMonth: number;
  planDistribution: PlanDistribution[];
  recentTenants: Tenant[];
}

export interface PlanDistribution {
  planId: string;
  planName: string;
  planNameAr: string;
  count: number;
}

// ── New types ──

export interface BackupRecord {
  id: string;
  salonName: string;
  lastBackup: string | null;
  status: 'success' | 'failed' | 'pending' | 'never';
  size: string;
  initiator: string;
  autoBackup: boolean;
}

export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  channel: 'email' | 'sms' | 'push' | 'whatsapp';
  target: string;
  status: 'draft' | 'sent' | 'scheduled';
  recipients: number;
  delivered: number;
  opened: number;
  sentAt: string | null;
  createdAt: string;
}

export interface PlatformCoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free';
  value: number;
  usageLimit: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export interface PaymentRecord {
  id: string;
  salon: string;
  amount: number;
  method: string;
  status: 'completed' | 'pending' | 'failed';
  date: string;
}

export interface RenewalRecord {
  id: string;
  salon: string;
  planName: string;
  amount: number;
  status: 'renewed' | 'pending' | 'failed';
  date: string;
  billingCycle: string;
}

// ═══════════════════ Service ═══════════════════

export const adminService = {
  // ── Auth ──
  login: (email: string, password: string): Promise<{ user: { id: string; email: string; fullName: string; role: string }; accessToken: string; refreshToken: string }> =>
    api.postPublic('/admin/auth/login', { email, password }),

  // ── Stats ──
  getStats: (): Promise<AdminStats> =>
    api.get<AdminStats>('/admin/stats'),

  // ── Tenants ──
  getTenants: (params?: string): Promise<PaginatedResult<Tenant>> =>
    api.getPaginated<Tenant>(`/admin/tenants${params ? `?${params}` : ''}`),

  getTenantById: (id: string): Promise<TenantDetail> =>
    api.get<TenantDetail>(`/admin/tenants/${id}`),

  updateTenantStatus: (id: string, status: string): Promise<Tenant> =>
    api.put<Tenant>(`/admin/tenants/${id}/status`, { status }),

  createTenant: (data: {
    nameAr: string; nameEn: string; email: string; phone: string; city: string;
    planId?: string;
  }): Promise<Tenant> => {
    const slug = (data.nameEn || data.nameAr)
      .toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50) || `salon-${Date.now()}`;
    return api.post<Tenant>('/admin/tenants', {
      nameAr: data.nameAr, nameEn: data.nameEn, slug,
      email: data.email, phone: data.phone, city: data.city,
    });
  },

  // ── Subscriptions ──
  getSubscriptions: (params?: string): Promise<PaginatedResult<Subscription>> =>
    api.getPaginated<Subscription>(`/admin/subscriptions${params ? `?${params}` : ''}`),

  // ── Invoices ──
  getInvoices: (params?: string): Promise<PaginatedResult<PlatformInvoice>> =>
    api.getPaginated<PlatformInvoice>(`/admin/invoices${params ? `?${params}` : ''}`),

  // ── Audit Logs ──
  getAuditLogs: (params?: string): Promise<PaginatedResult<AuditLog>> =>
    api.getPaginated<AuditLog>(`/admin/audit-logs${params ? `?${params}` : ''}`),

  // ── Plans ──
  getPlans: (): Promise<Plan[]> =>
    api.get<Plan[]>('/admin/plans'),

  updatePlan: (id: string, data: Partial<Plan>): Promise<Plan> =>
    api.put<Plan>(`/admin/plans/${id}`, data),

  // ── Features ──
  getFeatures: (): Promise<Feature[]> =>
    api.get<Feature[]>('/features'),

  updateFeature: (id: string, data: Partial<Feature>): Promise<Feature> =>
    api.put<Feature>(`/features/${id}`, data),

  // ── Settings ──
  getSettings: (): Promise<Record<string, string>> =>
    api.get<Record<string, string>>('/admin/settings'),

  updateSettings: (settings: Record<string, string>): Promise<Record<string, string>> =>
    api.put<Record<string, string>>('/admin/settings', { settings }),

  // ── Backups ──
  getBackups: (): Promise<BackupRecord[]> =>
    api.get<BackupRecord[]>('/admin/backups'),

  triggerBackup: (tenantId: string): Promise<BackupRecord> =>
    api.post<BackupRecord>('/admin/backups/trigger', { tenantId }),

  // ── Notifications ──
  getNotifications: (params?: string): Promise<PaginatedResult<PlatformNotification>> =>
    api.getPaginated<PlatformNotification>(`/admin/notifications${params ? `?${params}` : ''}`),

  createNotification: (data: {
    title: string; body: string; channel: string; target: string; saveAsDraft?: boolean;
  }): Promise<PlatformNotification> =>
    api.post<PlatformNotification>('/admin/notifications', data),

  // ── Coupons ──
  getCoupons: (params?: string): Promise<PaginatedResult<PlatformCoupon>> =>
    api.getPaginated<PlatformCoupon>(`/admin/coupons${params ? `?${params}` : ''}`),

  createCoupon: (data: {
    code: string; type: string; value: number; usageLimit?: number; validUntil: string;
  }): Promise<PlatformCoupon> =>
    api.post<PlatformCoupon>('/admin/coupons', data),

  updateCoupon: (id: string, data: Record<string, unknown>): Promise<PlatformCoupon> =>
    api.put<PlatformCoupon>(`/admin/coupons/${id}`, data),

  deleteCoupon: (id: string): Promise<{ deleted: boolean }> =>
    api.post<{ deleted: boolean }>(`/admin/coupons/${id}/delete`, {}),

  // ── Payments ──
  getPayments: (params?: string): Promise<PaginatedResult<PaymentRecord>> =>
    api.getPaginated<PaymentRecord>(`/admin/payments${params ? `?${params}` : ''}`),

  // ── Renewals ──
  getRenewals: (params?: string): Promise<PaginatedResult<RenewalRecord>> =>
    api.getPaginated<RenewalRecord>(`/admin/renewals${params ? `?${params}` : ''}`),
};
