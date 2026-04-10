import type { Service, Client } from '@/types';

export interface CartItem {
  id: string;
  service: Service;
  quantity: number;
  employeeId: string | null;
  employeeName: string;
  discount: number;
  discountType: 'fixed' | 'percentage';
  note: string;
  bundleId?: string;
}

export interface SplitEntry { method: string; amount: number }

export interface HeldBill {
  id: string;
  label: string;
  cart: CartItem[];
  client: Client | null;
  walkIn: { name: string; phone: string } | null;
  globalDiscount: string;
  globalDiscountType: 'fixed' | 'percentage';
  tip: string;
  time: string;
  total: number;
}

export interface ServiceBundle {
  id: string;
  nameAr: string;
  services: { serviceId: string; employeeId?: string }[];
  price: number;
  savings: number;
}

export type PanelId = null | 'split' | 'hold-list' | 'refund' | 'receipt' | 'bundles' | 'attendance';

export interface AttRec {
  id: string | null;
  employeeId: string;
  checkIn: string | null;
  checkOut: string | null;
  isOnBreak: boolean;
  computedStatus?: string;
  employee: { id: string; fullName: string; role: string };
}
