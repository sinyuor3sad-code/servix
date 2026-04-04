'use client';

import { useState, useMemo, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Minus, Plus, Trash2, Banknote, CreditCard, Building2,
  ShoppingCart, UserPlus, Smartphone, Receipt,
  Printer, MessageCircle, Crown, Clock, Scissors, Sparkles,
  QrCode, X, User, Phone, Star, Zap, ArrowLeft,
  Pause, Play, RotateCcw, Heart, StickyNote,
  Split, Mail, Users, ChevronDown, ChevronUp, AlertTriangle,
  Hash, Check, CircleDollarSign, Wifi, WifiOff,
  Package, StarOff, Percent, Monitor,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import { api } from '@/lib/api';
import type { Service, ServiceCategory, Client, Employee, PaginatedResponse } from '@/types';

/* ═══════════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════════ */

interface CartItem {
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

interface SplitEntry { method: string; amount: number }

interface HeldBill {
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

interface ServiceBundle {
  id: string;
  nameAr: string;
  services: { serviceId: string; employeeId?: string }[];
  price: number;
  savings: number;
}

type PanelId = null | 'split' | 'hold-list' | 'refund' | 'receipt' | 'bundles';

/* ═══════════════════════════════════════════════════════════════════════════════
   CONSTANTS + HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

const TAX = 0.15;
const TN: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
function fmt(v: number) { return v.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); }
const isDev = (t: string | null) => !t || t.startsWith('dev-');

/* ═══════════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════════ */

const M_CATS: ServiceCategory[] = [
  { id: 'c1', nameAr: 'شعر',        nameEn: 'Hair',    sortOrder: 1, isActive: true },
  { id: 'c2', nameAr: 'بشرة',       nameEn: 'Skin',    sortOrder: 2, isActive: true },
  { id: 'c3', nameAr: 'مكياج',      nameEn: 'Makeup',  sortOrder: 3, isActive: true },
  { id: 'c4', nameAr: 'أظافر',      nameEn: 'Nails',   sortOrder: 4, isActive: true },
  { id: 'c5', nameAr: 'عروس',       nameEn: 'Bridal',  sortOrder: 5, isActive: true },
  { id: 'c6', nameAr: 'حمام مغربي', nameEn: 'Hammam',  sortOrder: 6, isActive: true },
];

const M_SVCS: Service[] = [
  { id: 's1',  categoryId: 'c1', nameAr: 'قص شعر',          nameEn: 'Haircut',    descriptionAr: null, price: 80,   duration: 30,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's2',  categoryId: 'c1', nameAr: 'صبغة شعر كامل',   nameEn: 'Full Color', descriptionAr: null, price: 250,  duration: 90,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's3',  categoryId: 'c1', nameAr: 'بروتين شعر',      nameEn: 'Protein',    descriptionAr: null, price: 450,  duration: 120, isActive: true, sortOrder: 3, imageUrl: null },
  { id: 's4',  categoryId: 'c1', nameAr: 'سشوار',           nameEn: 'Blow Dry',   descriptionAr: null, price: 60,   duration: 30,  isActive: true, sortOrder: 4, imageUrl: null },
  { id: 's5',  categoryId: 'c1', nameAr: 'فرد كيراتين',     nameEn: 'Keratin',    descriptionAr: null, price: 550,  duration: 150, isActive: true, sortOrder: 5, imageUrl: null },
  { id: 's6',  categoryId: 'c1', nameAr: 'هايلايت',          nameEn: 'Highlights', descriptionAr: null, price: 350,  duration: 90,  isActive: true, sortOrder: 6, imageUrl: null },
  { id: 's7',  categoryId: 'c2', nameAr: 'تنظيف بشرة عميق', nameEn: 'Deep Facial',descriptionAr: null, price: 180,  duration: 45,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's8',  categoryId: 'c2', nameAr: 'هيدرافيشل',       nameEn: 'HydraFacial',descriptionAr: null, price: 350,  duration: 60,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's9',  categoryId: 'c2', nameAr: 'تقشير كيميائي',   nameEn: 'Chem Peel',  descriptionAr: null, price: 280,  duration: 40,  isActive: true, sortOrder: 3, imageUrl: null },
  { id: 's10', categoryId: 'c2', nameAr: 'ميزوثيرابي',      nameEn: 'Mesotherapy', descriptionAr: null, price: 500,  duration: 30,  isActive: true, sortOrder: 4, imageUrl: null },
  { id: 's11', categoryId: 'c3', nameAr: 'مكياج سهرة',      nameEn: 'Evening MU', descriptionAr: null, price: 300,  duration: 60,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's12', categoryId: 'c3', nameAr: 'مكياج ناعم',      nameEn: 'Soft Makeup',descriptionAr: null, price: 200,  duration: 45,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's13', categoryId: 'c3', nameAr: 'كونتور احترافي',   nameEn: 'Pro Contour',descriptionAr: null, price: 350,  duration: 50,  isActive: true, sortOrder: 3, imageUrl: null },
  { id: 's14', categoryId: 'c4', nameAr: 'أظافر جل',        nameEn: 'Gel Nails',  descriptionAr: null, price: 150,  duration: 45,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's15', categoryId: 'c4', nameAr: 'بدكير ومنكير',    nameEn: 'Pedi&Mani',  descriptionAr: null, price: 120,  duration: 50,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's16', categoryId: 'c4', nameAr: 'أظافر أكريليك',   nameEn: 'Acrylic',    descriptionAr: null, price: 200,  duration: 60,  isActive: true, sortOrder: 3, imageUrl: null },
  { id: 's17', categoryId: 'c5', nameAr: 'باكج عروس كامل', nameEn: 'Full Bridal',descriptionAr: null, price: 2500, duration: 240, isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's18', categoryId: 'c5', nameAr: 'تسريحة عروس',    nameEn: 'Bridal Hair',descriptionAr: null, price: 500,  duration: 90,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's19', categoryId: 'c6', nameAr: 'حمام مغربي',      nameEn: 'Moroc Bath', descriptionAr: null, price: 300,  duration: 60,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's20', categoryId: 'c6', nameAr: 'حمام كليوباترا',  nameEn: 'Cleopatra',  descriptionAr: null, price: 450,  duration: 90,  isActive: true, sortOrder: 2, imageUrl: null },
];

const M_EMP: Employee[] = [
  { id: 'e1', userId: null, fullName: 'سارة القحطاني', phone: null, email: null, role: 'stylist', commissionType: 'percentage', commissionValue: 15, isActive: true, avatarUrl: null, createdAt: '', updatedAt: '' },
  { id: 'e2', userId: null, fullName: 'هند الشمري',    phone: null, email: null, role: 'stylist', commissionType: 'percentage', commissionValue: 12, isActive: true, avatarUrl: null, createdAt: '', updatedAt: '' },
  { id: 'e3', userId: null, fullName: 'أمل الزهراني',  phone: null, email: null, role: 'stylist', commissionType: 'percentage', commissionValue: 10, isActive: true, avatarUrl: null, createdAt: '', updatedAt: '' },
  { id: 'e4', userId: null, fullName: 'ديما البقمي',   phone: null, email: null, role: 'stylist', commissionType: 'fixed',      commissionValue: 50, isActive: true, avatarUrl: null, createdAt: '', updatedAt: '' },
  { id: 'e5', userId: null, fullName: 'منيرة الدوسري', phone: null, email: null, role: 'stylist', commissionType: 'percentage', commissionValue: 8,  isActive: true, avatarUrl: null, createdAt: '', updatedAt: '' },
];

const M_CLI: Client[] = [
  { id: 'cl1', fullName: 'نورة الأحمد',   phone: '0551234567', email: null, gender: 'female', dateOfBirth: null, notes: 'تفضل صبغة شقراء',       source: 'online',   totalVisits: 12, totalSpent: 4200,  lastVisitAt: '2026-03-20', isActive: true, createdAt: '', updatedAt: '' },
  { id: 'cl2', fullName: 'ريم العتيبي',   phone: '0559876543', email: null, gender: 'female', dateOfBirth: null, notes: 'حساسية من بعض المنتجات', source: 'walk_in',  totalVisits: 8,  totalSpent: 2800,  lastVisitAt: '2026-03-15', isActive: true, createdAt: '', updatedAt: '' },
  { id: 'cl3', fullName: 'لطيفة المطيري', phone: '0541112233', email: null, gender: 'female', dateOfBirth: null, notes: null,                     source: 'phone',    totalVisits: 3,  totalSpent: 950,   lastVisitAt: '2026-03-10', isActive: true, createdAt: '', updatedAt: '' },
  { id: 'cl4', fullName: 'هيا السبيعي',   phone: '0567778899', email: null, gender: 'female', dateOfBirth: null, notes: 'عميلة VIP',              source: 'referral', totalVisits: 25, totalSpent: 12500, lastVisitAt: '2026-03-25', isActive: true, createdAt: '', updatedAt: '' },
];

const M_BUNDLES: ServiceBundle[] = [
  { id: 'b1', nameAr: 'باقة العروس الذهبية',   services: [{ serviceId: 's17' }, { serviceId: 's11' }, { serviceId: 's14' }], price: 2700, savings: 250 },
  { id: 'b2', nameAr: 'باقة العناية المتكاملة', services: [{ serviceId: 's7' }, { serviceId: 's15' }, { serviceId: 's4' }],  price: 300,  savings: 60 },
  { id: 'b3', nameAr: 'باقة تجديد الشعر',       services: [{ serviceId: 's1' }, { serviceId: 's2' }, { serviceId: 's4' }],  price: 350,  savings: 40 },
];

const DEFAULT_FAVS = ['s1', 's4', 's7', 's11', 's14'];
const CAT_ICO: Record<string, React.ElementType> = { 'شعر': Scissors, 'بشرة': Sparkles, 'مكياج': Star, 'أظافر': Zap, 'عروس': Crown, 'حمام مغربي': Heart };

const PAY = [
  { id: 'cash',          label: 'نقدي',      icon: Banknote },
  { id: 'card',          label: 'بطاقة/مدى', icon: CreditCard },
  { id: 'bank_transfer', label: 'تحويل',     icon: Building2 },
  { id: 'apple_pay',     label: 'Apple Pay',  icon: Smartphone },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Obsidian Nexus
   100% CSS Variables — zero hardcoded colors
   Supports: Velvet · Crystal · Orchid · Noir × light/dark
   ═══════════════════════════════════════════════════════════════════════════════ */

const G1 = 'backdrop-blur-[36px] bg-[color-mix(in_srgb,var(--card)_35%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_4%,transparent)]';
const G2 = 'backdrop-blur-[48px] bg-[color-mix(in_srgb,var(--card)_55%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_3%,transparent)]';
const G3 = 'backdrop-blur-[32px] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_3%,transparent)]';

const T  = 'transition-all duration-[140ms] ease-[cubic-bezier(0.23,1,0.32,1)]';
const TF = 'transition-all duration-[100ms] ease-[cubic-bezier(0.23,1,0.32,1)]';

const B  = `${T} active:scale-[0.96] touch-manipulation select-none cursor-pointer`;
const BS = `${TF} active:scale-[0.94] touch-manipulation select-none cursor-pointer`;

const INP = `w-full rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)]/40 ${T}`;

const accentBg    = { background: 'var(--brand-accent)' } as const;
const accentColor = { color: 'var(--brand-accent)' } as const;
const accentMix   = (pct: number) => ({ background: `color-mix(in srgb, var(--brand-accent) ${pct}%, transparent)` });
const primaryBg   = { background: 'var(--brand-primary)' } as const;

const brd = (pct: number) => `border-[color-mix(in_srgb,var(--foreground)_${pct}%,transparent)]`;
const bg  = (pct: number) => `bg-[color-mix(in_srgb,var(--foreground)_${pct}%,transparent)]`;

/* ═══════════════════════════════════════════════════════════════════════════════
   SMART DEVICE DETECTION
   Combines: maxTouchPoints + matchMedia(pointer/hover) + UA + screen width
   Runs once on mount — no manual toggle needed
   ═══════════════════════════════════════════════════════════════════════════════ */

function useDeviceMode() {
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

function usePOSEngine() {
  const { accessToken } = useAuth();

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
  const [panel, setPanel] = useState<PanelId>(null);
  const [held, setHeld] = useState<HeldBill[]>([]);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [refId, setRefId] = useState('');
  const [refReason, setRefReason] = useState('');
  const [online, setOnline] = useState(true);
  const [favIds, setFavIds] = useState<string[]>(DEFAULT_FAVS);
  const [showFavs, setShowFavs] = useState(false);
  const [showBundles, setShowBundles] = useState(false);
  const [receiptLogo, setReceiptLogo] = useState(true);
  const [receiptMsg, setReceiptMsg] = useState('شكراً لزيارتكم');
  const [receiptPhone, setReceiptPhone] = useState('+966501234567');

  const dSearch = useDeferredValue(svcSearch);

  /* ── Offline ── */
  useEffect(() => {
    const on = () => { setOnline(true); toast.success('تم استعادة الاتصال'); };
    const off = () => { setOnline(false); toast.error('انقطع الاتصال — وضع غير متصل'); };
    setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

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
  const tax = afterDisc * TAX;
  const tip = useMemo(() => { const v = parseFloat(tipInput); return isNaN(v) || v < 0 ? 0 : v; }, [tipInput]);
  const total = afterDisc + tax + tip;

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
  const canPay = cart.length > 0 && (client || (walkInMode && walkName.trim() && walkPhone.trim()));

  const payMut = useMutation({
    mutationFn: async (method: string) => {
      if (isDev(accessToken)) { await new Promise(r => setTimeout(r, 500)); return { id: 'INV-' + Date.now() }; }
      let clientId = client?.id;
      if (!clientId && walkInMode && walkName.trim() && walkPhone.trim()) {
        const c = await dashboardService.createClient({ fullName: walkName.trim(), phone: walkPhone.trim(), source: 'walk_in' }, accessToken!);
        clientId = c.id;
      }
      if (!clientId) throw new Error('العميل مطلوب');
      const inv = await api.post<{ id: string }>('/invoices', { clientId, notes: custNote || undefined, items: cart.map(i => ({ serviceId: i.service.id, description: i.service.nameAr, quantity: i.quantity, unitPrice: i.service.price, employeeId: i.employeeId })) }, accessToken!);
      if (gDiscVal > 0) await dashboardService.addInvoiceDiscount(inv.id, { type: 'fixed', value: gDiscVal }, accessToken!);
      if (method === 'split') { for (const e of splits) { if (e.amount > 0) await dashboardService.recordInvoicePayment(inv.id, { amount: e.amount, method: (e.method === 'apple_pay' ? 'card' : e.method) as 'cash' | 'card' | 'bank_transfer' }, accessToken!); } }
      else await dashboardService.recordInvoicePayment(inv.id, { amount: total, method: (method === 'apple_pay' ? 'card' : method) as 'cash' | 'card' | 'bank_transfer' }, accessToken!);
      if (sendWA) { try { await dashboardService.sendInvoice(inv.id, 'whatsapp', accessToken!); } catch { /* ok */ } }
      if (sendMail) { try { await dashboardService.sendInvoice(inv.id, 'email', accessToken!); } catch { /* ok */ } }
      return inv;
    },
    onSuccess: (inv) => { toast.success(`فاتورة ${inv.id} تمت بنجاح`); clearAll(); setPanel(null); },
    onError: (e: Error) => toast.error(e.message || 'خطأ'),
  });

  function pay(m: string) { if (!canPay) { toast.error('أكمل بيانات العميل'); return; } payMut.mutate(m); }
  function paySplit() { if (!canPay) { toast.error('أكمل بيانات العميل'); return; } if (splitRem > 0.01) { toast.error('المبلغ المتبقي غير صفر'); return; } payMut.mutate('split'); }

  const refMut = useMutation({
    mutationFn: async () => { if (isDev(accessToken)) { await new Promise(r => setTimeout(r, 400)); return; } await api.post(`/invoices/${refId}/refund`, { reason: refReason }, accessToken!); },
    onSuccess: () => { toast.success('تم الإرجاع'); setRefId(''); setRefReason(''); setPanel(null); },
    onError: () => toast.error('فشل الإرجاع'),
  });

  return {
    cart, selCat, svcSearch, cliSearch, client, defEmployee,
    globalDisc, globalDiscType, tipInput, custNote,
    walkName, walkPhone, walkInMode, sendWA, sendMail,
    panel, held, splits, refId, refReason,
    online, favIds, showFavs, showBundles, receiptLogo, receiptMsg, receiptPhone,
    setCart, setSelCat, setSvcSearch, setCliSearch, setClient, setDefEmployee,
    setGlobalDisc, setGlobalDiscType, setTipInput, setCustNote,
    setWalkName, setWalkPhone, setWalkInMode, setSendWA, setSendMail,
    setPanel, setHeld, setSplits, setRefId, setRefReason,
    setFavIds, setShowFavs, setShowBundles, setReceiptLogo, setReceiptMsg, setReceiptPhone,
    cats, allSvcs, emps, cliResults, filtered, favSvcs,
    itemTotals, subtotal, cartCount, gDiscVal, afterDisc, tax, tip, total,
    comms, totalComm, splitRem, canPay,
    addToCart, updateQty, removeItem, clearAll, addBundle, toggleFav,
    setItemEmp, setItemDisc, setItemNote,
    holdBill, recallBill, payMut, pay, paySplit, refMut,
  };
}

type E = ReturnType<typeof usePOSEngine>;

/* ═══════════════════════════════════════════════════════════════════════════════
   MODAL (shared by both layouts)
   ═══════════════════════════════════════════════════════════════════════════════ */

function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--background)_85%,transparent)] backdrop-blur-xl" />
      <div onClick={e => e.stopPropagation()} className={`relative max-h-[85vh] overflow-y-auto rounded-2xl ${G2} ${wide ? 'w-full max-w-lg' : 'w-full max-w-md'} p-6`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
          <button onClick={onClose} className={`${BS} flex h-8 w-8 items-center justify-center rounded-xl ${bg(5)} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SHARED PANELS (identical content for both layouts)
   ═══════════════════════════════════════════════════════════════════════════════ */

function SplitPanel({ e }: { e: E }) {
  return (
    <div className="space-y-3">
      <div className={`rounded-xl ${bg(3)} p-3 text-center`}><p className="text-[8px] text-[var(--muted-foreground)]">الإجمالي</p><p className="text-[18px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)} ر.س</p></div>
      {e.splits.map((entry, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-xl ${G3} p-3`}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-black" style={{ ...TN, ...accentBg }}>{i + 1}</span>
          <select value={entry.method} onChange={ev => e.setSplits(p => p.map((x, j) => j === i ? { ...x, method: ev.target.value } : x))} className={`rounded-lg ${brd(5)} border ${bg(3)} px-2 py-1.5 text-[10px] text-[var(--foreground)] focus:outline-none`}>{PAY.map(pm => <option key={pm.id} value={pm.id}>{pm.label}</option>)}</select>
          <input type="number" value={entry.amount || ''} onChange={ev => e.setSplits(p => p.map((x, j) => j === i ? { ...x, amount: parseFloat(ev.target.value) || 0 } : x))} placeholder="المبلغ" className={`flex-1 rounded-lg ${brd(5)} border ${bg(3)} px-2 py-1.5 text-[10px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} />
          {e.splits.length > 1 && <button onClick={() => e.setSplits(p => p.filter((_, j) => j !== i))} className={`${BS} text-red-400`}><X size={12} /></button>}
        </div>
      ))}
      <button onClick={() => e.setSplits(p => [...p, { method: 'card', amount: 0 }])} className={`${B} flex w-full items-center justify-center gap-1 rounded-xl border border-dashed ${brd(6)} py-2 text-[9px] text-[var(--muted-foreground)]`}><Plus size={10} /> إضافة</button>
      <div className={`flex justify-between rounded-xl ${bg(3)} p-3`}><span className="text-[10px] text-[var(--muted-foreground)]">المتبقي</span><span className={`text-[13px] font-black ${e.splitRem > 0.01 ? 'text-red-400' : 'text-emerald-400'}`} style={TN}>{fmt(e.splitRem)}</span></div>
      <button onClick={e.paySplit} disabled={e.splitRem > 0.01 || e.payMut.isPending} className={`${B} flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[11px] font-bold text-black shadow-lg disabled:opacity-20`} style={accentBg}>{e.payMut.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <><Split size={13} /> تأكيد</>}</button>
    </div>
  );
}

function HoldPanel({ e }: { e: E }) {
  if (!e.held.length) return <div className="py-8 text-center text-[var(--muted-foreground)]" style={{ opacity: 0.2 }}><Pause size={24} className="mx-auto mb-2" strokeWidth={1} /><p className="text-[10px]">لا توجد فواتير معلقة</p></div>;
  return (
    <div className="space-y-2">{e.held.map(b => (
      <div key={b.id} className={`flex items-center justify-between rounded-xl ${G3} p-3`}>
        <div><p className="text-[11px] font-bold text-[var(--foreground)]">{b.label}</p><p className="text-[8px] text-[var(--muted-foreground)]">{b.cart.length} خدمة &middot; {b.time} &middot; <span style={accentColor}>{fmt(b.total)}</span></p></div>
        <div className="flex gap-1"><button onClick={() => e.recallBill(b.id)} className={`${BS} rounded-lg px-3 py-1.5 text-[9px] font-bold text-black`} style={accentBg}>استدعاء</button><button onClick={() => e.setHeld(p => p.filter(x => x.id !== b.id))} className={`${BS} rounded-lg ${brd(5)} border px-2 py-1.5 text-red-400 hover:bg-red-500/10`}><Trash2 size={10} /></button></div>
      </div>
    ))}</div>
  );
}

function RefundPanel({ e }: { e: E }) {
  return (
    <div className="space-y-3">
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">رقم الفاتورة</label><div className="relative"><Hash size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input value={e.refId} onChange={ev => e.setRefId(ev.target.value)} placeholder="INV-XXXX" dir="ltr" className={`${INP} py-2.5 ps-8 pe-3 text-[11px]`} /></div></div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">سبب الإرجاع</label><textarea value={e.refReason} onChange={ev => e.setRefReason(ev.target.value)} placeholder="السبب..." rows={3} className={`w-full rounded-xl ${brd(6)} border ${bg(4)} p-3 text-[10px] text-[var(--foreground)] resize-none placeholder:text-[var(--muted-foreground)] focus:outline-none ${T}`} /></div>
      <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-2.5"><AlertTriangle size={12} className="text-red-400" /><p className="text-[8px] text-red-400">سيتم إرجاع المبلغ وتسجيل العملية</p></div>
      <button onClick={() => e.refMut.mutate()} disabled={!e.refId.trim() || !e.refReason.trim() || e.refMut.isPending} className={`${B} flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 text-[10px] font-bold text-white shadow-lg disabled:opacity-20`}>{e.refMut.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><RotateCcw size={12} /> تأكيد الإرجاع</>}</button>
    </div>
  );
}

function BundlesPanel({ e }: { e: E }) {
  return (
    <div className="space-y-3">{M_BUNDLES.map(b => (
      <button key={b.id} onClick={() => e.addBundle(b)} className={`${B} group flex w-full flex-col items-start gap-1.5 rounded-xl ${brd(4)} border ${bg(2)} p-4 text-start hover:${bg(4)}`}>
        <div className="flex items-center gap-1.5"><Package size={12} style={accentColor} /><span className="text-[12px] font-bold text-[var(--foreground)]">{b.nameAr}</span></div>
        <div className="flex items-center gap-2"><span className="text-[14px] font-black" style={{ ...TN, ...accentColor }}>{fmt(b.price)}</span><span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">وفّر {fmt(b.savings)}</span></div>
        <p className="text-[8px] text-[var(--muted-foreground)]">{b.services.map(bs => e.allSvcs.find(s => s.id === bs.serviceId)?.nameAr).filter(Boolean).join(' + ')}</p>
      </button>
    ))}</div>
  );
}

function ReceiptPanel({ e }: { e: E }) {
  return (
    <div className="space-y-3">
      <label className={`flex items-center gap-2.5 rounded-xl ${bg(3)} px-3 py-2.5 cursor-pointer ${T}`}>
        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${e.receiptLogo ? 'border-transparent' : brd(10)}`} style={e.receiptLogo ? accentBg : undefined}>{e.receiptLogo && <Check size={9} className="text-black" />}</div>
        <input type="checkbox" checked={e.receiptLogo} onChange={ev => e.setReceiptLogo(ev.target.checked)} className="sr-only" /><span className="text-[10px] text-[var(--foreground)]">عرض شعار الصالون</span>
      </label>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">رسالة الشكر</label><input value={e.receiptMsg} onChange={ev => e.setReceiptMsg(ev.target.value)} className={`${INP} py-2.5 px-3 text-[11px]`} /></div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">رقم الهاتف في الإيصال</label><input value={e.receiptPhone} onChange={ev => e.setReceiptPhone(ev.target.value)} dir="ltr" className={`${INP} py-2.5 px-3 text-[11px]`} /></div>
      <button onClick={() => { toast.success('تم حفظ الإعدادات'); e.setPanel(null); }} className={`${B} flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-[10px] font-bold text-black`} style={accentBg}><Check size={12} /> حفظ</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SHARED MODALS RENDERER
   ═══════════════════════════════════════════════════════════════════════════════ */

function PanelModals({ e }: { e: E }) {
  return (
    <>
      <Modal open={e.panel === 'split'} onClose={() => e.setPanel(null)} title="دفع مقسّم" wide><SplitPanel e={e} /></Modal>
      <Modal open={e.panel === 'hold-list'} onClose={() => e.setPanel(null)} title="الفواتير المعلقة"><HoldPanel e={e} /></Modal>
      <Modal open={e.panel === 'refund'} onClose={() => e.setPanel(null)} title="إرجاع / إلغاء"><RefundPanel e={e} /></Modal>
      <Modal open={e.panel === 'bundles'} onClose={() => e.setPanel(null)} title="الباقات"><BundlesPanel e={e} /></Modal>
      <Modal open={e.panel === 'receipt'} onClose={() => e.setPanel(null)} title="إعدادات الإيصال"><ReceiptPanel e={e} /></Modal>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CLIENT SECTION (shared, with size variant)
   ═══════════════════════════════════════════════════════════════════════════════ */

function ClientSection({ e, lg }: { e: E; lg?: boolean }) {
  const sz = lg ? { wrap: 'p-4 space-y-3', inp: 'py-3.5 ps-10 pe-4 text-[14px] rounded-2xl', avatar: 'h-12 w-12 text-[16px]', name: 'text-[14px]', ph: 'text-[11px]', btn: 'text-[13px]', note: 'py-2.5 ps-9 pe-3 text-[11px] rounded-xl' }
    : { wrap: 'p-3 space-y-2', inp: 'py-2 ps-8 pe-2 text-[11px]', avatar: 'h-9 w-9 text-[12px]', name: 'text-[11px]', ph: 'text-[8px]', btn: 'text-[9px]', note: 'py-1.5 ps-6 pe-2 text-[8px] rounded-lg' };

  return (
    <div className={`shrink-0 ${brd(4)} border-b ${sz.wrap}`}>
      <div className="flex items-center gap-1.5"><User size={lg ? 14 : 10} style={accentColor} /><span className={`${lg ? 'text-[13px]' : 'text-[10px]'} font-bold text-[var(--foreground)]`}>العميل</span></div>
      {e.client ? (
        <div className={`rounded-xl ${G3} p-2.5`}>
          <div className="flex items-center gap-2">
            <div className={`flex ${sz.avatar} shrink-0 items-center justify-center rounded-full font-bold`} style={{ ...accentMix(15), ...accentColor }}>{e.client.fullName.charAt(0)}</div>
            <div className="min-w-0 flex-1">
              <p className={`truncate ${sz.name} font-bold text-[var(--foreground)]`}>{e.client.fullName}{e.client.totalVisits >= 10 && <Crown size={9} className="inline ms-1" style={accentColor} />}</p>
              <p className={`${sz.ph} text-[var(--muted-foreground)]`} dir="ltr">{e.client.phone}</p>
            </div>
            <button onClick={() => e.setClient(null)} className={`${BS} text-[8px] font-semibold`} style={accentColor}>تغيير</button>
          </div>
          {!lg && <div className={`mt-2 flex gap-4 ${brd(4)} border-t pt-2`}><div><p className="text-[12px] font-black text-[var(--foreground)]" style={TN}>{e.client.totalVisits}</p><p className="text-[7px] text-[var(--muted-foreground)]">زيارة</p></div><div><p className="text-[12px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.client.totalSpent)}</p><p className="text-[7px] text-[var(--muted-foreground)]">إنفاق</p></div></div>}
          {e.client.notes && <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[8px] text-amber-400">{e.client.notes}</p>}
        </div>
      ) : e.walkInMode ? (
        <div className="space-y-1.5">
          <div className="relative"><User size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input value={e.walkName} onChange={ev => e.setWalkName(ev.target.value)} placeholder="اسم العميل" className={`${INP} ${sz.inp}`} /></div>
          <div className="relative"><Phone size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input value={e.walkPhone} onChange={ev => e.setWalkPhone(ev.target.value)} placeholder="رقم الجوال" dir="ltr" className={`${INP} ${sz.inp}`} /></div>
          <button onClick={() => { e.setWalkInMode(false); e.setWalkName(''); e.setWalkPhone(''); }} className="text-[8px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">إلغاء</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative">
            <Search size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
            <input value={e.cliSearch} onChange={ev => e.setCliSearch(ev.target.value)} placeholder="بحث بالاسم أو الجوال..." className={`${INP} ${sz.inp}`} />
            {e.cliResults.length > 0 && e.cliSearch.length >= 2 && (
              <div className={`absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl ${G2}`}>
                {e.cliResults.map(c => (
                  <button key={c.id} onClick={() => { e.setClient(c); e.setCliSearch(''); }} className={`${B} flex w-full items-center gap-2 px-3 py-2 text-start hover:${bg(4)}`}>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold" style={{ ...accentMix(12), ...accentColor }}>{c.fullName.charAt(0)}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium text-[var(--foreground)]">{c.fullName}</p><p className="text-[7px] text-[var(--muted-foreground)]" dir="ltr">{c.phone}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => e.setWalkInMode(true)} className={`${B} flex w-full items-center justify-center gap-1 rounded-xl border border-dashed ${brd(6)} py-2 ${sz.btn} font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><UserPlus size={lg ? 16 : 11} /> Walk-in</button>
        </div>
      )}
      <div className="relative">
        <StickyNote size={9} className="absolute start-2 top-1.5 text-[var(--muted-foreground)]" style={{ opacity: 0.2 }} />
        <input value={e.custNote} onChange={ev => e.setCustNote(ev.target.value)} placeholder="ملاحظة..." className={`w-full ${brd(3)} border ${bg(2)} text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none ${T} ${sz.note}`} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   EMPLOYEE PICKER (shared)
   ═══════════════════════════════════════════════════════════════════════════════ */

function EmployeePicker({ e, lg }: { e: E; lg?: boolean }) {
  return (
    <div className={`shrink-0 ${brd(4)} border-b ${lg ? 'p-4 space-y-2' : 'p-3 space-y-2'}`}>
      <div className="flex items-center gap-1.5"><Scissors size={lg ? 14 : 10} style={accentColor} /><span className={`${lg ? 'text-[13px]' : 'text-[10px]'} font-bold text-[var(--foreground)]`}>الموظفة</span></div>
      <div className="flex flex-wrap gap-1">
        {e.emps.map(emp => (
          <button key={emp.id} onClick={() => e.setDefEmployee(e.defEmployee?.id === emp.id ? null : emp)}
            className={`${BS} rounded-lg ${lg ? 'px-4 py-2.5 text-[12px]' : 'px-2.5 py-1.5 text-[9px]'} font-semibold ${e.defEmployee?.id === emp.id ? 'text-black shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`}
            style={e.defEmployee?.id === emp.id ? accentBg : undefined}>{emp.fullName.split(' ')[0]}</button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SERVICE GRID (shared with size variant)
   ═══════════════════════════════════════════════════════════════════════════════ */

function ServiceGrid({ e, lg }: { e: E; lg?: boolean }) {
  const list = e.showBundles ? [] : e.showFavs ? e.favSvcs : e.filtered;
  if (e.showBundles) return (
    <div className={`grid gap-2 ${lg ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'}`}>
      {M_BUNDLES.map(b => (
        <button key={b.id} onClick={() => e.addBundle(b)} className={`${B} group flex flex-col items-start gap-1.5 rounded-2xl ${brd(4)} border ${bg(2)} p-4 text-start hover:${bg(4)}`}>
          <div className="flex items-center gap-1.5"><Package size={12} style={accentColor} /><span className="text-[12px] font-bold text-[var(--foreground)]">{b.nameAr}</span></div>
          <div className="flex items-center gap-2"><span className="text-[14px] font-black" style={{ ...TN, ...accentColor }}>{fmt(b.price)}</span><span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">وفّر {fmt(b.savings)}</span></div>
          <p className="text-[8px] text-[var(--muted-foreground)]">{b.services.map(bs => e.allSvcs.find(s => s.id === bs.serviceId)?.nameAr).filter(Boolean).join(' + ')}</p>
        </button>
      ))}
    </div>
  );
  if (!list.length) return <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]" style={{ opacity: 0.2 }}><Search size={32} strokeWidth={1} /><p className="text-[11px]">{e.showFavs ? 'لا توجد خدمات مفضلة' : 'لا توجد خدمات'}</p></div>;
  return (
    <div className={`grid ${lg ? 'grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'}`}>
      {list.map(svc => {
        const qty = e.cart.filter(c => c.service.id === svc.id).reduce((s, i) => s + i.quantity, 0);
        const isFav = e.favIds.includes(svc.id);
        return (
          <div key={svc.id} className="relative group">
            <button onClick={() => e.addToCart(svc)} className={`${BS} flex w-full flex-col items-start gap-0.5 rounded-xl border ${lg ? 'p-5 min-h-[120px] rounded-2xl gap-1.5' : 'p-3'} text-start ${qty > 0 ? `${brd(0)} shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand-primary)_25%,transparent)]` : `${brd(3)} ${bg(2)} hover:${bg(4)}`}`} style={qty > 0 ? { background: 'color-mix(in srgb, var(--brand-primary) 5%, transparent)' } : undefined}>
              {qty > 0 && <span className={`absolute end-2 top-2 flex items-center justify-center rounded-md text-[8px] font-black text-white ${lg ? 'h-8 w-8 rounded-xl text-[12px]' : 'h-5 w-5'}`} style={{ ...TN, ...primaryBg }}>{qty}</span>}
              <span className={`${lg ? 'text-[15px]' : 'text-[11px]'} font-semibold leading-snug text-[var(--foreground)] line-clamp-2`}>{svc.nameAr}</span>
              <span className={`flex items-center gap-1 ${lg ? 'text-[11px]' : 'text-[8px]'} text-[var(--muted-foreground)]`} style={{ opacity: 0.5 }}><Clock size={lg ? 11 : 8} />{svc.duration}د</span>
              <span className={`mt-auto pt-0.5 ${lg ? 'text-[18px]' : 'text-[13px]'} font-black`} style={{ ...TN, ...accentColor }}>{fmt(svc.price)}<span className={`${lg ? 'text-[10px]' : 'text-[7px]'} font-semibold opacity-40 ms-0.5`}>ر.س</span></span>
            </button>
            <button onClick={() => e.toggleFav(svc.id)} className={`${BS} absolute start-1.5 top-1.5 rounded-md p-1 ${isFav ? '' : 'opacity-0 group-hover:opacity-60'} hover:opacity-100`} style={isFav ? accentColor : { color: 'var(--muted-foreground)' }}>{isFav ? <Star size={9} fill="currentColor" /> : <StarOff size={9} />}</button>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CATEGORY BAR (shared)
   ═══════════════════════════════════════════════════════════════════════════════ */

function CategoryBar({ e, lg }: { e: E; lg?: boolean }) {
  const sz = lg ? 'px-5 py-3 text-[13px] rounded-2xl gap-1.5' : 'px-3 py-2 text-[10px] rounded-xl gap-1';
  return (
    <div className={`flex shrink-0 ${lg ? 'gap-2 px-4 pb-2' : 'gap-1.5 px-3 pb-1.5'}`}>
      <button onClick={() => { e.setShowFavs(!e.showFavs); e.setShowBundles(false); }} className={`${BS} flex items-center ${sz} font-bold ${e.showFavs ? 'text-black shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={e.showFavs ? accentBg : undefined}><Star size={lg ? 14 : 10} /> المفضلة</button>
      <button onClick={() => { e.setShowBundles(!e.showBundles); e.setShowFavs(false); }} className={`${BS} flex items-center ${sz} font-bold ${e.showBundles ? 'text-black shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={e.showBundles ? accentBg : undefined}><Package size={lg ? 14 : 10} /> الباقات</button>
      <div className={`w-px ${bg(4)}`} />
      <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => { e.setSelCat(null); e.setShowFavs(false); e.setShowBundles(false); }} className={`${BS} flex shrink-0 items-center ${sz} font-bold ${!e.selCat && !e.showFavs && !e.showBundles ? 'text-white shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={!e.selCat && !e.showFavs && !e.showBundles ? primaryBg : undefined}>الكل</button>
        {e.cats?.map(c => { const I = CAT_ICO[c.nameAr] ?? Scissors; return (
          <button key={c.id} onClick={() => { e.setSelCat(c.id); e.setShowFavs(false); e.setShowBundles(false); }} className={`${BS} flex shrink-0 items-center ${sz} font-bold ${e.selCat === c.id ? 'text-white shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={e.selCat === c.id ? primaryBg : undefined}><I size={lg ? 14 : 10} /> {c.nameAr}</button>
        ); })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DESKTOP POS — 3-column layout with full detail
   Keyboard shortcut (/ → search), expandable cart items, email toggle
   ═══════════════════════════════════════════════════════════════════════════════ */

function DesktopPOS({ e }: { e: E }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const h = (ev: KeyboardEvent) => { if (ev.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')) { ev.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)]" dir="rtl">
      {/* HEADER */}
      <header className={`flex shrink-0 items-center justify-between gap-3 px-4 py-2 ${G2} ${brd(4)} border-b`}>
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl shadow-lg" style={primaryBg}><Receipt size={14} className="text-white" /></div>
          <div><span className="text-[13px] font-black tracking-tight text-[var(--foreground)]">SERVIX</span><span className="ms-1.5 text-[9px] font-bold" style={accentColor}>POS</span></div>
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-bold ${e.online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/15 text-red-400 animate-pulse'}`}>{e.online ? <Wifi size={9} /> : <WifiOff size={9} />}{e.online ? 'متصل' : 'غير متصل'}</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e.holdBill} className={`${B} group relative flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><Pause size={12} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /><span className="hidden text-[9px] font-semibold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] sm:inline">تعليق</span>{e.held.length > 0 && <span className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black text-black" style={accentBg}>{e.held.length}</span>}</button>
          <button onClick={() => e.setPanel('hold-list')} className={`${B} group flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><Play size={12} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /><span className="hidden text-[9px] font-semibold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] sm:inline">استدعاء</span></button>
          <button onClick={() => e.setPanel('refund')} className={`${B} group flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><RotateCcw size={12} className="text-[var(--muted-foreground)] group-hover:text-red-400" /><span className="hidden text-[9px] font-semibold text-[var(--muted-foreground)] group-hover:text-red-400 sm:inline">إرجاع</span></button>
          <button onClick={() => e.setPanel('receipt')} className={`${B} group flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><Printer size={12} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /></button>
          <div className={`mx-0.5 h-4 w-px ${bg(6)}`} />
          <Link href="/" className={`${B} flex h-8 w-8 items-center justify-center rounded-xl ${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><ArrowLeft size={13} /></Link>
        </div>
      </header>

      {/* 3-COLUMN BODY */}
      <div className="flex flex-1 min-h-0">
        {/* COL 1: CLIENT */}
        <aside className={`hidden w-[270px] shrink-0 flex-col ${brd(4)} border-e lg:flex ${G1}`}>
          <ClientSection e={e} />
          <EmployeePicker e={e} />
          {e.comms.length > 0 && (
            <div className={`shrink-0 ${brd(4)} border-b p-3 space-y-1.5`}>
              <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><CircleDollarSign size={10} className="text-emerald-400" /><span className="text-[10px] font-bold text-[var(--foreground)]">العمولات</span></div><span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400" style={TN}>{fmt(e.totalComm)}</span></div>
              {e.comms.map((c, i) => (<div key={i} className={`flex justify-between rounded-lg ${bg(2)} px-2 py-1`}><span className="text-[9px] text-[var(--muted-foreground)]">{c.name} <span className="opacity-40">({c.type === 'percentage' ? `${c.rate}%` : `${c.rate}ر.س`})</span></span><span className="text-[9px] font-bold text-emerald-400" style={TN}>{fmt(c.amount)}</span></div>))}
            </div>
          )}
          <div className="flex-1" />
          <div className="shrink-0 p-3 space-y-0.5">
            <p className="mb-1 text-[7px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>إرسال الإيصال</p>
            {[{ ck: e.sendWA, set: e.setSendWA, icon: MessageCircle, label: 'واتساب', clr: 'text-emerald-400' }, { ck: e.sendMail, set: e.setSendMail, icon: Mail, label: 'إيميل', clr: 'text-sky-400' }].map(o => (
              <label key={o.label} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer ${T} hover:${bg(3)}`}>
                <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${o.ck ? 'border-transparent' : brd(10)} ${T}`} style={o.ck ? accentBg : undefined}>{o.ck && <Check size={8} className="text-black" />}</div>
                <input type="checkbox" checked={o.ck} onChange={ev => o.set(ev.target.checked)} className="sr-only" />
                <o.icon size={10} className={o.clr} /><span className="text-[9px] text-[var(--muted-foreground)]">{o.label}</span>
              </label>
            ))}
          </div>
        </aside>

        {/* COL 2: SERVICES */}
        <main className="flex flex-1 flex-col min-w-0">
          <div className="shrink-0 p-3 pb-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
              <input ref={searchRef} value={e.svcSearch} onChange={ev => e.setSvcSearch(ev.target.value)} placeholder='بحث عن خدمة...  ⌨ /' className={`flex h-11 w-full rounded-2xl ${brd(5)} border ${bg(3)} backdrop-blur-xl ps-11 pe-10 text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]/30 ${T}`} />
              {e.svcSearch && <button onClick={() => e.setSvcSearch('')} className={`${BS} absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--muted-foreground)] hover:${bg(5)}`}><X size={11} /></button>}
            </div>
          </div>
          <CategoryBar e={e} />
          <div className="flex-1 overflow-y-auto p-3 pt-1"><ServiceGrid e={e} /></div>
        </main>

        {/* COL 3: CART */}
        <aside className={`hidden w-[340px] shrink-0 flex-col ${brd(4)} border-s lg:flex ${G1}`}>
          <div className={`flex shrink-0 items-center justify-between px-3.5 py-2.5 ${brd(4)} border-b`}>
            <div className="flex items-center gap-2"><ShoppingCart size={12} style={accentColor} /><span className="text-[11px] font-bold text-[var(--foreground)]">السلة</span>{e.cartCount > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1 text-[8px] font-black text-black" style={{ ...TN, ...accentBg }}>{e.cartCount}</span>}</div>
            {e.cart.length > 0 && <button onClick={e.clearAll} className={`${BS} rounded-md px-2 py-0.5 text-[8px] font-semibold text-red-400 hover:bg-red-500/10`}>مسح</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {!e.cart.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[var(--muted-foreground)]" style={{ opacity: 0.15 }}><ShoppingCart size={24} strokeWidth={1} /><p className="text-[9px]">اضغط على خدمة لإضافتها</p></div>
            ) : (
              <div className="space-y-1">{e.cart.map(item => {
                const info = e.itemTotals.find(t => t.id === item.id);
                const isExp = expanded === item.id;
                return (
                  <div key={item.id} className={`rounded-xl ${brd(3)} border ${bg(2)} ${T} ${isExp ? 'ring-1 ring-[color-mix(in_srgb,var(--foreground)_6%,transparent)]' : ''}`}>
                    <div className="flex items-center gap-1 p-2">
                      <button onClick={() => setExpanded(isExp ? null : item.id)} className={`${BS} flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:${bg(4)} hover:text-[var(--foreground)]`} style={{ opacity: 0.3 }}>{isExp ? <ChevronUp size={10} /> : <ChevronDown size={10} />}</button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold text-[var(--foreground)]">{item.service.nameAr}{item.bundleId && <Package size={7} className="inline ms-1 text-[var(--muted-foreground)]" />}</p>
                        <div className="flex items-center gap-1 text-[7px] text-[var(--muted-foreground)]" style={{ opacity: 0.6 }}><Users size={6} /> {item.employeeName}{item.discount > 0 && <span className="text-emerald-400">-{item.discountType === 'percentage' ? `${item.discount}%` : fmt(item.discount)}</span>}</div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => e.updateQty(item.id, -1)} className={`${BS} flex h-6 w-6 items-center justify-center rounded-md ${brd(5)} border text-[var(--muted-foreground)]`}><Minus size={9} /></button>
                        <span className="w-5 text-center text-[10px] font-bold text-[var(--foreground)]" style={TN}>{item.quantity}</span>
                        <button onClick={() => e.updateQty(item.id, 1)} className={`${BS} flex h-6 w-6 items-center justify-center rounded-md ${brd(5)} border text-[var(--muted-foreground)]`}><Plus size={9} /></button>
                      </div>
                      <span className="w-14 text-end text-[10px] font-bold" style={{ ...TN, ...accentColor }}>{fmt(info?.net ?? 0)}</span>
                      <button onClick={() => { e.removeItem(item.id); setExpanded(null); }} className={`${BS} flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400`} style={{ opacity: 0.2 }}><Trash2 size={9} /></button>
                    </div>
                    {isExp && (
                      <div className={`${brd(3)} border-t px-2.5 py-2 space-y-1.5`}>
                        <div><label className="mb-0.5 block text-[7px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>الموظفة</label><div className="flex flex-wrap gap-1">{e.emps.map(emp => (<button key={emp.id} onClick={() => e.setItemEmp(item.id, emp)} className={`${BS} rounded-md px-2 py-1 text-[8px] font-semibold ${item.employeeId === emp.id ? 'text-black' : `${bg(3)} text-[var(--muted-foreground)]`}`} style={item.employeeId === emp.id ? accentBg : undefined}>{emp.fullName.split(' ')[0]}</button>))}</div></div>
                        <div><label className="mb-0.5 block text-[7px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>خصم خاص</label><div className="flex items-center gap-1"><input type="number" value={item.discount || ''} onChange={ev => e.setItemDisc(item.id, parseFloat(ev.target.value) || 0, item.discountType)} placeholder="0" className={`w-14 rounded-md ${brd(5)} border ${bg(3)} px-2 py-1 text-[9px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /><div className={`flex overflow-hidden rounded-md ${brd(5)} border`}><button onClick={() => e.setItemDisc(item.id, item.discount, 'fixed')} className={`${BS} px-1.5 py-1 text-[7px] font-bold ${item.discountType === 'fixed' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={item.discountType === 'fixed' ? accentBg : undefined}>ر.س</button><button onClick={() => e.setItemDisc(item.id, item.discount, 'percentage')} className={`${BS} px-1.5 py-1 text-[7px] font-bold ${item.discountType === 'percentage' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={item.discountType === 'percentage' ? accentBg : undefined}>%</button></div></div></div>
                        <input value={item.note} onChange={ev => e.setItemNote(item.id, ev.target.value)} placeholder="ملاحظة..." className={`w-full rounded-md ${brd(3)} border ${bg(2)} px-2 py-1 text-[8px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none ${T}`} />
                      </div>
                    )}
                  </div>
                );
              })}</div>
            )}
          </div>
          {/* Totals + Payment */}
          {e.cart.length > 0 && (
            <div className={`shrink-0 ${brd(4)} border-t px-3.5 py-2.5 space-y-2`}>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-1"><Percent size={9} className="shrink-0 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input type="number" value={e.globalDisc} onChange={ev => e.setGlobalDisc(ev.target.value)} placeholder="خصم" className={`w-14 rounded-lg ${brd(5)} border ${bg(3)} px-2 py-1.5 text-[9px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /><div className={`flex overflow-hidden rounded-lg ${brd(5)} border`}><button onClick={() => e.setGlobalDiscType('fixed')} className={`${BS} px-1.5 py-1.5 text-[7px] font-bold ${e.globalDiscType === 'fixed' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={e.globalDiscType === 'fixed' ? accentBg : undefined}>ر.س</button><button onClick={() => e.setGlobalDiscType('percentage')} className={`${BS} px-1.5 py-1.5 text-[7px] font-bold ${e.globalDiscType === 'percentage' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={e.globalDiscType === 'percentage' ? accentBg : undefined}>%</button></div></div>
                <div className="flex items-center gap-1"><Heart size={9} className="shrink-0 text-pink-400" style={{ opacity: 0.5 }} /><input type="number" value={e.tipInput} onChange={ev => e.setTipInput(ev.target.value)} placeholder="إكرامية" className={`w-14 rounded-lg ${brd(5)} border ${bg(3)} px-2 py-1.5 text-[9px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /></div>
              </div>
              <div className={`space-y-1 rounded-xl ${bg(2)} p-2.5`}>
                <div className="flex justify-between text-[9px]"><span className="text-[var(--muted-foreground)]">المجموع الفرعي</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.subtotal)}</span></div>
                {e.gDiscVal > 0 && <div className="flex justify-between text-[9px]"><span className="text-emerald-400">الخصم</span><span className="font-semibold text-emerald-400" style={TN}>-{fmt(e.gDiscVal)}</span></div>}
                <div className="flex justify-between text-[9px]"><span className="text-[var(--muted-foreground)]">ضريبة 15%</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.tax)}</span></div>
                {e.tip > 0 && <div className="flex justify-between text-[9px]"><span className="text-pink-400">إكرامية</span><span className="font-semibold text-pink-400" style={TN}>{fmt(e.tip)}</span></div>}
                <div className={`flex items-baseline justify-between ${brd(4)} border-t pt-1.5`}><span className="text-[10px] font-bold text-[var(--foreground)]">الإجمالي</span><span className="text-[17px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)} <span className="text-[8px] font-semibold opacity-40">ر.س</span></span></div>
              </div>
              <div className="grid grid-cols-4 gap-1">{PAY.map(pm => (<button key={pm.id} onClick={() => e.pay(pm.id)} disabled={e.payMut.isPending || !e.canPay} className={`${BS} flex flex-col items-center gap-1 rounded-xl ${brd(4)} border ${bg(2)} py-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-15 disabled:pointer-events-none`}><pm.icon size={15} strokeWidth={1.5} /><span className="text-[7px] font-bold">{pm.label}</span></button>))}</div>
              <button onClick={() => { e.setSplits([{ method: 'cash', amount: 0 }, { method: 'card', amount: 0 }]); e.setPanel('split'); }} disabled={!e.canPay} className={`${B} flex w-full items-center justify-center gap-1 rounded-xl ${brd(4)} border py-2 text-[9px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-15`}><Split size={11} /> دفع مقسّم</button>
              <button onClick={() => e.pay('cash')} disabled={e.payMut.isPending || !e.canPay} className={`${B} relative flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-black shadow-xl disabled:opacity-15 disabled:pointer-events-none overflow-hidden`} style={e.canPay ? { background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, #000))', color: '#000' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{e.payMut.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <><Receipt size={14} /> إصدار فاتورة — {fmt(e.total)}</>}</button>
              <div className="flex gap-1"><button className={`${B} flex flex-1 items-center justify-center gap-1 rounded-xl ${brd(4)} border py-1.5 text-[8px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><Printer size={10} /> طباعة</button><button className={`${B} flex flex-1 items-center justify-center gap-1 rounded-xl ${brd(4)} border py-1.5 text-[8px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><QrCode size={10} /> ZATCA</button></div>
            </div>
          )}
        </aside>
      </div>

      {/* MOBILE BOTTOM */}
      <div className={`flex shrink-0 items-center justify-between ${brd(4)} border-t px-4 py-3 lg:hidden ${G2}`}>
        <div><p className="text-[7px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>الإجمالي</p><p className="text-[17px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)}</p></div>
        <div className="flex items-center gap-2">{e.cartCount > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[10px] font-black text-black" style={{ ...TN, ...accentBg }}>{e.cartCount}</span>}<button onClick={() => e.pay('cash')} disabled={e.payMut.isPending || !e.canPay} className={`${B} rounded-2xl px-6 py-2.5 text-[12px] font-bold text-black shadow-lg disabled:opacity-20`} style={accentBg}>{e.payMut.isPending ? '...' : 'ادفع'}</button></div>
      </div>

      <PanelModals e={e} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TOUCH POS — iPad/Tablet optimized
   Large touch targets, 2-column layout, simplified cart
   ═══════════════════════════════════════════════════════════════════════════════ */

function TouchPOS({ e }: { e: E }) {
  const [showCart, setShowCart] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)]" dir="rtl">
      {/* HEADER */}
      <header className={`flex shrink-0 items-center justify-between px-4 py-2.5 ${G2} ${brd(4)} border-b`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={primaryBg}><Receipt size={16} className="text-white" /></div>
          <div><span className="text-[15px] font-black text-[var(--foreground)]">Quick POS</span><span className="ms-1.5 text-[10px] font-bold" style={accentColor}>iPad</span></div>
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-bold ${e.online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/15 text-red-400 animate-pulse'}`}>{e.online ? <Wifi size={12} /> : <WifiOff size={12} />}{e.online ? 'متصل' : 'غير متصل'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e.holdBill} className={`${B} group relative flex h-11 items-center gap-2 rounded-2xl px-4 ${G1}`}><Pause size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /><span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">تعليق</span>{e.held.length > 0 && <span className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-black" style={accentBg}>{e.held.length}</span>}</button>
          <button onClick={() => e.setPanel('hold-list')} className={`${B} group flex h-11 items-center gap-2 rounded-2xl px-4 ${G1}`}><Play size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /><span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">استدعاء</span></button>
          <button onClick={() => e.setPanel('refund')} className={`${B} group flex h-11 items-center gap-2 rounded-2xl px-4 ${G1} hover:border-red-500/20`}><RotateCcw size={16} className="text-[var(--muted-foreground)] group-hover:text-red-400" /><span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-red-400">إرجاع</span></button>
          <button onClick={() => e.setPanel('bundles')} className={`${B} group flex h-11 items-center gap-2 rounded-2xl px-4 ${G1}`}><Package size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /><span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">الباقات</span></button>
          <button onClick={() => e.setPanel('receipt')} className={`${B} group flex h-11 w-11 items-center justify-center rounded-2xl ${G1}`}><Printer size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /></button>
        </div>
      </header>

      {/* 2-COLUMN BODY */}
      <div className="flex flex-1 min-h-0">
        {/* SERVICES */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="shrink-0 p-4 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
              <input value={e.svcSearch} onChange={ev => e.setSvcSearch(ev.target.value)} placeholder="بحث سريع..." className={`flex h-14 ${INP} rounded-2xl ps-12 pe-12 text-[16px]`} />
              {e.svcSearch && <button onClick={() => e.setSvcSearch('')} className={`${BS} absolute end-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[var(--muted-foreground)] hover:${bg(5)}`}><X size={16} /></button>}
            </div>
          </div>
          <CategoryBar e={e} lg />
          <div className="flex-1 overflow-y-auto p-4 pt-2"><ServiceGrid e={e} lg /></div>
        </div>

        {/* CART SIDEBAR (tablet) */}
        <aside className={`hidden w-[420px] shrink-0 flex-col border-s ${brd(4)} md:flex ${G1}`}>
          <ClientSection e={e} lg />
          <EmployeePicker e={e} lg />
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><ShoppingCart size={14} style={accentColor} /><span className="text-[13px] font-bold text-[var(--foreground)]">السلة</span>{e.cartCount > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[11px] font-black text-black" style={{ ...TN, ...accentBg }}>{e.cartCount}</span>}</div>
              {e.cart.length > 0 && <button onClick={e.clearAll} className={`${BS} text-[11px] font-semibold text-red-400 hover:bg-red-500/10 rounded-lg px-2 py-1`}>مسح</button>}
            </div>
            {!e.cart.length ? (
              <div className="py-12 text-center text-[var(--muted-foreground)]" style={{ opacity: 0.15 }}><ShoppingCart size={36} className="mx-auto mb-3" strokeWidth={1} /><p className="text-[13px]">اضغط على خدمة لإضافتها</p></div>
            ) : e.cart.map(item => {
              const info = e.itemTotals.find(t => t.id === item.id);
              return (
                <div key={item.id} className={`flex items-center gap-3 rounded-2xl border ${brd(4)} ${bg(2)} p-3.5 ${T}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[var(--foreground)]">{item.service.nameAr}{item.bundleId && <Package size={10} className="inline ms-1 text-[var(--muted-foreground)]" />}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]" style={{ opacity: 0.6 }}><span><Users size={9} className="inline" /> {item.employeeName}</span><span style={TN}>{fmt(info?.net ?? 0)}</span></div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => e.updateQty(item.id, -1)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl border ${brd(6)} text-[var(--muted-foreground)]`}><Minus size={16} /></button>
                    <span className="w-8 text-center text-[15px] font-black text-[var(--foreground)]" style={TN}>{item.quantity}</span>
                    <button onClick={() => e.updateQty(item.id, 1)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl border ${brd(6)} text-[var(--muted-foreground)]`}><Plus size={16} /></button>
                    <button onClick={() => e.removeItem(item.id)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400`} style={{ opacity: 0.3 }}><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Bottom: Totals + Payment */}
          {e.cart.length > 0 && (
            <div className={`shrink-0 border-t ${brd(4)} p-4 space-y-3`}>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-1.5"><Percent size={12} className="shrink-0 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input type="number" value={e.globalDisc} onChange={ev => e.setGlobalDisc(ev.target.value)} placeholder="خصم" className={`w-16 rounded-xl border ${brd(6)} ${bg(3)} px-3 py-2.5 text-[12px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /><div className={`flex overflow-hidden rounded-xl border ${brd(6)}`}><button onClick={() => e.setGlobalDiscType('fixed')} className={`${BS} px-3 py-2.5 text-[10px] font-bold ${e.globalDiscType === 'fixed' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={e.globalDiscType === 'fixed' ? accentBg : undefined}>ر.س</button><button onClick={() => e.setGlobalDiscType('percentage')} className={`${BS} px-3 py-2.5 text-[10px] font-bold ${e.globalDiscType === 'percentage' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={e.globalDiscType === 'percentage' ? accentBg : undefined}>%</button></div></div>
                <div className="flex items-center gap-1.5"><Heart size={12} className="shrink-0 text-pink-400" style={{ opacity: 0.5 }} /><input type="number" value={e.tipInput} onChange={ev => e.setTipInput(ev.target.value)} placeholder="إكرامية" className={`w-16 rounded-xl border ${brd(6)} ${bg(3)} px-3 py-2.5 text-[12px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /></div>
              </div>
              {e.comms.length > 0 && <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 px-3 py-2"><div className="flex items-center gap-1.5"><CircleDollarSign size={12} className="text-emerald-400" /><span className="text-[11px] font-bold text-emerald-400">العمولات</span></div><span className="text-[12px] font-black text-emerald-400" style={TN}>{fmt(e.totalComm)}</span></div>}
              <div className={`space-y-1.5 rounded-2xl ${bg(2)} p-3.5`}>
                <div className="flex justify-between text-[12px]"><span className="text-[var(--muted-foreground)]">المجموع الفرعي</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.subtotal)}</span></div>
                {e.gDiscVal > 0 && <div className="flex justify-between text-[12px]"><span className="text-emerald-400">الخصم</span><span className="font-semibold text-emerald-400" style={TN}>-{fmt(e.gDiscVal)}</span></div>}
                <div className="flex justify-between text-[12px]"><span className="text-[var(--muted-foreground)]">ضريبة 15%</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.tax)}</span></div>
                {e.tip > 0 && <div className="flex justify-between text-[12px]"><span className="text-pink-400">إكرامية</span><span className="font-semibold text-pink-400" style={TN}>{fmt(e.tip)}</span></div>}
                <div className={`flex items-baseline justify-between border-t ${brd(4)} pt-2`}><span className="text-[13px] font-bold text-[var(--foreground)]">الإجمالي</span><span className="text-[22px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)} <span className="text-[10px] font-semibold opacity-40">ر.س</span></span></div>
              </div>
              <label className={`flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer ${T} hover:${bg(3)}`}><div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${e.sendWA ? 'border-transparent' : brd(10)}`} style={e.sendWA ? accentBg : undefined}>{e.sendWA && <Check size={11} className="text-black" />}</div><input type="checkbox" checked={e.sendWA} onChange={ev => e.setSendWA(ev.target.checked)} className="sr-only" /><MessageCircle size={14} className="text-emerald-400" /><span className="text-[12px] text-[var(--muted-foreground)]">إرسال واتساب</span></label>
              <div className="grid grid-cols-4 gap-2">{PAY.map(pm => (<button key={pm.id} onClick={() => e.pay(pm.id)} disabled={e.payMut.isPending || !e.canPay} className={`${BS} flex flex-col items-center gap-1.5 rounded-2xl border ${brd(4)} ${bg(2)} py-3.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-15 disabled:pointer-events-none`}><pm.icon size={20} strokeWidth={1.5} /><span className="text-[10px] font-bold">{pm.label}</span></button>))}</div>
              <button onClick={() => { e.setSplits([{ method: 'cash', amount: 0 }, { method: 'card', amount: 0 }]); e.setPanel('split'); }} disabled={!e.canPay} className={`${B} flex w-full items-center justify-center gap-2 rounded-2xl border ${brd(4)} py-3 text-[12px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-15`}><Split size={14} /> دفع مقسّم</button>
              <button onClick={() => e.pay('cash')} disabled={e.payMut.isPending || !e.canPay} className={`${B} relative flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-[16px] font-black text-black shadow-xl disabled:opacity-15 disabled:pointer-events-none overflow-hidden`} style={e.canPay ? { background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, #000))' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{e.payMut.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <><Receipt size={18} /> إصدار فاتورة — {fmt(e.total)}</>}</button>
            </div>
          )}
        </aside>
      </div>

      {/* MOBILE BOTTOM BAR */}
      <div className={`flex shrink-0 items-center justify-between border-t ${brd(4)} px-5 py-3.5 md:hidden ${G2}`}>
        <div><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>الإجمالي</p><p className="text-[22px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)}</p></div>
        <div className="flex items-center gap-3">
          {e.cartCount > 0 && <button onClick={() => setShowCart(!showCart)} className={`${B} flex items-center gap-2 rounded-2xl px-4 py-3 ${G1}`}><ShoppingCart size={16} style={accentColor} /><span className="text-[13px] font-black text-[var(--foreground)]" style={TN}>{e.cartCount}</span></button>}
          <button onClick={() => e.pay('cash')} disabled={e.payMut.isPending || !e.canPay} className={`${B} rounded-2xl px-8 py-3.5 text-[14px] font-bold text-black shadow-lg disabled:opacity-20`} style={accentBg}>{e.payMut.isPending ? '...' : 'ادفع'}</button>
        </div>
      </div>

      <PanelModals e={e} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   LOADING SHELL
   ═══════════════════════════════════════════════════════════════════════════════ */

function LoadingShell() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-[var(--background)]" dir="rtl">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={accentMix(15)}>
          <Receipt size={24} style={accentColor} />
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">جارٍ التحميل...</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE — Auto-detects device, renders appropriate layout
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function POSPage() {
  const mode = useDeviceMode();
  const engine = usePOSEngine();

  if (!mode) return <LoadingShell />;
  return mode === 'desktop' ? <DesktopPOS e={engine} /> : <TouchPOS e={engine} />;
}
