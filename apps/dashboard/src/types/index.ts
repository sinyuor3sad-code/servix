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
export type TenantTheme = 'velvet' | 'crystal' | 'orchid' | 'noir';

export type EmployeeRole = 'stylist' | 'cashier' | 'makeup' | 'nails' | 'skincare';
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
  emailOrPhone: string;
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

// ─────────────────── Inventory ───────────────────

export interface ProductCategory {
  id: string;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
}

export interface Product {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string | null;
  sku: string | null;
  unit: string;
  costPrice: number;
  sellPrice: number;
  currentStock: number;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  category?: ProductCategory;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: 'purchase' | 'consumption' | 'adjustment' | 'waste' | 'return_to_supplier';
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  product?: Product;
}

export interface ServiceProduct {
  id: string;
  serviceId: string;
  productId: string;
  quantityPerUse: number;
  service?: Service;
  product?: Product;
}

// ─────────────────── Shifts ───────────────────

export type ShiftStatus = 'scheduled' | 'active' | 'late' | 'completed' | 'absent';

export interface Shift {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  maxLoad: number;
  currentLoad: number;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  lateMinutes: number;
  createdAt: string;
  employee?: Employee;
}

// ─────────────────── Client DNA ───────────────────

export type ChurnRisk = 'low' | 'medium' | 'high' | 'critical';

export interface ClientDna {
  id: string;
  clientId: string;
  predictedClv: number;
  churnRisk: ChurnRisk;
  churnProbability: number;
  priceSensitivity: 'low' | 'moderate' | 'high';
  avgDaysBetweenVisits: number;
  daysSinceLastVisit: number;
  expectedNextVisitAt: string | null;
  avgTicketValue: number;
  maxTicketValue: number;
  preferredPayMethod: string | null;
  topServiceIds: string[];
  topEmployeeIds: string[];
  vipScore: number;
  isVip: boolean;
  lastComputedAt: string;
}

// ─────────────────── Dynamic Pricing ───────────────────

export interface PricingRule {
  id: string;
  serviceId: string | null;
  ruleType: string;
  nameAr: string;
  multiplier: number;
  fixedAdjustment: number;
  conditions: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  service?: { id: string; nameAr: string };
}

export interface CalculatedPrice {
  basePrice: number;
  effectivePrice: number;
  appliedRuleIds: string[];
}

// ─────────────────── Marketing ───────────────────

export type CampaignStatus = 'draft' | 'active' | 'completed' | 'paused';

export interface Campaign {
  id: string;
  nameAr: string;
  trigger: string;
  messageAr: string;
  channel: string;
  status: CampaignStatus;
  targetFilter: Record<string, unknown> | null;
  couponId: string | null;
  requiresSlotAvailability: boolean;
  scheduledAt: string | null;
  executedAt: string | null;
  sentCount: number;
  createdAt: string;
}

export interface CalendarGap {
  date: string;
  startTime: string;
  endTime: string;
  employeeId?: string;
}

// ─────────────────── Packages ───────────────────

export interface Package {
  id: string;
  nameAr: string;
  nameEn: string | null;
  originalPrice: number;
  packagePrice: number;
  isActive: boolean;
  createdAt: string;
  services: Array<{ id: string; nameAr: string; nameEn: string | null; price: number; duration: number }>;
}

// ─────────────────── ZATCA ───────────────────

export interface ZatcaCertificate {
  id: string;
  csrContent: string;
  isProduction: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ZatcaInvoice {
  id: string;
  invoiceId: string;
  certificateId: string;
  invoiceType: 'simplified' | 'standard';
  submissionStatus: 'pending' | 'reported' | 'cleared' | 'rejected';
  qrCode: string;
  xmlHash: string;
  invoiceCounterValue: number;
  createdAt: string;
}

// ─────────────────── Domain Events ───────────────────

export interface DomainEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  emittedBy: string;
  processedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}
