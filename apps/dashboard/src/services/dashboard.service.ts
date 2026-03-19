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
} from '@/types';

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
    api.get<DashboardStats>('/dashboard/stats', token),

  // ─── Appointments ───
  getAppointments: (params: ListParams, token: string) =>
    api.get<PaginatedResponse<Appointment>>(`/appointments${buildQuery(params)}`, token),

  getAppointment: (id: string, token: string) =>
    api.get<Appointment>(`/appointments/${id}`, token),

  createAppointment: (data: Partial<Appointment>, token: string) =>
    api.post<Appointment>('/appointments', data, token),

  updateAppointment: (id: string, data: Partial<Appointment>, token: string) =>
    api.put<Appointment>(`/appointments/${id}`, data, token),

  cancelAppointment: (id: string, reason: string, token: string) =>
    api.post<Appointment>(`/appointments/${id}/cancel`, { reason }, token),

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
};
