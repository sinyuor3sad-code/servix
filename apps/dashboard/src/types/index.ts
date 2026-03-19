// ─────────────────── API Response Wrappers ───────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─────────────────── Enums ───────────────────

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type TenantTheme = 'elegance' | 'modern' | 'vivid' | 'minimal' | 'corporate' | 'royal';

export type EmployeeRole = 'stylist' | 'manager' | 'receptionist' | 'cashier';
export type CommissionType = 'percentage' | 'fixed' | 'none';
export type Gender = 'female' | 'male';
export type ClientSource = 'walk_in' | 'online' | 'phone' | 'referral';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentSource = 'online' | 'phone' | 'walk_in' | 'dashboard';

export type InvoiceStatus = 'draft' | 'paid' | 'partially_paid' | 'void' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'wallet';
export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';

// ─────────────────── Platform Models ───────────────────

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  theme: TenantTheme;
  status: TenantStatus;
  trialEndsAt: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  isOwner: boolean;
  status: 'active' | 'inactive';
  tenant: Tenant;
  role: Role;
}

export interface Role {
  id: string;
  name: string;
  nameAr: string;
  isSystem: boolean;
}

// ─────────────────── Tenant Models ───────────────────

export interface ServiceCategory {
  id: string;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
  services?: Service[];
}

export interface Service {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  price: number;
  duration: number;
  isActive: boolean;
  sortOrder: number;
  imageUrl: string | null;
  category?: ServiceCategory;
}

export interface Employee {
  id: string;
  userId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: EmployeeRole;
  commissionType: CommissionType;
  commissionValue: number;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  gender: Gender;
  dateOfBirth: string | null;
  notes: string | null;
  source: ClientSource;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  employeeId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  totalPrice: number;
  totalDuration: number;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  employee?: Employee;
  appointmentServices?: AppointmentService[];
}

export interface AppointmentService {
  id: string;
  appointmentId: string;
  serviceId: string;
  employeeId: string;
  price: number;
  duration: number;
  status: 'pending' | 'in_progress' | 'completed';
  service?: Service;
  employee?: Employee;
}

export interface Invoice {
  id: string;
  appointmentId: string | null;
  clientId: string;
  invoiceNumber: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  notes: string | null;
  createdBy: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  employeeId: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  status: PaymentStatus;
  createdAt: string;
}

// ─────────────────── Dashboard Stats ───────────────────

export interface DashboardStats {
  todayAppointments: number;
  todayRevenue: number;
  totalClients: number;
  totalEmployees: number;
  monthlyRevenue: number;
  monthlyAppointments: number;
  recentAppointments: Appointment[];
  revenueChart: RevenueDataPoint[];
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  appointments: number;
}

// ─────────────────── Auth ───────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  salonNameAr: string;
  salonNameEn: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}
