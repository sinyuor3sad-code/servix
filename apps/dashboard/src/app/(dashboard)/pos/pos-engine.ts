'use client';

import { useState, useMemo, useCallback, useEffect, useDeferredValue, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import { api } from '@/lib/api';
import type { Service, Client, Employee, PaginatedResponse, ServiceCategory } from '@/types';
import type { CartItem, SplitEntry, HeldBill, PanelId } from './pos-types';
import {
  uid, now, isDev, fmt, DEFAULT_FAVS,
  M_CATS, M_SVCS, M_EMP, M_CLI, M_BUNDLES,
} from './pos-constants';
import type { ServiceBundle } from './pos-types';
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

export function usePOSEngine() {
  const { accessToken, isOwner, userRole } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selCat, setSelCat] = useState<string | null>(null);
  const [svcSearch, setSvcSearch] = useState('');
  const [cliSearch, setCliSearch] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [defEmployee, setDefEmployee] = useState<Employee | null>(null);
  const [globalDisc, setGlobalDisc] = useState('');
  const [globalDiscType, setGlobalDiscType] = useState<'fixed' | 'percentage'>('fixed');
  const [tipInput, setTipInput] = useState('');
  const [custNote, setCustNote] = useState('');
  const [walkName, setWalkName] = useState('');
  const [walkPhone, setWalkPhone] = useState('');
  const [walkInMode, setWalkInMode] = useState(false);
  const [sendWA, setSendWA] = useState(true);
  const [sendMail, setSendMail] = useState(false);
  const [selfOrderId, setSelfOrderId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelId>(null);
  const [held, setHeld] = useState<HeldBill[]>(() => lsGet<HeldBill[]>('pos_held_bills', []));
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [refId, setRefId] = useState('');
  const [refReason, setRefReason] = useState('');
  const [online, setOnline] = useState(true);
  const [favIds, setFavIds] = useState<string[]>(() => lsGet<string[]>('pos_favs', DEFAULT_FAVS));
  const [showFavs, setShowFavs] = useState(false);
  const [showBundles, setShowBundles] = useState(false);
  const [showAppointments, setShowAppointments] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [lastPaidMethod, setLastPaidMethod] = useState<string>('cash');
  const [receiptLogo, setReceiptLogo] = useState(true);
  const [receiptMsg, setReceiptMsg] = useState('شكراً لزيارتكم');
  const [receiptPhone, setReceiptPhone] = useState('+966501234567');
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [lastPaidTotal, setLastPaidTotal] = useState(0);
  const [selectedPayMethod, setSelectedPayMethod] = useState<string>('cash');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMsg, setCouponMsg] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [pinOverrideApproved, setPinOverrideApproved] = useState(false);
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

  const dSearch = useDeferredValue(svcSearch);

  /* ── Persist held bills to localStorage ── */
  useEffect(() => { lsSet('pos_held_bills', held); }, [held]);
  /* ── Persist favourites to localStorage ── */
  useEffect(() => { lsSet('pos_favs', favIds); }, [favIds]);

  /* ── Walk-in "زائر" singleton client ── */
  const walkInClientId = useRef<string | null>(null);
  useEffect(() => {
    if (!accessToken || isDev(accessToken)) return;
    (async () => {
      try {
        const res = await dashboardService.getClients({ search: 'زائر', limit: 1 }, accessToken);
        if (res?.items?.length) { walkInClientId.current = res.items[0].id; return; }
        const c = await dashboardService.createClient({ fullName: 'زائر', phone: '0000000000', source: 'walk_in' }, accessToken);
        walkInClientId.current = c.id;
      } catch { /* best effort */ }
    })();
  }, [accessToken]);

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
    if (!client || !accessToken || isDev(accessToken) || client.fullName === 'زائر') { setLoyaltyPoints(null); return; }
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
    queryFn: () => isDev(accessToken) ? Promise.resolve(M_CATS) : dashboardService.getCategories(accessToken!),
  });
  const { data: svcsData } = useQuery({
    queryKey: ['pos-svcs'],
    queryFn: () => isDev(accessToken)
      ? Promise.resolve({ items: M_SVCS, total: M_SVCS.length, page: 1, limit: 100, totalPages: 1 } as PaginatedResponse<Service>)
      : dashboardService.getServices({ limit: 100 }, accessToken!),
  });
  const { data: empData } = useQuery({
    queryKey: ['pos-emp'],
    queryFn: () => isDev(accessToken)
      ? Promise.resolve({ items: M_EMP, total: M_EMP.length, page: 1, limit: 50, totalPages: 1 } as PaginatedResponse<Employee>)
      : dashboardService.getEmployees({ limit: 50 }, accessToken!),
  });

  /* ── Salon info (for dynamic tax) ── */
  const { data: salonInfo } = useQuery({
    queryKey: ['pos-salon-info'],
    queryFn: () => api.get('/salon', accessToken!),
    enabled: !!accessToken && !isDev(accessToken),
  });

  const taxRate = useMemo(() => {
    if (isDev(accessToken)) return 0.15;
    const si = salonInfo as Record<string, unknown> | undefined;
    const d = si?.data as Record<string, unknown> | undefined;
    const pct = d?.taxPercentage ?? si?.taxPercentage;
    return pct ? Number(pct) / 100 : 0.15;
  }, [salonInfo, accessToken]);

  const mockCli = useMemo(() => {
    if (!isDev(accessToken) || cliSearch.length < 2) return [];
    const q = cliSearch.toLowerCase();
    return M_CLI.filter(c => c.fullName.includes(q) || c.phone.includes(q));
  }, [cliSearch, accessToken]);

  const { data: cliApi } = useQuery({
    queryKey: ['pos-cli', cliSearch],
    queryFn: () => dashboardService.getClients({ search: cliSearch, limit: 5 }, accessToken!),
    enabled: !isDev(accessToken) && !!accessToken && cliSearch.length >= 2 && !walkInMode,
  });

  const cliResults = isDev(accessToken) ? mockCli : (cliApi?.items ?? []);
  const allSvcs = useMemo(() => svcsData?.items ?? [], [svcsData]);
  const emps = useMemo(() => empData?.items ?? [], [empData]);

  const filtered = useMemo(() => {
    let s = allSvcs.filter(x => x.isActive);
    if (selCat) s = s.filter(x => x.categoryId === selCat);
    if (dSearch) { const q = dSearch.toLowerCase(); s = s.filter(x => x.nameAr.includes(q) || (x.nameEn?.toLowerCase() ?? '').includes(q)); }
    return s;
  }, [allSvcs, selCat, dSearch]);

  const favSvcs = useMemo(() => allSvcs.filter(s => favIds.includes(s.id)), [allSvcs, favIds]);

  /* ── Cart ops ── */
  const addToCart = useCallback((svc: Service) => {
    setCart(prev => {
      const ex = prev.find(i => i.service.id === svc.id && i.employeeId === (defEmployee?.id ?? null) && !i.bundleId);
      if (ex) return prev.map(i => i.id === ex.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: uid(), service: svc, quantity: 1, employeeId: defEmployee?.id ?? null, employeeName: defEmployee?.fullName ?? 'غير محدد', discount: 0, discountType: 'fixed' as const, note: '' }];
    });
    playBeep();
  }, [defEmployee]);

  const addBundle = useCallback((bundle: ServiceBundle) => {
    const bid = uid();
    const items: CartItem[] = bundle.services.map(bs => {
      const svc = allSvcs.find(s => s.id === bs.serviceId);
      if (!svc) return null;
      const emp = bs.employeeId ? emps.find(e => e.id === bs.employeeId) : defEmployee;
      return { id: uid(), service: svc, quantity: 1, employeeId: emp?.id ?? null, employeeName: emp?.fullName ?? 'غير محدد', discount: 0, discountType: 'fixed' as const, note: '', bundleId: bid };
    }).filter(Boolean) as CartItem[];
    setCart(prev => [...prev, ...items]);
    toast.success(`تمت إضافة ${bundle.nameAr}`);
    setPanel(null);
  }, [allSvcs, emps, defEmployee]);

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
    setWalkInMode(false); setGlobalDisc(''); setTipInput(''); setCustNote('');
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
  const tip = 0;
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

  // Check if current discount exceeds the role limit
  const discountExceedsLimit = useMemo(() => {
    const v = parseFloat(globalDisc);
    if (isNaN(v) || v <= 0) return false;
    if (globalDiscType === 'percentage') return v > maxDiscountPercent;
    // For fixed: calculate what percentage it represents
    if (subtotal <= 0) return false;
    return (v / subtotal) * 100 > maxDiscountPercent;
  }, [globalDisc, globalDiscType, maxDiscountPercent, subtotal]);

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
      const emp = as.employeeId ? emps.find(e => e.id === as.employeeId) : (as.employee ? emps.find(e => e.id === as.employee!.id) : defEmployee);
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
  }, [clearAll, allSvcs, emps, defEmployee]);

  /* ── Coupon validation ── */
  const couponMut = useMutation({
    mutationFn: async (code: string) => {
      if (isDev(accessToken)) return { valid: true, discountAmount: 10, message: 'كوبون تجريبي' };
      return api.post<{ valid: boolean; discountAmount: number; message: string }>('/coupons/validate', { code: code.toUpperCase(), orderAmount: afterDisc }, accessToken!);
    },
    onSuccess: (res) => {
      if (res.valid) {
        setCouponDiscount(res.discountAmount);
        setCouponApplied(true);
        setCouponMsg(res.message);
        toast.success(res.message);
      } else {
        setCouponDiscount(0);
        setCouponApplied(false);
        setCouponMsg(res.message);
        toast.error(res.message);
      }
    },
    onError: () => { toast.error('خطأ في التحقق من الكوبون'); },
  });

  const applyCoupon = useCallback(() => {
    if (!couponCode.trim()) return;
    couponMut.mutate(couponCode.trim());
  }, [couponCode, couponMut]);

  const removeCoupon = useCallback(() => {
    setCouponCode(''); setCouponDiscount(0); setCouponApplied(false); setCouponMsg('');
  }, []);

  // Auto-apply coupon after 500ms debounce when code is >= 3 chars
  useEffect(() => {
    if (couponApplied || couponCode.trim().length < 3) return;
    const timer = setTimeout(() => {
      couponMut.mutate(couponCode.trim());
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

  /* ── Hold / Recall ── */
  const holdBill = useCallback(() => {
    if (!cart.length) { toast.error('السلة فارغة'); return; }
    setHeld(p => [...p, { id: uid(), label: (client?.fullName ?? walkName) || `فاتورة ${now()}`, cart: [...cart], client, walkIn: walkInMode ? { name: walkName, phone: walkPhone } : null, globalDiscount: globalDisc, globalDiscountType: globalDiscType, tip: tipInput, time: now(), total }]);
    clearAll(); toast.success('تم تعليق الفاتورة');
  }, [cart, client, walkName, walkPhone, walkInMode, globalDisc, globalDiscType, tipInput, total, clearAll]);

  const recallBill = useCallback((id: string) => {
    const b = held.find(h => h.id === id); if (!b) return;
    if (cart.length) holdBill();
    setCart(b.cart); setClient(b.client);
    if (b.walkIn) { setWalkInMode(true); setWalkName(b.walkIn.name); setWalkPhone(b.walkIn.phone); }
    setGlobalDisc(b.globalDiscount); setGlobalDiscType(b.globalDiscountType); setTipInput(b.tip);
    setHeld(p => p.filter(x => x.id !== id)); setPanel(null);
    toast.success('تم استدعاء الفاتورة');
  }, [held, cart, holdBill]);

  /* ── Split ── */
  const splitRem = useMemo(() => Math.max(0, total - splits.reduce((s, e) => s + (e.amount || 0), 0)), [splits, total]);

  /* ── Payment ── */
  const canPay = cart.length > 0;
  const canPayWithDiscount = canPay && !discountNeedsReason && (!discountExceedsLimit || pinOverrideApproved);

  const payMut = useMutation({
    mutationFn: async (method: string) => {
      if (isDev(accessToken)) { await new Promise(r => setTimeout(r, 500)); return { id: 'INV-' + Date.now(), _paymentResult: undefined }; }
      let clientId = client?.id;
      // If walk-in mode with name/phone provided, create client
      if (!clientId && walkInMode && walkName.trim() && walkPhone.trim()) {
        const c = await dashboardService.createClient({ fullName: walkName.trim(), phone: walkPhone.trim(), source: 'walk_in' }, accessToken!);
        clientId = c.id;
      }
      // Use the singleton "زائر" client instead of creating a new one every time
      if (!clientId) {
        if (walkInClientId.current) {
          clientId = walkInClientId.current;
        } else {
          // Fallback: try to find/create the singleton now
          try {
            const res = await dashboardService.getClients({ search: 'زائر', limit: 1 }, accessToken!);
            if (res?.items?.length) { clientId = res.items[0].id; walkInClientId.current = clientId; }
            else {
              const c = await dashboardService.createClient({ fullName: 'زائر', phone: '0000000000', source: 'walk_in' }, accessToken!);
              clientId = c.id; walkInClientId.current = clientId;
            }
          } catch {
            // Last resort: create with timestamp (should rarely happen)
            const c = await dashboardService.createClient({ fullName: 'زائر', phone: '0000000000', source: 'walk_in' }, accessToken!);
            clientId = c.id; walkInClientId.current = clientId;
          }
        }
      }
      // Determine a fallback employee (first available)
      const fallbackEmpId = emps.length > 0 ? emps[0].id : null;
      const inv = await api.post<{ id: string }>('/invoices', {
        clientId,
        selfOrderId: selfOrderId || undefined,
        notes: custNote || undefined,
        items: cart.map(i => ({
          serviceId: i.service.id,
          description: i.service.nameAr,
          quantity: i.quantity,
          unitPrice: i.service.price,
          employeeId: i.employeeId || fallbackEmpId,
        })),
        appointmentId: appointmentId || undefined,
        terminalId: terminalId,
      }, accessToken!);
      // Apply global manual discount
      if (gDiscVal > 0) await dashboardService.addInvoiceDiscount(inv.id, { type: 'fixed', value: gDiscVal, reason: discountReason || undefined }, accessToken!);
      // Redeem coupon (validate + increment usedCount atomically)
      if (couponApplied && couponCode.trim() && couponDiscount > 0) {
        try {
          await api.post('/coupons/redeem', { code: couponCode.trim().toUpperCase(), orderAmount: afterDisc }, accessToken!);
          await dashboardService.addInvoiceDiscount(inv.id, { type: 'fixed', value: couponDiscount }, accessToken!);
        } catch { /* coupon might be exhausted by now, invoice still goes through */ }
      }
      let paymentResult: Record<string, unknown> | undefined;
      if (method === 'split') { for (const e of splits) { if (e.amount > 0) paymentResult = await dashboardService.recordInvoicePayment(inv.id, { amount: e.amount, method: (e.method === 'apple_pay' ? 'card' : e.method) as 'cash' | 'card' | 'bank_transfer' }, accessToken!) as Record<string, unknown>; } }
      else paymentResult = await dashboardService.recordInvoicePayment(inv.id, { amount: total, method: (method === 'apple_pay' ? 'card' : method) as 'cash' | 'card' | 'bank_transfer' }, accessToken!) as Record<string, unknown>;
      if (sendWA) { try { await dashboardService.sendInvoice(inv.id, 'whatsapp', accessToken!); } catch { /* ok */ } }
      if (sendMail) { try { await dashboardService.sendInvoice(inv.id, 'email', accessToken!); } catch { /* ok */ } }
      return { ...inv, _paymentResult: paymentResult };
    },
    onSuccess: (inv) => {
      playSuccess();
      // Extract publicToken from the payment result
      const payRes = inv._paymentResult as Record<string, unknown> | undefined;
      const token = payRes?.publicToken as string | undefined;
      // Save total + method BEFORE clearing cart (so receipt/QR modal can display it)
      setLastPaidTotal(total);
      setLastPaidMethod(selectedPayMethod);
      // Update session performance counters
      setTodaySales(prev => prev + total);
      setTodayInvoices(prev => prev + 1);
      if (token) {
        setPublicToken(token);
        setShowQRModal(true);
      }
      // If this was from an appointment, mark it as completed
      if (appointmentId && accessToken) {
        api.put(`/appointments/${appointmentId}/status`, { status: 'completed' }, accessToken).catch(() => {});
      }
      // Redeem loyalty points if discount reason indicates it
      if (client && accessToken && loyaltyPoints && loyaltyPoints > 0 && discountReason === 'استبدال نقاط ولاء') {
        api.post(`/loyalty/clients/${client.id}/adjust`, { type: 'redeem', points: -loyaltyPoints, description: 'استبدال نقاط من الكاشير' }, accessToken).catch(() => {});
      }
      setCart([]); setClient(null); setWalkName(''); setWalkPhone('');
      setWalkInMode(false); setGlobalDisc(''); setTipInput(''); setCustNote('');
      setSelfOrderId(null); setPanel(null); setAppointmentId(null);
      setLoyaltyPoints(null);
    },
    onError: (err: Error) => { playError(); toast.error(err.message || 'خطأ'); },
  });

  function pay(m: string) { if (!canPay) { toast.error('أكمل بيانات العميل'); return; } payMut.mutate(m); }
  function paySplit() { if (!canPay) { toast.error('أكمل بيانات العميل'); return; } if (splitRem > 0.01) { toast.error('المبلغ المتبقي غير صفر'); return; } payMut.mutate('split'); }

  const refMut = useMutation({
    mutationFn: async () => { if (isDev(accessToken)) { await new Promise(r => setTimeout(r, 400)); return; } await api.post(`/invoices/${refId}/refund`, { reason: refReason }, accessToken!); },
    onSuccess: () => { playBeep(); toast.success('تم الإرجاع'); setRefId(''); setRefReason(''); setPanel(null); },
    onError: () => { playError(); toast.error('فشل الإرجاع'); },
  });

  return {
    cart, selCat, svcSearch, cliSearch, client, defEmployee,
    globalDisc, globalDiscType, tipInput, custNote,
    walkName, walkPhone, walkInMode, sendWA, sendMail,
    panel, held, splits, refId, refReason,
    online, favIds, showFavs, showBundles, showAppointments, appointmentId,
    receiptLogo, receiptMsg, receiptPhone,
    couponCode, couponDiscount, couponApplied, couponMsg,
    cashReceived, setCashReceived, changeAmount,
    discountReason, setDiscountReason, pinOverrideApproved, setPinOverrideApproved,
    maxDiscountPercent, discountExceedsLimit, discountNeedsReason, canPayWithDiscount,
    loyaltyPoints, redeemLoyalty, taxRate,
    todaySales, todayInvoices, terminalId,
    setCart, setSelCat, setSvcSearch, setCliSearch, setClient, setDefEmployee,
    setGlobalDisc, setGlobalDiscType, setTipInput, setCustNote,
    setWalkName, setWalkPhone, setWalkInMode, setSendWA, setSendMail,
    setPanel, setHeld, setSplits, setRefId, setRefReason,
    setFavIds, setShowFavs, setShowBundles, setShowAppointments,
    setReceiptLogo, setReceiptMsg, setReceiptPhone,
    setCouponCode, applyCoupon, removeCoupon, couponMut,
    cats, allSvcs, emps, cliResults, filtered, favSvcs,
    itemTotals, subtotal, cartCount, gDiscVal, afterDisc, tax, tip, total,
    comms, totalComm, splitRem, canPay, selectedPayMethod, setSelectedPayMethod,
    lastPaidMethod,
    addToCart, updateQty, removeItem, clearAll, addBundle, toggleFav, loadAppointment,
    setItemEmp, setItemDisc, setItemNote,
    holdBill, recallBill, payMut, pay, paySplit, refMut,
    selfOrderId, setSelfOrderId,
    publicToken, setPublicToken, showQRModal, setShowQRModal, lastPaidTotal,
  };
}

export type E = ReturnType<typeof usePOSEngine>;
