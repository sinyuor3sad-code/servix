'use client';

import { useState, useMemo, useCallback, useEffect, useDeferredValue, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  dashboardService,
  type PosCheckoutPaymentMethod,
  type PosCheckoutRequest,
  type PosReceiptSnapshot,
} from '@/services/dashboard.service';
import { api } from '@/lib/api';
import type { Service, Client, Employee, PaginatedResponse, ServiceCategory } from '@/types';
import type { CartItem, SplitEntry, HeldBill, PanelId, PosShiftData } from './pos-types';
import {
  uid, now, fmt, DEFAULT_FAVS,
} from './pos-constants';
import { playBeep, playSuccess, playError } from './pos-sounds';

/* ═══════════════════════════════════════════════════════════════════════════════
   SMART DEVICE DETECTION
   Combines: maxTouchPoints + matchMedia(pointer/hover) + UA + screen width
   Runs once on mount — no manual toggle needed
   ═══════════════════════════════════════════════════════════════════════════════ */

export function useDeviceMode() {
  const [mode, setMode] = useState<'desktop' | 'touch' | null>(null);
  useEffect(() => {
    const tp = navigator.maxTouchPoints || 0;
    const hasTouch = tp > 0 || 'ontouchstart' in window;
    const ua = navigator.userAgent;
    const mobile = /iPhone|iPod|Android.*Mobile|webOS|BlackBerry/i.test(ua);
    const tablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua);
    const iPadOS = /Macintosh/i.test(ua) && tp > 1;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    const narrow = window.innerWidth < 1024;
    const touchDevice = mobile || tablet || iPadOS || (hasTouch && coarse && noHover);
    setMode((touchDevice || (narrow && hasTouch)) ? 'touch' : 'desktop');
  }, []);
  return mode;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   POS ENGINE — Shared business logic for both layouts
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ── localStorage helpers (SSR-safe) ── */
function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

const toMoneyCents = (value: unknown) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const paymentMethodForApi = (method: string) =>
  method as PosCheckoutPaymentMethod;

const isCashLikeMethod = (method: string) => method === 'cash';

export type POSPaymentGuardInput = {
  cartCount: number;
  total: number;
  method: string;
  cashReceived?: string | number;
  discountNeedsReason: boolean;
  discountExceedsLimit: boolean;
  pinOverrideApproved: boolean;
  couponCode?: string;
  couponApplied: boolean;
  couponPending: boolean;
  couponChangedSinceValidation?: boolean;
  splits?: SplitEntry[];
};

type CouponValidationRequest = {
  code: string;
  scopeKey: string;
};

type CouponValidationResponse = {
  valid: boolean;
  discountAmount: number;
  message: string;
  scopeKey: string;
};

type ReceiptSnapshot = {
  source?: 'server' | 'legacy';
  invoiceId?: string;
  invoiceNumber?: string;
  publicToken?: string;
  issuedAt?: string;
  items: Array<{ id: string; name: string; quantity: number; amount: number }>;
  clientName?: string;
  subtotal: number;
  discount: number;
  couponDiscount: number;
  tax: number;
  taxRate: number;
  total: number;
  method: string;
  cashReceived: string;
};

type POSCheckoutPayloadInput = {
  idempotencyKey: string;
  terminalId: string;
  shiftId: string;
  cart: CartItem[];
  fallbackEmployeeId: string;
  client: Client | null;
  walkInMode: boolean;
  walkName: string;
  walkPhone: string;
  appointmentId?: string | null;
  selfOrderId?: string | null;
  manualDiscount?: {
    type: 'percentage' | 'fixed';
    value: number;
    reason: string;
  };
  couponCode?: string;
  loyaltyRedemption?: {
    type: 'points' | 'visits';
    value: number;
  };
  payments: PosCheckoutRequest['payments'];
  notes?: string;
  managerApprovalToken?: string;
};

type CheckoutAttemptRef = {
  key: string;
  fingerprint: string;
};

type CheckoutDiagnosticSource = 'pos' | 'quick-pos';
type CheckoutDiagnosticStatus = 'started' | 'completed' | 'failed' | 'blocked';
type CheckoutDiagnosticWarning = 'preview_total_mismatch';

export type CheckoutDiagnostic = {
  source: CheckoutDiagnosticSource;
  status: CheckoutDiagnosticStatus;
  at: string;
  idempotencyKey?: string;
  terminalId?: string;
  shiftId?: string;
  previewTotal?: number;
  serverTotal?: number;
  paymentMethods: string[];
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  warning?: CheckoutDiagnosticWarning;
};

type CheckoutRequestDiagnosticMeta = {
  source: CheckoutDiagnosticSource;
  startedAtMs: number;
  idempotencyKey: string;
  terminalId: string;
  shiftId: string;
  previewTotal: number;
  paymentMethods: string[];
};

export function isAtomicPOSCheckoutEnabled(
  raw = process.env.NEXT_PUBLIC_POS_ATOMIC_CHECKOUT_ENABLED,
): boolean {
  return raw !== 'false' && raw !== '0';
}

export function checkoutTotalsMismatch(previewTotal: number | undefined, serverTotal: number | undefined): boolean {
  if (previewTotal == null || serverTotal == null) return false;
  return toMoneyCents(previewTotal) !== toMoneyCents(serverTotal);
}

export function buildCheckoutDiagnostic(input: {
  source: CheckoutDiagnosticSource;
  status: CheckoutDiagnosticStatus;
  startedAtMs?: number;
  idempotencyKey?: string;
  terminalId?: string;
  shiftId?: string;
  previewTotal?: number;
  serverTotal?: number;
  paymentMethods?: string[];
  errorCode?: string;
  errorMessage?: string;
  warning?: CheckoutDiagnosticWarning;
}): CheckoutDiagnostic {
  const nowMs = Date.now();
  return {
    source: input.source,
    status: input.status,
    at: new Date(nowMs).toISOString(),
    idempotencyKey: input.idempotencyKey,
    terminalId: input.terminalId,
    shiftId: input.shiftId,
    previewTotal: input.previewTotal,
    serverTotal: input.serverTotal,
    paymentMethods: input.paymentMethods ?? [],
    durationMs: input.startedAtMs ? Math.max(0, nowMs - input.startedAtMs) : undefined,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    warning: input.warning,
  };
}

export function appendCheckoutDiagnostic(
  history: CheckoutDiagnostic[],
  diagnostic: CheckoutDiagnostic,
  limit = 20,
): CheckoutDiagnostic[] {
  return [diagnostic, ...history].slice(0, limit);
}

export function logCheckoutDiagnostic(diagnostic: CheckoutDiagnostic): void {
  if (
    diagnostic.status === 'completed'
    && diagnostic.warning !== 'preview_total_mismatch'
  ) return;

  console.warn('[pos.checkout.diagnostic]', {
    source: diagnostic.source,
    status: diagnostic.status,
    idempotencyKey: diagnostic.idempotencyKey,
    terminalId: diagnostic.terminalId,
    shiftId: diagnostic.shiftId,
    previewTotal: diagnostic.previewTotal,
    serverTotal: diagnostic.serverTotal,
    paymentMethods: diagnostic.paymentMethods,
    durationMs: diagnostic.durationMs,
    errorCode: diagnostic.errorCode,
    errorMessage: diagnostic.errorMessage,
    warning: diagnostic.warning,
  });
}

export function createPOSCheckoutIdempotencyKey(prefix = 'pos'): string {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
}

export function buildPOSCheckoutPayload(input: POSCheckoutPayloadInput): PosCheckoutRequest {
  const walkName = input.walkName.trim();
  const walkPhone = input.walkPhone.trim();
  const couponCode = input.couponCode?.trim().toUpperCase();
  const source = input.appointmentId
    ? { type: 'appointment' as const, id: input.appointmentId }
    : input.selfOrderId
      ? { type: 'self_order' as const, id: input.selfOrderId }
      : undefined;

  return {
    idempotencyKey: input.idempotencyKey,
    terminalId: input.terminalId,
    shiftId: input.shiftId,
    ...(input.client?.id
      ? { clientId: input.client.id }
      : input.walkInMode && walkName && walkPhone
        ? { walkIn: { fullName: walkName, phone: walkPhone } }
        : { anonymous: true }),
    ...(source ? { source } : {}),
    items: input.cart.map((item) => ({
      serviceId: item.service.id,
      employeeId: item.employeeId || input.fallbackEmployeeId,
      quantity: item.quantity,
    })),
    ...(input.manualDiscount ? { manualDiscount: input.manualDiscount } : {}),
    ...(couponCode ? { couponCode } : {}),
    ...(input.loyaltyRedemption ? { loyaltyRedemption: input.loyaltyRedemption } : {}),
    payments: input.payments,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.managerApprovalToken ? { managerApprovalToken: input.managerApprovalToken } : {}),
  };
}

export function buildPOSCheckoutPayments(input: {
  method: string;
  total: number;
  splits: SplitEntry[];
  cashReceived: string | number;
}): PosCheckoutRequest['payments'] {
  if (input.method !== 'split') {
    const method = paymentMethodForApi(input.method);
    return [{
      method,
      amount: input.total,
      ...(isCashLikeMethod(input.method) ? { cashReceived: Number(input.cashReceived) } : {}),
    }];
  }

  const byMethod = new Map<PosCheckoutPaymentMethod, number>();
  for (const split of input.splits) {
    if (toMoneyCents(split.amount) <= 0) continue;
    const method = paymentMethodForApi(split.method);
    byMethod.set(method, (byMethod.get(method) ?? 0) + split.amount);
  }

  return Array.from(byMethod.entries()).map(([method, amount]) => ({
    method,
    amount,
    ...(method === 'cash' ? { cashReceived: Number(input.cashReceived) } : {}),
  }));
}

export function normalizeServerReceiptSnapshot(
  snapshot: PosReceiptSnapshot,
  fallbackMethod: string,
): ReceiptSnapshot {
  const payments = snapshot.payments ?? [];
  const cashReceived = payments
    .filter((payment) => payment.method === 'cash' && payment.cashReceived != null)
    .reduce((sum, payment) => sum + Number(payment.cashReceived ?? 0), 0);
  const method = payments.length > 1
    ? 'split'
    : String(payments[0]?.method ?? fallbackMethod);
  const manualDiscount = (snapshot.discounts ?? [])
    .filter((discount) => discount.kind === 'manual' || discount.kind === 'loyalty')
    .reduce((sum, discount) => sum + Number(discount.amount ?? 0), 0);
  const couponDiscount = (snapshot.discounts ?? [])
    .filter((discount) => discount.kind === 'coupon')
    .reduce((sum, discount) => sum + Number(discount.amount ?? 0), 0);

  return {
    source: 'server',
    invoiceId: snapshot.invoiceId,
    invoiceNumber: snapshot.invoiceNumber,
    publicToken: snapshot.publicToken,
    issuedAt: snapshot.issuedAt,
    items: (snapshot.items ?? []).map((item, index) => ({
      id: item.serviceId ?? `${index}`,
      name: item.description ?? item.serviceId ?? '',
      quantity: Number(item.quantity ?? 0),
      amount: Number(item.total ?? 0),
    })),
    clientName: snapshot.client?.fullName,
    subtotal: Number(snapshot.subtotal ?? 0),
    discount: manualDiscount,
    couponDiscount,
    tax: Number(snapshot.taxAmount ?? 0),
    taxRate: Number(snapshot.taxRatePercent ?? 0) / 100,
    total: Number(snapshot.total ?? 0),
    method,
    cashReceived: cashReceived > 0 ? String(cashReceived) : '',
  };
}

export function checkoutFingerprint(payload: PosCheckoutRequest): string {
  const { idempotencyKey: _idempotencyKey, ...rest } = payload;
  return JSON.stringify(rest);
}

export function evaluatePOSPaymentGuard(input: POSPaymentGuardInput): { ok: boolean; message?: string } {
  const totalCents = toMoneyCents(input.total);
  if (input.cartCount <= 0) return { ok: false, message: 'أكمل بيانات العميل' };
  if (totalCents <= 0) return { ok: false, message: 'المبلغ غير صالح' };
  if (input.discountNeedsReason) return { ok: false, message: 'سبب الخصم مطلوب' };
  // TODO/RISK Phase 2: manager approval must be server-side with audit log.
  // A local PIN must not override financial guards.
  if (input.discountExceedsLimit) return { ok: false, message: 'Server manager approval is required for this discount' };
  if (input.couponPending) return { ok: false, message: 'انتظر التحقق من الكوبون' };
  if ((input.couponCode ?? '').trim() && !input.couponApplied) return { ok: false, message: 'تحقق من الكوبون أو احذفه قبل الدفع' };
  if (input.couponApplied && input.couponChangedSinceValidation) return { ok: false, message: 'Coupon must be revalidated after cart changes' };

  if (input.method === 'split') {
    const splits = input.splits ?? [];
    if (!splits.some((entry) => toMoneyCents(entry.amount) > 0)) {
      return { ok: false, message: 'أدخل مبالغ الدفع المقسم' };
    }
    if (splits.some((entry) => Number(entry.amount) < 0)) {
      return { ok: false, message: 'مبالغ الدفع المقسم غير صالحة' };
    }

    const splitTotalCents = splits.reduce((sum, entry) => sum + toMoneyCents(entry.amount), 0);
    if (splitTotalCents < totalCents) return { ok: false, message: 'الدفع المقسم أقل من الإجمالي' };
    if (splitTotalCents > totalCents) return { ok: false, message: 'الدفع المقسم أعلى من الإجمالي' };

    const cashSplitCents = splits.reduce(
      (sum, entry) => sum + (isCashLikeMethod(entry.method) ? toMoneyCents(entry.amount) : 0),
      0,
    );
    if (cashSplitCents > 0 && toMoneyCents(input.cashReceived) < cashSplitCents) {
      return { ok: false, message: 'المبلغ النقدي المستلم أقل من النقد المطلوب' };
    }
    return { ok: true };
  }

  if (isCashLikeMethod(input.method) && toMoneyCents(input.cashReceived) < totalCents) {
    return { ok: false, message: 'المبلغ النقدي المستلم أقل من الإجمالي' };
  }

  return { ok: true };
}

export function usePOSEngine() {
  const { accessToken, isOwner, userRole } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selCat, setSelCat] = useState<string | null>(null);
  const [svcSearch, setSvcSearch] = useState('');
  const [cliSearch, setCliSearch] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [globalDisc, setGlobalDisc] = useState('');
  const [globalDiscType, setGlobalDiscType] = useState<'fixed' | 'percentage'>('fixed');
  const [custNote, setCustNote] = useState('');
  const [walkName, setWalkName] = useState('');
  const [walkPhone, setWalkPhone] = useState('');
  const [walkInMode, setWalkInMode] = useState(false);
  const [selfOrderId, setSelfOrderId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelId>(null);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [refId, setRefId] = useState('');
  const [refReason, setRefReason] = useState('');
  const [online, setOnline] = useState(true);
  const [favIds, setFavIds] = useState<string[]>(() => lsGet<string[]>('pos_favs', DEFAULT_FAVS));
  const [showFavs, setShowFavs] = useState(false);
  const [showAppointments, setShowAppointments] = useState(false);
  const queryClient = useQueryClient();
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [lastPaidMethod, setLastPaidMethod] = useState<string>('cash');
  const [receiptLogo, setReceiptLogo] = useState(true);
  const [receiptMsg, setReceiptMsg] = useState('شكراً لزيارتكم');
  const [receiptPhone, setReceiptPhone] = useState('+966501234567');
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [lastPaidTotal, setLastPaidTotal] = useState(0);
  const [lastPaidSnapshot, setLastPaidSnapshot] = useState<ReceiptSnapshot | null>(null);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);
  const [lastCheckoutDiagnostic, setLastCheckoutDiagnostic] = useState<CheckoutDiagnostic | null>(null);
  const [checkoutDiagnostics, setCheckoutDiagnostics] = useState<CheckoutDiagnostic[]>([]);
  const [selectedPayMethod, setSelectedPayMethod] = useState<string>('cash');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMsg, setCouponMsg] = useState('');
  const [couponValidationScopeKey, setCouponValidationScopeKey] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [pinOverrideApproved, setPinOverrideApproved] = useState(false);
  const [managerApproval, setManagerApproval] = useState<{ token: string; approverName: string; expiresAt: string } | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  const [todaySales, setTodaySales] = useState(0);
  const [todayInvoices, setTodayInvoices] = useState(0);
  const [terminalId] = useState(() => {
    const key = 'pos_terminal_id';
    let id = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!id) {
      id = `T-${Date.now().toString(36)}`;
      if (typeof window !== 'undefined') localStorage.setItem(key, id);
    }
    return id;
  });
  const checkoutAttemptRef = useRef<CheckoutAttemptRef | null>(null);
  const checkoutRequestMetaRef = useRef<CheckoutRequestDiagnosticMeta | null>(null);

  const dSearch = useDeferredValue(svcSearch);

  /* ── Persist favourites to localStorage ── */
  useEffect(() => { lsSet('pos_favs', favIds); }, [favIds]);

  /* ── Offline ── */
  useEffect(() => {
    const on = () => { setOnline(true); toast.success('تم استعادة الاتصال'); };
    const off = () => { setOnline(false); toast.error('انقطع الاتصال — وضع غير متصل'); };
    setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Loyalty: fetch points when client changes ── */
  useEffect(() => {
    if (!client || !accessToken || client.fullName === 'زائر') { setLoyaltyPoints(null); return; }
    api.get(`/loyalty/clients/${client.id}`, accessToken)
      .then((res: unknown) => {
        const r = res as Record<string, unknown>;
        const d = r?.data as Record<string, unknown> | undefined;
        setLoyaltyPoints(Number(d?.points ?? (r as Record<string, unknown>)?.points ?? 0));
      })
      .catch(() => setLoyaltyPoints(null));
  }, [client, accessToken]);

  /* ── Queries ── */
  const { data: cats } = useQuery<ServiceCategory[]>({
    queryKey: ['pos-cats'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });
  const { data: svcsData } = useQuery({
    queryKey: ['pos-svcs'],
    queryFn: () => dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });
  const { data: empData } = useQuery({
    queryKey: ['pos-emp'],
    queryFn: () => dashboardService.getEmployees({ limit: 50 }, accessToken!),
    enabled: !!accessToken,
  });
  const { data: currentShift } = useQuery<PosShiftData | null>({
    queryKey: ['pos-shift-current'],
    queryFn: async () => {
      try {
        return await api.get<PosShiftData>('/pos-shifts/current', accessToken!);
      } catch {
        return null;
      }
    },
    enabled: !!accessToken,
    retry: false,
    refetchOnWindowFocus: false,
  });

  /* ── Salon info (for dynamic tax) ── */
  const { data: salonInfo } = useQuery({
    queryKey: ['pos-salon-info'],
    queryFn: () => api.get('/salon', accessToken!),
    enabled: !!accessToken,
  });

  const taxRate = useMemo(() => {
    const si = salonInfo as Record<string, unknown> | undefined;
    const d = si?.data as Record<string, unknown> | undefined;
    const pct = d?.taxPercentage ?? si?.taxPercentage;
    return pct ? Number(pct) / 100 : 0.15;
  }, [salonInfo]);

  /* ── Receipt settings (server-backed; sync into local state on load) ── */
  const { data: salonSettings } = useQuery({
    queryKey: ['pos-salon-settings'],
    queryFn: () => api.get<Record<string, string>>('/settings', accessToken!),
    enabled: !!accessToken,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!salonSettings) return;
    if (salonSettings.pos_receipt_show_logo !== undefined) setReceiptLogo(salonSettings.pos_receipt_show_logo === 'true');
    if (salonSettings.pos_receipt_message !== undefined) setReceiptMsg(salonSettings.pos_receipt_message);
    if (salonSettings.pos_receipt_phone !== undefined) setReceiptPhone(salonSettings.pos_receipt_phone);
  }, [salonSettings]);

  const { data: cliApi } = useQuery({
    queryKey: ['pos-cli', cliSearch],
    queryFn: () => dashboardService.getClients({ search: cliSearch, limit: 5 }, accessToken!),
    enabled: !!accessToken && cliSearch.length >= 2 && !walkInMode,
  });

  const cliResults = cliApi?.items ?? [];
  const allSvcs = useMemo(() => svcsData?.items ?? [], [svcsData]);
  const emps = useMemo(() => empData?.items ?? [], [empData]);

  const filtered = useMemo(() => {
    let s = allSvcs.filter(x => x.isActive);
    if (selCat) s = s.filter(x => x.categoryId === selCat);
    if (dSearch) { const q = dSearch.toLowerCase(); s = s.filter(x => x.nameAr.includes(q) || (x.nameEn?.toLowerCase() ?? '').includes(q)); }
    return s;
  }, [allSvcs, selCat, dSearch]);

  const favSvcs = useMemo(() => allSvcs.filter(s => favIds.includes(s.id)), [allSvcs, favIds]);

  /* ── Pending service (for employee popover) ── */
  const [pendingService, setPendingService] = useState<Service | null>(null);

  /* ── Cart ops ── */
  const confirmAdd = useCallback((svc: Service, emp: Employee | null) => {
    setCart(prev => {
      const ex = prev.find(i => i.service.id === svc.id && i.employeeId === (emp?.id ?? null));
      if (ex) return prev.map(i => i.id === ex.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: uid(), service: svc, quantity: 1, employeeId: emp?.id ?? null, employeeName: emp?.fullName ?? 'غير محدد', discount: 0, discountType: 'fixed' as const, note: '' }];
    });
    setPendingService(null);
    playBeep();
  }, []);

  const addToCart = useCallback((svc: Service) => {
    // If only 1 employee, auto-assign; if 0, add without employee
    if (emps.length <= 1) {
      confirmAdd(svc, emps[0] ?? null);
    } else {
      setPendingService(svc);
    }
  }, [emps, confirmAdd]);

  const updateQty = useCallback((id: string, d: number) => {
    setCart(p => p.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + d) } : i).filter(i => i.quantity > 0));
  }, []);
  const removeItem = useCallback((id: string) => setCart(p => p.filter(i => i.id !== id)), []);
  const toggleFav = useCallback((svcId: string) => setFavIds(p => p.includes(svcId) ? p.filter(x => x !== svcId) : [...p, svcId]), []);
  const setItemEmp = useCallback((id: string, emp: Employee) => setCart(p => p.map(i => i.id === id ? { ...i, employeeId: emp.id, employeeName: emp.fullName } : i)), []);
  const setItemDisc = useCallback((id: string, val: number, type: 'fixed' | 'percentage') => setCart(p => p.map(i => i.id === id ? { ...i, discount: val, discountType: type } : i)), []);
  const setItemNote = useCallback((id: string, note: string) => setCart(p => p.map(i => i.id === id ? { ...i, note } : i)), []);

  const clearAll = useCallback(() => {
    setCart([]); setClient(null); setWalkName(''); setWalkPhone('');
    setWalkInMode(false); setGlobalDisc(''); setCustNote('');
    setSelfOrderId(null); setPublicToken(null); setShowQRModal(false);
    setSelectedPayMethod('cash'); setCashReceived('');
    setCouponCode(''); setCouponDiscount(0); setCouponApplied(false); setCouponMsg('');
    setDiscountReason(''); setPinOverrideApproved(false);
    setAppointmentId(null);
  }, []);

  /* ── Calculations ── */
  const itemTotals = useMemo(() => cart.map(item => {
    const line = item.service.price * item.quantity;
    const d = item.discount > 0 ? (item.discountType === 'percentage' ? line * item.discount / 100 : Math.min(line, item.discount)) : 0;
    return { id: item.id, line, d, net: line - d };
  }), [cart]);

  const subtotal = useMemo(() => itemTotals.reduce((s, i) => s + i.net, 0), [itemTotals]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const gDiscVal = useMemo(() => {
    const v = parseFloat(globalDisc);
    if (isNaN(v) || v <= 0) return 0;
    return globalDiscType === 'percentage' ? Math.min(subtotal, subtotal * v / 100) : Math.min(subtotal, v);
  }, [globalDisc, globalDiscType, subtotal]);

  const afterDisc = Math.max(0, subtotal - gDiscVal);
  const afterCoupon = Math.max(0, afterDisc - couponDiscount);
  const tax = afterCoupon * taxRate;
  const total = afterCoupon + tax;

  /* ── Redeem loyalty (simple: all points → 1 SAR per 10 pts) ── */
  const redeemLoyalty = useCallback(() => {
    if (!loyaltyPoints || loyaltyPoints <= 0) return;
    const value = Math.floor(loyaltyPoints / 10);
    if (value <= 0) { toast.error('النقاط غير كافية للاستبدال'); return; }
    setGlobalDisc(String(value));
    setGlobalDiscType('fixed');
    setDiscountReason('استبدال نقاط ولاء');
    toast.success(`تم تطبيق خصم ${value} ر.س من ${loyaltyPoints} نقطة`);
  }, [loyaltyPoints]);

  /* ── Change calculator ── */
  const changeAmount = useMemo(() => {
    const received = parseFloat(cashReceived);
    if (isNaN(received)) return 0;
    return received - total;
  }, [cashReceived, total]);

  /* ── Discount protection ── */
  const maxDiscountPercent = useMemo(() => {
    if (isOwner) return 100;
    if (userRole === 'manager') return 50;
    return 10;
  }, [isOwner, userRole]);

  // Check if current discount exceeds the role limit. Manager-approved
  // overrides clear this flag so the cashier can complete the sale.
  const discountExceedsLimit = useMemo(() => {
    if (managerApproval) return false;
    const v = parseFloat(globalDisc);
    if (isNaN(v) || v <= 0) return false;
    if (globalDiscType === 'percentage') return v > maxDiscountPercent;
    if (subtotal <= 0) return false;
    return (v / subtotal) * 100 > maxDiscountPercent;
  }, [globalDisc, globalDiscType, maxDiscountPercent, subtotal, managerApproval]);

  // Auto-expire manager approval after its TTL or when a cart change pushes
  // the discount above the approved percent (server-side tolerance is 0.5%).
  useEffect(() => {
    if (!managerApproval) return;
    if (Date.now() > new Date(managerApproval.expiresAt).getTime()) {
      setManagerApproval(null);
    }
  }, [cart, globalDisc, globalDiscType, managerApproval]);

  // Discount needs reason to proceed
  const discountNeedsReason = useMemo(() => {
    return gDiscVal > 0 && !discountReason.trim();
  }, [gDiscVal, discountReason]);

  /* ── Load Appointment into cart ── */
  const loadAppointment = useCallback((appt: { id: string; client: { id: string; fullName: string; phone: string } | null; appointmentServices: Array<{ serviceId: string; employeeId?: string; employee?: { id: string; fullName: string } }>; }) => {
    clearAll();
    if (appt.client) setClient(appt.client as Client);
    let loaded = 0;
    for (const as of appt.appointmentServices) {
      const svc = allSvcs.find(s => s.id === as.serviceId);
      if (!svc) { toast.error(`خدمة محذوفة — تم تجاهلها`); continue; }
      const emp = as.employeeId ? emps.find(e => e.id === as.employeeId) : (as.employee ? emps.find(e => e.id === as.employee!.id) : (emps[0] ?? null));
      setCart(prev => [...prev, {
        id: uid(),
        service: svc,
        quantity: 1,
        employeeId: emp?.id ?? null,
        employeeName: emp?.fullName ?? 'غير محدد',
        discount: 0,
        discountType: 'fixed' as const,
        note: '',
      }]);
      loaded++;
    }
    setAppointmentId(appt.id);
    setShowAppointments(false);
    toast.success(`تم تحميل موعد ${appt.client?.fullName ?? 'عميلة'} — ${loaded} خدمات`);
  }, [clearAll, allSvcs, emps]);

  const couponScopeKey = useMemo(() => JSON.stringify({
    clientId: client?.id ?? null,
    walkInMode,
    items: cart.map((item) => ({
      serviceId: item.service.id,
      quantity: item.quantity,
      discount: item.discount,
      discountType: item.discountType,
    })),
    globalDisc,
    globalDiscType,
  }), [cart, client?.id, walkInMode, globalDisc, globalDiscType]);

  /* ── Coupon validation ── */
  const couponMut = useMutation({
    mutationFn: async ({ code, scopeKey }: CouponValidationRequest): Promise<CouponValidationResponse> => {
      const result = await api.post<{ valid: boolean; discountAmount: number; message: string }>('/coupons/validate', { code: code.toUpperCase(), orderAmount: afterDisc }, accessToken!);
      return { ...result, scopeKey };
    },
    onSuccess: (res) => {
      if (res.valid) {
        setCouponDiscount(res.discountAmount);
        setCouponApplied(true);
        setCouponMsg(res.message);
        setCouponValidationScopeKey(res.scopeKey);
        toast.success(res.message);
      } else {
        setCouponDiscount(0);
        setCouponApplied(false);
        setCouponMsg(res.message);
        setCouponValidationScopeKey(null);
        toast.error(res.message);
      }
    },
    onError: () => { toast.error('خطأ في التحقق من الكوبون'); },
  });

  const applyCoupon = useCallback(() => {
    if (!couponCode.trim()) return;
    couponMut.mutate({ code: couponCode.trim(), scopeKey: couponScopeKey });
  }, [couponCode, couponMut, couponScopeKey]);

  const removeCoupon = useCallback(() => {
    setCouponCode(''); setCouponDiscount(0); setCouponApplied(false); setCouponMsg('');
    setCouponValidationScopeKey(null);
  }, []);

  const lastCouponScopeKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastCouponScopeKey.current === null) {
      lastCouponScopeKey.current = couponScopeKey;
      return;
    }
    if (lastCouponScopeKey.current === couponScopeKey) return;
    lastCouponScopeKey.current = couponScopeKey;
    if (couponCode || couponApplied || couponDiscount > 0 || couponMsg) removeCoupon();
  }, [couponScopeKey, couponCode, couponApplied, couponDiscount, couponMsg, removeCoupon]);

  // Auto-apply coupon after 500ms debounce when code is >= 3 chars
  useEffect(() => {
    if (couponApplied || couponCode.trim().length < 3) return;
    const timer = setTimeout(() => {
      couponMut.mutate({ code: couponCode.trim(), scopeKey: couponScopeKey });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponCode]);

  /* ── Commission ── */
  const comms = useMemo(() => {
    const m = new Map<string, { name: string; amount: number; rate: number; type: string }>();
    cart.forEach(item => {
      if (!item.employeeId) return;
      const emp = emps.find(e => e.id === item.employeeId);
      if (!emp || emp.commissionType === 'none') return;
      const net = itemTotals.find(t => t.id === item.id)?.net ?? 0;
      const c = emp.commissionType === 'percentage' ? net * emp.commissionValue / 100 : emp.commissionValue * item.quantity;
      const ex = m.get(emp.id);
      if (ex) ex.amount += c; else m.set(emp.id, { name: emp.fullName, amount: c, rate: emp.commissionValue, type: emp.commissionType });
    });
    return Array.from(m.values());
  }, [cart, emps, itemTotals]);

  const totalComm = useMemo(() => comms.reduce((s, c) => s + c.amount, 0), [comms]);

  /* ── Hold / Recall (server-backed) ── */
  type HeldBillRow = {
    id: string;
    label: string;
    cart: Array<{
      id: string;
      serviceId: string;
      serviceName: string;
      quantity: number;
      unitPrice: number;
      employeeId?: string | null;
      employeeName?: string;
      discount?: number;
      discountType?: 'fixed' | 'percentage';
      note?: string;
    }>;
    clientId: string | null;
    walkInName: string | null;
    walkInPhone: string | null;
    globalDiscount: string;
    globalDiscountType: 'fixed' | 'percentage';
    total: number;
    createdAt: string;
    client?: { id: string; fullName: string; phone: string } | null;
  };

  const heldEnabled = !!accessToken && currentShift?.status === 'open';

  const { data: heldData } = useQuery<HeldBillRow[]>({
    queryKey: ['pos-held-bills'],
    queryFn: () => api.get<HeldBillRow[]>('/pos-shifts/held-bills', accessToken!),
    enabled: heldEnabled,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const held = useMemo<HeldBill[]>(() => {
    const rows = heldData ?? [];
    return rows.map((row) => {
      const cart: CartItem[] = row.cart
        .map((entry) => {
          const svc = allSvcs.find((s) => s.id === entry.serviceId)
            ?? ({
              id: entry.serviceId,
              nameAr: entry.serviceName,
              nameEn: '',
              price: entry.unitPrice,
              duration: 0,
              isActive: true,
              categoryId: '',
              sortOrder: 0,
            } as unknown as Service);
          return {
            id: entry.id,
            service: svc,
            quantity: entry.quantity,
            employeeId: entry.employeeId ?? null,
            employeeName: entry.employeeName ?? 'غير محدد',
            discount: entry.discount ?? 0,
            discountType: entry.discountType ?? 'fixed',
            note: entry.note ?? '',
          };
        });
      return {
        id: row.id,
        label: row.label,
        cart,
        client: row.client ? ({ id: row.client.id, fullName: row.client.fullName, phone: row.client.phone } as Client) : null,
        walkIn: row.walkInName ? { name: row.walkInName, phone: row.walkInPhone ?? '' } : null,
        globalDiscount: row.globalDiscount,
        globalDiscountType: row.globalDiscountType,
        time: new Date(row.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        total: row.total,
      };
    });
  }, [heldData, allSvcs]);

  const holdMut = useMutation({
    mutationFn: () => {
      const shiftId = currentShift?.id;
      if (!shiftId) throw new Error('Open POS shift is required');
      const payload = {
        shiftId,
        terminalId,
        label: (client?.fullName ?? walkName) || `فاتورة ${now()}`,
        cart: cart.map((item) => ({
          id: item.id,
          serviceId: item.service.id,
          serviceName: item.service.nameAr,
          quantity: item.quantity,
          unitPrice: Number(item.service.price),
          employeeId: item.employeeId ?? undefined,
          employeeName: item.employeeName,
          discount: item.discount,
          discountType: item.discountType,
          note: item.note,
        })),
        clientId: client?.id,
        walkInName: walkInMode ? walkName : undefined,
        walkInPhone: walkInMode ? walkPhone : undefined,
        globalDiscount: globalDisc,
        globalDiscountType: globalDiscType,
        total,
      };
      return api.post('/pos-shifts/held-bills', payload, accessToken!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-held-bills'] });
      clearAll();
      toast.success('تم تعليق الفاتورة');
    },
    onError: (err: Error) => toast.error(err.message || 'فشل تعليق الفاتورة'),
  });

  const deleteHeldMut = useMutation({
    mutationFn: (id: string) => api.delete(`/pos-shifts/held-bills/${id}`, accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pos-held-bills'] }),
    onError: (err: Error) => toast.error(err.message || 'فشل حذف الفاتورة'),
  });

  const holdBill = useCallback(() => {
    if (!cart.length) { toast.error('السلة فارغة'); return; }
    holdMut.mutate();
  }, [cart.length, holdMut]);

  const deleteHeldBill = useCallback((id: string) => {
    deleteHeldMut.mutate(id);
  }, [deleteHeldMut]);

  const recallBill = useCallback((id: string) => {
    const b = held.find((h) => h.id === id); if (!b) return;
    if (cart.length) holdBill();
    setCart(b.cart); setClient(b.client);
    if (b.walkIn) { setWalkInMode(true); setWalkName(b.walkIn.name); setWalkPhone(b.walkIn.phone); }
    setGlobalDisc(b.globalDiscount); setGlobalDiscType(b.globalDiscountType);
    deleteHeldMut.mutate(id);
    setPanel(null);
    toast.success('تم استدعاء الفاتورة');
  }, [held, cart, holdBill, deleteHeldMut]);

  /* ── Split ── */
  const splitTotal = useMemo(() => splits.reduce((s, e) => s + (e.amount || 0), 0), [splits]);
  const splitRem = useMemo(() => total - splitTotal, [splitTotal, total]);
  const splitOverpay = useMemo(() => splitTotal - total, [splitTotal, total]);

  /* ── Payment ── */
  const canPay = cart.length > 0;
  // Phase 1C should make coupon orderAmount authoritative inside POST /pos/checkout.
  const couponChangedSinceValidation = couponApplied && couponValidationScopeKey !== couponScopeKey;
  const canPayWithDiscount = canPay && !discountNeedsReason && !discountExceedsLimit;
  const paymentGuardInput = useCallback((method: string): POSPaymentGuardInput => ({
    cartCount: cart.length,
    total,
    method,
    cashReceived,
    discountNeedsReason,
    discountExceedsLimit,
    pinOverrideApproved,
    couponCode,
    couponApplied,
    couponPending: couponMut.isPending,
    couponChangedSinceValidation,
    splits,
  }), [
    cart.length,
    total,
    cashReceived,
    discountNeedsReason,
    discountExceedsLimit,
    pinOverrideApproved,
    couponCode,
    couponApplied,
    couponMut.isPending,
    couponChangedSinceValidation,
    splits,
  ]);
  const selectedPaymentGuard = useMemo(
    () => evaluatePOSPaymentGuard(paymentGuardInput(selectedPayMethod)),
    [paymentGuardInput, selectedPayMethod],
  );
  const splitPaymentGuard = useMemo(
    () => evaluatePOSPaymentGuard(paymentGuardInput('split')),
    [paymentGuardInput],
  );
  const cashPaymentGuard = useMemo(
    () => evaluatePOSPaymentGuard(paymentGuardInput('cash')),
    [paymentGuardInput],
  );
  const canSubmitPayment = selectedPaymentGuard.ok;
  const splitPaymentReady = splitPaymentGuard.ok;
  const cashPaymentReady = cashPaymentGuard.ok;

  const recordCheckoutDiagnostic = useCallback((diagnostic: CheckoutDiagnostic) => {
    setLastCheckoutDiagnostic(diagnostic);
    setCheckoutDiagnostics(prev => appendCheckoutDiagnostic(prev, diagnostic));
    logCheckoutDiagnostic(diagnostic);
  }, []);

  const recordBlockedCheckout = useCallback((method: string, errorCode: string, errorMessage: string) => {
    recordCheckoutDiagnostic(buildCheckoutDiagnostic({
      source: 'pos',
      status: 'blocked',
      terminalId,
      shiftId: currentShift?.id,
      previewTotal: total,
      paymentMethods: method === 'split'
        ? splits.filter(entry => toMoneyCents(entry.amount) > 0).map(entry => entry.method)
        : [method],
      errorCode,
      errorMessage,
    }));
  }, [currentShift?.id, recordCheckoutDiagnostic, splits, terminalId, total]);

  const payMut = useMutation({
    mutationFn: async (method: string) => {
      const startedAtMs = Date.now();
      if (!isAtomicPOSCheckoutEnabled()) {
        const message = 'Atomic POS checkout is disabled';
        recordCheckoutDiagnostic(buildCheckoutDiagnostic({
          source: 'pos',
          status: 'blocked',
          startedAtMs,
          terminalId,
          shiftId: currentShift?.id,
          previewTotal: total,
          paymentMethods: method === 'split'
            ? splits.filter(entry => toMoneyCents(entry.amount) > 0).map(entry => entry.method)
            : [method],
          errorCode: 'atomic_checkout_disabled',
          errorMessage: message,
        }));
        throw new Error(message);
      }

      const guard = evaluatePOSPaymentGuard(paymentGuardInput(method));
      if (!guard.ok) {
        const message = guard.message || 'Cannot process payment';
        recordCheckoutDiagnostic(buildCheckoutDiagnostic({
          source: 'pos',
          status: 'blocked',
          startedAtMs,
          terminalId,
          shiftId: currentShift?.id,
          previewTotal: total,
          paymentMethods: method === 'split'
            ? splits.filter(entry => toMoneyCents(entry.amount) > 0).map(entry => entry.method)
            : [method],
          errorCode: 'payment_guard_failed',
          errorMessage: message,
        }));
        throw new Error(message);
      }

      const fallbackEmpId = emps[0]?.id;
      if (!fallbackEmpId) {
        const message = 'No active employee is available for checkout';
        recordCheckoutDiagnostic(buildCheckoutDiagnostic({
          source: 'pos',
          status: 'blocked',
          startedAtMs,
          terminalId,
          shiftId: currentShift?.id,
          previewTotal: total,
          paymentMethods: [method],
          errorCode: 'missing_employee',
          errorMessage: message,
        }));
        throw new Error(message);
      }
      const shiftId = currentShift?.id;
      if (!shiftId) {
        const message = 'Open POS shift is required';
        recordCheckoutDiagnostic(buildCheckoutDiagnostic({
          source: 'pos',
          status: 'blocked',
          startedAtMs,
          terminalId,
          previewTotal: total,
          paymentMethods: [method],
          errorCode: 'missing_shift',
          errorMessage: message,
        }));
        throw new Error(message);
      }

      const payments = buildPOSCheckoutPayments({ method, total, splits, cashReceived });
      const rawDiscountValue = Number.parseFloat(globalDisc);
      const isLoyaltyDiscount = discountReason.includes('\u0648\u0644\u0627\u0621') && Boolean(loyaltyPoints && loyaltyPoints > 0);
      const loyaltyRedemption = isLoyaltyDiscount && loyaltyPoints
        ? { type: 'points' as const, value: loyaltyPoints }
        : undefined;
      const manualDiscount = gDiscVal > 0 && !loyaltyRedemption
        ? {
          type: globalDiscType,
          value: globalDiscType === 'percentage' ? rawDiscountValue : gDiscVal,
          reason: discountReason.trim(),
        }
        : undefined;

      const basePayload = buildPOSCheckoutPayload({
        idempotencyKey: 'pending',
        terminalId,
        shiftId,
        cart,
        fallbackEmployeeId: fallbackEmpId,
        client,
        walkInMode,
        walkName,
        walkPhone,
        appointmentId,
        selfOrderId,
        manualDiscount,
        couponCode: couponApplied ? couponCode : undefined,
        loyaltyRedemption,
        payments,
        notes: custNote,
        managerApprovalToken: managerApproval?.token,
      });
      const fingerprint = checkoutFingerprint(basePayload);
      if (!checkoutAttemptRef.current || checkoutAttemptRef.current.fingerprint !== fingerprint) {
        checkoutAttemptRef.current = {
          key: createPOSCheckoutIdempotencyKey('pos'),
          fingerprint,
        };
      }
      const payload = {
        ...basePayload,
        idempotencyKey: checkoutAttemptRef.current.key,
      };
      checkoutRequestMetaRef.current = {
        source: 'pos',
        startedAtMs,
        idempotencyKey: payload.idempotencyKey,
        terminalId,
        shiftId,
        previewTotal: total,
        paymentMethods: payments.map(payment => payment.method),
      };
      setLastCheckoutDiagnostic(buildCheckoutDiagnostic({
        ...checkoutRequestMetaRef.current,
        status: 'started',
      }));

      return dashboardService.posCheckout(payload, accessToken!);
    },
    onSuccess: (checkout, method) => {
      playSuccess();
      const receiptSnapshot = normalizeServerReceiptSnapshot(checkout.receiptSnapshot, method);
      const diagnosticMeta = checkoutRequestMetaRef.current;
      const diagnosticWarning = diagnosticMeta && checkoutTotalsMismatch(diagnosticMeta.previewTotal, receiptSnapshot.total)
        ? 'preview_total_mismatch'
        : undefined;
      recordCheckoutDiagnostic(buildCheckoutDiagnostic({
        source: 'pos',
        status: 'completed',
        startedAtMs: diagnosticMeta?.startedAtMs,
        idempotencyKey: diagnosticMeta?.idempotencyKey ?? checkout.idempotencyKey,
        terminalId: diagnosticMeta?.terminalId ?? checkout.receiptSnapshot.terminalId,
        shiftId: diagnosticMeta?.shiftId ?? checkout.receiptSnapshot.shiftId,
        previewTotal: diagnosticMeta?.previewTotal,
        serverTotal: receiptSnapshot.total,
        paymentMethods: diagnosticMeta?.paymentMethods ?? (checkout.receiptSnapshot.payments ?? []).map(payment => String(payment.method ?? 'unknown')),
        warning: diagnosticWarning,
      }));
      const token = receiptSnapshot.publicToken ?? checkout.invoice.publicToken ?? undefined;
      // Save total + method BEFORE clearing cart (so receipt/QR modal can display it)
      setLastPaidTotal(receiptSnapshot.total);
      setLastPaidMethod(receiptSnapshot.method);
      setLastPaidSnapshot(receiptSnapshot);
      setLastInvoiceId(receiptSnapshot.invoiceId ?? checkout.invoice.id);
      // Update session performance counters
      setTodaySales(prev => prev + receiptSnapshot.total);
      setTodayInvoices(prev => prev + 1);
      if (token) {
        setPublicToken(token);
        setShowQRModal(true);
      }
      checkoutAttemptRef.current = null;
      checkoutRequestMetaRef.current = null;
      setCart([]); setClient(null); setWalkName(''); setWalkPhone('');
      setWalkInMode(false); setGlobalDisc(''); setCustNote('');
      setSelfOrderId(null); setPanel(null); setAppointmentId(null);
      setLoyaltyPoints(null); setManagerApproval(null);
    },
    onError: (err: Error) => {
      const diagnosticMeta = checkoutRequestMetaRef.current;
      if (diagnosticMeta) {
        recordCheckoutDiagnostic(buildCheckoutDiagnostic({
          source: 'pos',
          status: 'failed',
          startedAtMs: diagnosticMeta.startedAtMs,
          idempotencyKey: diagnosticMeta.idempotencyKey,
          terminalId: diagnosticMeta.terminalId,
          shiftId: diagnosticMeta.shiftId,
          previewTotal: diagnosticMeta.previewTotal,
          paymentMethods: diagnosticMeta.paymentMethods,
          errorCode: 'checkout_failed',
          errorMessage: err.message || 'Checkout failed',
        }));
      }
      playError(); toast.error(err.message || 'خطأ');
    },
  });

  function pay(m: string) {
    if (!isAtomicPOSCheckoutEnabled()) {
      recordBlockedCheckout(m, 'atomic_checkout_disabled', 'Atomic POS checkout is disabled');
      toast.error('Atomic POS checkout is disabled');
      return;
    }
    const guard = evaluatePOSPaymentGuard(paymentGuardInput(m));
    if (!guard.ok) {
      const message = guard.message || 'لا يمكن تنفيذ الدفع';
      recordBlockedCheckout(m, 'payment_guard_failed', message);
      toast.error(message);
      return;
    }
    payMut.mutate(m);
  }
  function paySplit() {
    if (!isAtomicPOSCheckoutEnabled()) {
      recordBlockedCheckout('split', 'atomic_checkout_disabled', 'Atomic POS checkout is disabled');
      toast.error('Atomic POS checkout is disabled');
      return;
    }
    const guard = evaluatePOSPaymentGuard(paymentGuardInput('split'));
    if (!guard.ok) {
      const message = guard.message || 'لا يمكن تنفيذ الدفع المقسم';
      recordBlockedCheckout('split', 'payment_guard_failed', message);
      toast.error(message);
      return;
    }
    payMut.mutate('split');
  }

  const refMut = useMutation({
    mutationFn: async () => { await api.post(`/invoices/${refId}/refund`, { reason: refReason }, accessToken!); },
    onSuccess: () => { playBeep(); toast.success('تم الإرجاع'); setRefId(''); setRefReason(''); setPanel(null); },
    onError: () => { playError(); toast.error('فشل الإرجاع'); },
  });

  return {
    cart, selCat, svcSearch, cliSearch, client,
    globalDisc, globalDiscType, custNote,
    walkName, walkPhone, walkInMode,
    panel, held, splits, refId, refReason,
    online, favIds, showFavs, showAppointments, appointmentId,
    receiptLogo, receiptMsg, receiptPhone,
    couponCode, couponDiscount, couponApplied, couponMsg,
    cashReceived, setCashReceived, changeAmount,
    discountReason, setDiscountReason, pinOverrideApproved, setPinOverrideApproved,
    managerApproval, setManagerApproval,
    maxDiscountPercent, discountExceedsLimit, discountNeedsReason, canPayWithDiscount,
    canSubmitPayment, selectedPaymentGuard, cashPaymentGuard, splitPaymentGuard, splitPaymentReady, cashPaymentReady,
    loyaltyPoints, redeemLoyalty, taxRate,
    todaySales, todayInvoices, terminalId,
    setCart, setSelCat, setSvcSearch, setCliSearch, setClient,
    setGlobalDisc, setGlobalDiscType, setCustNote,
    setWalkName, setWalkPhone, setWalkInMode,
    setPanel, setSplits, setRefId, setRefReason, deleteHeldBill,
    setFavIds, setShowFavs, setShowAppointments,
    setReceiptLogo, setReceiptMsg, setReceiptPhone,
    setCouponCode, applyCoupon, removeCoupon, couponMut,
    cats, allSvcs, emps, cliResults, filtered, favSvcs,
    itemTotals, subtotal, cartCount, gDiscVal, afterDisc, tax, total,
    comms, totalComm, splitTotal, splitRem, splitOverpay, canPay, selectedPayMethod, setSelectedPayMethod,
    lastPaidMethod,
    addToCart, confirmAdd, pendingService, setPendingService,
    updateQty, removeItem, clearAll, toggleFav, loadAppointment,
    setItemEmp, setItemDisc, setItemNote,
    holdBill, recallBill, payMut, pay, paySplit, refMut,
    selfOrderId, setSelfOrderId,
    publicToken, setPublicToken, showQRModal, setShowQRModal, lastPaidTotal, lastPaidSnapshot, lastInvoiceId,
    lastCheckoutDiagnostic, checkoutDiagnostics,
  };
}

export type E = ReturnType<typeof usePOSEngine>;
