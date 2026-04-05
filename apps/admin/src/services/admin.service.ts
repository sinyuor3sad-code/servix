import { api } from '@/lib/api';

export interface Tenant {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  email: string;
  phone: string;
  city: string;
  status: 'active' | 'suspended' | 'pending';
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
  tenantName: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
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
  pendingTenants: number;
  totalSubscriptions: number;
  monthlyRevenue: number;
  newTenantsThisMonth: number;
  planDistribution: PlanDistribution[];
  recentTenants: Tenant[];
}

export interface PlanDistribution {
  plan: string;
  count: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('servix-admin-auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { state?: { accessToken?: string } };
    return parsed.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

export const adminService = {
  getStats: (): Promise<AdminStats> =>
    api.get<AdminStats>('/admin/stats', getToken() ?? undefined),

  getTenants: (params?: string): Promise<PaginatedResponse<Tenant>> =>
    api.get<PaginatedResponse<Tenant>>(`/admin/tenants${params ? `?${params}` : ''}`, getToken() ?? undefined),

  getTenantById: (id: string): Promise<TenantDetail> =>
    api.get<TenantDetail>(`/admin/tenants/${id}`, getToken() ?? undefined),

  updateTenantStatus: (id: string, status: string): Promise<Tenant> =>
    api.put<Tenant>(`/admin/tenants/${id}/status`, { status }, getToken() ?? undefined),

  getSubscriptions: (params?: string): Promise<PaginatedResponse<Subscription>> =>
    api.get<PaginatedResponse<Subscription>>(`/admin/subscriptions${params ? `?${params}` : ''}`, getToken() ?? undefined),

  getInvoices: (params?: string): Promise<PaginatedResponse<PlatformInvoice>> =>
    api.get<PaginatedResponse<PlatformInvoice>>(`/admin/invoices${params ? `?${params}` : ''}`, getToken() ?? undefined),

  getAuditLogs: (params?: string): Promise<PaginatedResponse<AuditLog>> =>
    api.get<PaginatedResponse<AuditLog>>(`/admin/audit-logs${params ? `?${params}` : ''}`, getToken() ?? undefined),

  getPlans: (): Promise<Plan[]> =>
    api.get<Plan[]>('/admin/plans', getToken() ?? undefined),

  updatePlan: (id: string, data: Partial<Plan>): Promise<Plan> =>
    api.put<Plan>(`/admin/plans/${id}`, data, getToken() ?? undefined),

  getFeatures: (): Promise<Feature[]> =>
    api.get<Feature[]>('/admin/features', getToken() ?? undefined),

  updateFeature: (id: string, data: Partial<Feature>): Promise<Feature> =>
    api.put<Feature>(`/admin/features/${id}`, data, getToken() ?? undefined),

  createTenant: (data: {
    nameAr: string;
    nameEn: string;
    email: string;
    phone: string;
    city: string;
    planId?: string;
    ownerName: string;
    ownerPassword: string;
  }): Promise<Tenant> => {
    // Auto-generate slug from nameEn
    const slug = (data.nameEn || data.nameAr)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50) || `salon-${Date.now()}`;
    return api.post<Tenant>('/admin/tenants', {
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      slug,
      email: data.email,
      phone: data.phone,
      city: data.city,
    }, getToken() ?? undefined);
  },

  login: (email: string, password: string): Promise<{ user: { id: string; email: string; fullName: string; role: string }; accessToken: string; refreshToken: string }> =>
    api.post('/admin/auth/login', { email, password }),
};
