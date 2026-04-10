/**
 * Smart Menu — API Client
 * Calls the public endpoints (no auth required)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/* ─── Types ─── */

export interface MenuSalon {
  nameAr: string;
  nameEn: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  brandColorPreset: string;
  themeLayout: string;
  welcomeMessage: string | null;
  googleMapsUrl: string | null;
  currency: string;
  taxPercentage: number;
}

export interface MenuService {
  id: string;
  nameAr: string;
  nameEn: string | null;
  price: number;
  duration: number;
  categoryId: string;
  imageUrl: string | null;
}

export interface MenuCategory {
  id: string;
  nameAr: string;
  nameEn: string | null;
  services: MenuService[];
}

export interface MenuData {
  salon: MenuSalon;
  categories: MenuCategory[];
}

export interface OrderResult {
  orderCode: string;
  totalEstimate: number;
  expiresAt: string;
  services: Array<{
    serviceId: string;
    nameAr: string;
    nameEn: string | null;
    price: number;
    duration: number;
  }>;
}

export interface OrderStatus {
  id: string;
  orderCode: string;
  status: 'pending' | 'claimed' | 'paid' | 'expired';
  services: Array<{
    serviceId: string;
    nameAr: string;
    nameEn: string | null;
    price: number;
    duration: number;
  }>;
  totalEstimate: number;
  expiresAt: string;
  createdAt: string;
  invoicePublicToken?: string;
  invoiceNumber?: string;
}

/* ─── Invoice Types ─── */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceDetails {
  invoiceNumber: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAt: string | null;
  items: InvoiceItem[];
}

export interface InvoiceData {
  salon: MenuSalon;
  invoice: InvoiceDetails;
  feedback: { rating: number; comment: string | null; createdAt: string } | null;
}

/* ─── Fetch Wrapper ─── */

class MenuApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'MenuApiError';
  }
}

async function fetchPublic<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new MenuApiError(res.status, json.message || 'حدث خطأ');
  }

  // API wraps in { data: ... } or returns directly
  return (json.data ?? json) as T;
}

/* ─── API Methods ─── */

export const menuApi = {
  /** Fetch salon info + categories + services */
  getMenu: (slug: string) =>
    fetchPublic<MenuData>(`/public/${slug}/menu`),

  /** Create a self-service order */
  createOrder: (slug: string, serviceIds: string[]) =>
    fetchPublic<OrderResult>(`/public/${slug}/order`, {
      method: 'POST',
      body: JSON.stringify({
        services: serviceIds.map((id) => ({ serviceId: id })),
      }),
    }),

  /** Get order status by code */
  getOrderStatus: (slug: string, code: string) =>
    fetchPublic<OrderStatus>(`/public/${slug}/order/${code}`),

  /** Fetch public invoice by token */
  getInvoice: (slug: string, token: string) =>
    fetchPublic<InvoiceData>(`/public/${slug}/invoice/${token}`),

  /** Submit feedback for an invoice */
  submitFeedback: (slug: string, token: string, data: { rating: number; comment?: string; googlePromptShown?: boolean }) =>
    fetchPublic<{ success: boolean }>(`/public/${slug}/invoice/${token}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Track Google Maps click */
  trackGoogleClick: (slug: string, token: string) =>
    fetchPublic<{ success: boolean }>(`/public/${slug}/invoice/${token}/google-click`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

