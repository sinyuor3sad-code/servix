import { api } from '@/lib/api';
import type {
  DashboardStats,
  Appointment,
  Client,
  Employee,
  Service,
  ServiceCategory,
  Invoice,
  PaginatedResponse,
  Product,
  ProductCategory,
  InventoryMovement,
  ServiceProduct,
  Package,
  Shift,
  ClientDna,
  PricingRule,
  CalculatedPrice,
  Campaign,
  CalendarGap,
  ZatcaCertificate,
  ZatcaInvoice,
} from '@/types';

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FeedbackItem {
  id: string;
  invoiceId: string;
  rating: number;
  comment: string | null;
  source: string;
  googlePromptShown: boolean;
  googleClicked: boolean;
  followUpStatus: string;
  createdAt: string;
  invoice?: {
    invoiceNumber: string;
    selfOrderId: string | null;
    publicToken: string | null;
  };
}

export interface FeedbackSummary {
  totalCount: number;
  avgRating: number;
  thisMonthCount: number;
  lastMonthCount: number;
  distribution: Record<number, number>;
  satisfactionRate: number;
  googlePromptTotal: number;
  googleClickTotal: number;
  googleClickRate: number;
}


function buildQuery(params: ListParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }
  const str = query.toString();
  return str ? `?${str}` : '';
}

export const dashboardService = {
  getStats: (token: string) =>
    api.get<DashboardStats>('/reports/dashboard', token),

  // ─── Appointments ───
  getAppointments: (params: ListParams, token: string) =>
    api.get<PaginatedResponse<Appointment>>(`/appointments${buildQuery(params)}`, token),

  getAppointment: (id: string, token: string) =>
    api.get<Appointment>(`/appointments/${id}`, token),

  createAppointment: (data: Partial<Appointment>, token: string) =>
    api.post<Appointment>('/appointments', data, token),

  updateAppointment: (id: string, data: Partial<Appointment>, token: string) =>
    api.put<Appointment>(`/appointments/${id}`, data, token),

  changeAppointmentStatus: (id: string, status: string, cancellationReason?: string, token?: string) =>
    api.put<Appointment>(`/appointments/${id}/status`, { status, cancellationReason }, token!),

  cancelAppointment: (id: string, reason: string, token: string) =>
    api.put<Appointment>(`/appointments/${id}/status`, { status: 'cancelled', cancellationReason: reason }, token),

  // ─── Clients ───
  getClients: (params: ListParams, token: string) =>
    api.get<PaginatedResponse<Client>>(`/clients${buildQuery(params)}`, token),

  getClient: (id: string, token: string) =>
    api.get<Client>(`/clients/${id}`, token),

  createClient: (data: Partial<Client>, token: string) =>
    api.post<Client>('/clients', data, token),

  updateClient: (id: string, data: Partial<Client>, token: string) =>
    api.put<Client>(`/clients/${id}`, data, token),

  deleteClient: (id: string, token: string) =>
    api.delete<void>(`/clients/${id}`, token),

  // ─── Employees ───
  getEmployees: (params: ListParams, token: string) =>
    api.get<PaginatedResponse<Employee>>(`/employees${buildQuery(params)}`, token),

  getEmployee: (id: string, token: string) =>
    api.get<Employee>(`/employees/${id}`, token),

  createEmployee: (data: Partial<Employee>, token: string) =>
    api.post<Employee>('/employees', data, token),

  updateEmployee: (id: string, data: Partial<Employee>, token: string) =>
    api.put<Employee>(`/employees/${id}`, data, token),

  deleteEmployee: (id: string, token: string) =>
    api.delete<void>(`/employees/${id}`, token),

  // ─── Services ───
  getServices: (params: ListParams, token: string) =>
    api.get<PaginatedResponse<Service>>(`/services${buildQuery(params)}`, token),

  getService: (id: string, token: string) =>
    api.get<Service>(`/services/${id}`, token),

  createService: (data: Partial<Service>, token: string) =>
    api.post<Service>('/services', data, token),

  updateService: (id: string, data: Partial<Service>, token: string) =>
    api.put<Service>(`/services/${id}`, data, token),

  deleteService: (id: string, token: string) =>
    api.delete<void>(`/services/${id}`, token),

  // ─── Service Categories ───
  getCategories: (token: string) =>
    api.get<ServiceCategory[]>('/services/categories', token),

  createCategory: (data: Partial<ServiceCategory>, token: string) =>
    api.post<ServiceCategory>('/services/categories', data, token),

  updateCategory: (id: string, data: Partial<ServiceCategory>, token: string) =>
    api.put<ServiceCategory>(`/services/categories/${id}`, data, token),

  deleteCategory: (id: string, token: string) =>
    api.delete<void>(`/services/categories/${id}`, token),

  // ─── Invoices ───
  getInvoices: (params: ListParams, token: string) =>
    api.get<PaginatedResponse<Invoice>>(`/invoices${buildQuery(params)}`, token),

  getInvoice: (id: string, token: string) =>
    api.get<Invoice>(`/invoices/${id}`, token),

  createInvoice: (data: Partial<Invoice>, token: string) =>
    api.post<Invoice>('/invoices', data, token),

  addInvoiceDiscount: (
    invoiceId: string,
    data: { type: 'percentage' | 'fixed'; value: number; reason?: string },
    token: string,
  ) => api.post(`/invoices/${invoiceId}/discount`, data, token),

  recordInvoicePayment: (
    invoiceId: string,
    data: { amount: number; method: 'cash' | 'card' | 'bank_transfer' | 'wallet'; reference?: string },
    token: string,
  ) => api.post(`/invoices/${invoiceId}/pay`, data, token),

  sendInvoice: (invoiceId: string, channel: 'whatsapp' | 'email' | 'sms', token: string) =>
    api.post(`/invoices/${invoiceId}/send`, { channel }, token),

  // ─── Inventory ───
  getProducts: (token: string) =>
    api.get<Product[]>('/inventory/products', token),

  createProduct: (data: Partial<Product>, token: string) =>
    api.post<Product>('/inventory/products', data, token),

  updateProduct: (id: string, data: Partial<Product>, token: string) =>
    api.put<Product>(`/inventory/products/${id}`, data, token),

  getProductCategories: (token: string) =>
    api.get<ProductCategory[]>('/inventory/categories', token),

  createProductCategory: (data: Partial<ProductCategory>, token: string) =>
    api.post<ProductCategory>('/inventory/categories', data, token),

  recordMovement: (productId: string, data: Partial<InventoryMovement>, token: string) =>
    api.post<void>(`/inventory/products/${productId}/movements`, data, token),

  getLowStock: (token: string) =>
    api.get<Product[]>('/inventory/low-stock', token),

  linkProductToService: (serviceId: string, data: { productId: string; quantityPerUse: number }, token: string) =>
    api.post<ServiceProduct>(`/inventory/services/${serviceId}/products`, data, token),

  // ─── Packages ───
  getPackages: (token: string) =>
    api.get<Package[]>('/packages', token),

  createPackage: (data: { nameAr: string; nameEn?: string; serviceIds: string[]; packagePrice: number }, token: string) =>
    api.post<Package>('/packages', data, token),

  deletePackage: (id: string, token: string) =>
    api.delete<void>(`/packages/${id}`, token),

  // ─── Shifts ───
  getShifts: (date: string, token: string) =>
    api.get<Shift[]>(`/shifts?date=${date}`, token),

  generateShifts: (data: { startDate?: string }, token: string) =>
    api.post<{ created: number }>('/shifts/generate-week', data, token),

  checkInShift: (shiftId: string, token: string) =>
    api.patch<Shift>(`/shifts/${shiftId}/check-in`, {}, token),

  checkOutShift: (shiftId: string, token: string) =>
    api.patch<Shift>(`/shifts/${shiftId}/check-out`, {}, token),

  // ─── Client DNA ───
  getClientDna: (clientId: string, token: string) =>
    api.get<ClientDna>(`/clients/${clientId}/dna`, token),

  computeClientDna: (clientId: string, token: string) =>
    api.post<void>(`/clients/${clientId}/dna/compute`, {}, token),

  computeAllDna: (token: string) =>
    api.post<{ processed: number }>('/clients/dna/compute-all', {}, token),

  // ─── Dynamic Pricing ───
  getPricingRules: (token: string) =>
    api.get<PricingRule[]>('/pricing/rules', token),

  createPricingRule: (data: Partial<PricingRule>, token: string) =>
    api.post<PricingRule>('/pricing/rules', data, token),

  updatePricingRule: (id: string, data: Partial<PricingRule>, token: string) =>
    api.patch<PricingRule>(`/pricing/rules/${id}`, data, token),

  calculatePrice: (serviceId: string, date: string, time: string, token: string) =>
    api.get<CalculatedPrice>(`/pricing/calculate?serviceId=${serviceId}&date=${date}&time=${time}`, token),

  // ─── Marketing ───
  getCampaigns: (token: string) =>
    api.get<Campaign[]>('/marketing/campaigns', token),

  createCampaign: (data: Partial<Campaign>, token: string) =>
    api.post<Campaign>('/marketing/campaigns', data, token),

  updateCampaign: (id: string, data: Partial<Campaign>, token: string) =>
    api.put<Campaign>(`/marketing/campaigns/${id}`, data, token),

  executeCampaign: (id: string, token: string) =>
    api.post<{ sent: number }>(`/marketing/campaigns/${id}/execute`, {}, token),

  getCalendarGaps: (token: string) =>
    api.get<CalendarGap[]>('/marketing/gaps', token),

  // ─── ZATCA ───
  getZatcaCertificates: (token: string) =>
    api.get<ZatcaCertificate[]>('/zatca/certificates', token),

  onboardZatca: (data: { organizationUnitName?: string; isProduction?: boolean }, token: string) =>
    api.post<ZatcaCertificate>('/zatca/onboard', data, token),

  submitZatcaInvoice: (invoiceId: string, token: string) =>
    api.post<ZatcaInvoice>(`/zatca/invoices/${invoiceId}/submit`, {}, token),

  getZatcaStatus: (invoiceId: string, token: string) =>
    api.get<ZatcaInvoice | null>(`/zatca/invoices/${invoiceId}/status`, token),

  getZatcaQr: (invoiceId: string, token: string) =>
    api.get<string>(`/zatca/invoices/${invoiceId}/qr`, token),

  // ─── Settings ───
  getSettings: (token: string) =>
    api.get<Array<{ key: string; value: string }>>('/settings', token),

  updateSetting: (key: string, value: string, token: string) =>
    api.put<void>(`/settings/${key}`, { value }, token),

  // ─── Feedback ───
  getFeedbacks: (params: ListParams & { minRating?: number; maxRating?: number; followUpStatus?: string; dateFrom?: string; dateTo?: string }, token: string) =>
    api.get<PaginatedResponse<FeedbackItem>>(`/salon/feedback${buildQuery(params)}`, token),

  getFeedbackSummary: (token: string) =>
    api.get<FeedbackSummary>('/salon/feedback/summary', token),

  updateFeedbackStatus: (id: string, status: string, token: string) =>
    api.patch<unknown>(`/salon/feedback/${id}/status`, { status }, token),

  // ─── AI Consultant ───
  askConsultant: (question: string, token: string) =>
    api.post<{ answer: string }>('/salon/ai-consultant/ask', { question }, token),
};
