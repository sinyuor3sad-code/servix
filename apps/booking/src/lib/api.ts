const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface SalonInfo {
  id: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  theme: string;
  themeLayout: 'classic' | 'cards' | 'compact' | 'elegant';
  workingDays: Record<string, { open: boolean; start: string; end: string }>;
}

export interface ServiceCategory {
  id: string;
  nameAr: string;
  nameEn: string | null;
  services: BookingService[];
}

export interface BookingService {
  id: string;
  nameAr: string;
  nameEn: string | null;
  price: number;
  duration: number;
  descriptionAr: string | null;
  imageUrl: string | null;
}

export interface EmployeeServiceInfo {
  id: string;
  nameAr: string;
  nameEn: string | null;
}

export interface BookingEmployee {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  services: EmployeeServiceInfo[];
}

export interface CreateBookingData {
  clientName: string;
  clientPhone: string;
  employeeId: string;
  serviceIds: string[];
  date: string;
  time: string;
  notes?: string;
}

export interface BookingResult {
  id: string;
  date: string;
  time: string;
  status: string;
  services: { nameAr: string; price: number; duration: number }[];
  employee: { fullName: string };
  client: { fullName: string; phone: string };
  totalPrice: number;
  totalDuration: number;
}

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, json.message || 'حدث خطأ');
  }

  return json.data as T;
}

export const bookingApi = {
  getSalonInfo: (slug: string) => fetchApi<SalonInfo>(`/booking/${slug}`),
  getServices: (slug: string) => fetchApi<ServiceCategory[]>(`/booking/${slug}/services`),
  getEmployees: (slug: string) => fetchApi<BookingEmployee[]>(`/booking/${slug}/employees`),
  getAvailableSlots: (slug: string, params: { date: string; employeeId: string; serviceIds: string[] }) =>
    fetchApi<string[]>(`/booking/${slug}/slots?date=${params.date}&employeeId=${params.employeeId}&serviceIds=${params.serviceIds.join(',')}`),
  sendOtp: (slug: string, phone: string) =>
    fetchApi<{ message: string }>(`/booking/${slug}/send-otp`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (slug: string, phone: string, code: string) =>
    fetchApi<{ verified: boolean }>(`/booking/${slug}/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  createBooking: (slug: string, data: CreateBookingData) =>
    fetchApi<BookingResult>(`/booking/${slug}/book`, { method: 'POST', body: JSON.stringify(data) }),
};
