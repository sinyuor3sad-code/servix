'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Minus, Plus, Trash2, Banknote, CreditCard, Building2,
  ShoppingCart, UserPlus, Smartphone, Receipt,
  Printer, MessageCircle, Crown, Clock, Scissors, Sparkles,
  X, User, Phone, Star, Zap,
  Pause, Play, RotateCcw, Heart, StickyNote,
  Split, Users, AlertTriangle,
  Hash, Check, CircleDollarSign, Wifi, WifiOff,
  Package, StarOff, Percent, Monitor,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import { api } from '@/lib/api';
import type { Service, ServiceCategory, Client, Employee, PaginatedResponse } from '@/types';

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */

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

type PanelType = null | 'split' | 'hold-list' | 'refund' | 'receipt' | 'bundles';

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS + HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

const TAX = 0.15;
const TN: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

function fmt(v: number) { return v.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); }
const isDev = (t: string | null) => !t || t.startsWith('dev-');

/* ═══════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════ */

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

const CAT_ICO: Record<string, React.ElementType> = {
  'شعر': Scissors, 'بشرة': Sparkles, 'مكياج': Star,
  'أظافر': Zap, 'عروس': Crown, 'حمام مغربي': Heart,
};

const PAY_METHODS = [
  { id: 'cash',          label: 'نقدي',      icon: Banknote },
  { id: 'card',          label: 'بطاقة/مدى', icon: CreditCard },
  { id: 'bank_transfer', label: 'تحويل',     icon: Building2 },
  { id: 'apple_pay',     label: 'Apple Pay',  icon: Smartphone },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Obsidian Nexus (iPad-optimized)
   100% CSS Variables — zero hardcoded colors
   Supports: Velvet · Crystal · Orchid · Noir × light/dark
   ═══════════════════════════════════════════════════════════════════════════════ */

// Glass layers (increasing depth)
const G1 = 'backdrop-blur-[36px] bg-[color-mix(in_srgb,var(--card)_35%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_4%,transparent)]';
const G2 = 'backdrop-blur-[48px] bg-[color-mix(in_srgb,var(--card)_55%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_3%,transparent)]';
const G3 = 'backdrop-blur-[32px] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_3%,transparent)]';

// Transitions (buttery cubic-bezier)
const T  = 'transition-all duration-[140ms] ease-[cubic-bezier(0.23,1,0.32,1)]';
const TF = 'transition-all duration-[100ms] ease-[cubic-bezier(0.23,1,0.32,1)]';

// Buttons — large touch targets for iPad
const B  = `${T} active:scale-[0.96] touch-manipulation select-none cursor-pointer`;
const BS = `${TF} active:scale-[0.94] touch-manipulation select-none cursor-pointer`;

// Input base
const INP = `w-full rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)]/40 ${T}`;

// Accent inline styles (CSS vars only — adapts to all themes)
const accentBg    = { background: 'var(--brand-accent)' } as const;
const accentColor = { color: 'var(--brand-accent)' } as const;
const accentMix   = (pct: number) => ({ background: `color-mix(in srgb, var(--brand-accent) ${pct}%, transparent)` });
const primaryBg   = { background: 'var(--brand-primary)' } as const;

// Shared utilities
const brd = (pct: number) => `border-[color-mix(in_srgb,var(--foreground)_${pct}%,transparent)]`;
const bg  = (pct: number) => `bg-[color-mix(in_srgb,var(--foreground)_${pct}%,transparent)]`;

/* ═══════════════════════════════════════════════════════════════════════
   OVERLAY PANEL (iPad-optimized — larger, rounder)
   ═══════════════════════════════════════════════════════════════════════ */

function Panel({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--background)_85%,transparent)] backdrop-blur-xl" />
      <div onClick={e => e.stopPropagation()}
        className={`relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl ${G2} p-8`}>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-black text-[var(--foreground)]">{title}</h3>
          <button onClick={onClose} className={`${BS} flex h-12 w-12 items-center justify-center rounded-2xl ${bg(5)} text-[var(--muted-foreground)] hover:${bg(10)} hover:text-[var(--foreground)]`}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   QUICK POS — iPad/Tablet Optimized
   Large touch targets, simplified layout, full 11 features
   Obsidian Nexus design system — 100% CSS Variables
   ═══════════════════════════════════════════════════════════════════════ */

export default function QuickPOSPage(): React.ReactElement {
  const { accessToken } = useAuth();

  /* ── Core state ── */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selCat, setSelCat] = useState<string | null>(null);
  const [svcSearch, setSvcSearch] = useState('');
  const [cliSearch, setCliSearch] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [defEmployee, setDefEmployee] = useState<Employee | null>(null);
  const [discInput, setDiscInput] = useState('');
  const [discType, setDiscType] = useState<'fixed' | 'percentage'>('fixed');
  const [tipInput, setTipInput] = useState('');
  const [custNote, setCustNote] = useState('');
  const [walkName, setWalkName] = useState('');
  const [walkPhone, setWalkPhone] = useState('');
  const [walkInMode, setWalkInMode] = useState(false);
  const [sendWA, setSendWA] = useState(true);
  const [panel, setPanel] = useState<PanelType>(null);
  const [held, setHeld] = useState<HeldBill[]>([]);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [refId, setRefId] = useState('');
  const [refReason, setRefReason] = useState('');
  const [online, setOnline] = useState(true);
  const [favIds, setFavIds] = useState<string[]>(DEFAULT_FAVS);
  const [showFavs, setShowFavs] = useState(false);
  const [receiptLogo, setReceiptLogo] = useState(true);
  const [receiptMsg, setReceiptMsg] = useState('شكراً لزيارتكم');
  const [receiptPhone, setReceiptPhone] = useState('+966501234567');
  const [showCart, setShowCart] = useState(false);

  /* ── Offline detection ── */
  useEffect(() => {
    const on = () => { setOnline(true); toast.success('تم استعادة الاتصال'); };
    const off = () => { setOnline(false); toast.error('انقطع الاتصال'); };
    setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Queries ── */
  const { data: cats } = useQuery<ServiceCategory[]>({
    queryKey: ['qpos-cats'], enabled: true,
    queryFn: () => isDev(accessToken) ? Promise.resolve(M_CATS) : dashboardService.getCategories(accessToken!),
  });
  const { data: svcsData } = useQuery({
    queryKey: ['qpos-svcs'], enabled: true,
    queryFn: () => isDev(accessToken)
      ? Promise.resolve({ items: M_SVCS, total: M_SVCS.length, page: 1, limit: 100, totalPages: 1 } as PaginatedResponse<Service>)
      : dashboardService.getServices({ limit: 100 }, accessToken!),
  });
  const { data: empData } = useQuery({
    queryKey: ['qpos-emp'], enabled: true,
    queryFn: () => isDev(accessToken)
      ? Promise.resolve({ items: M_EMP, total: M_EMP.length, page: 1, limit: 50, totalPages: 1 } as PaginatedResponse<Employee>)
      : dashboardService.getEmployees({ limit: 50 }, accessToken!),
  });

  const mockCliSearch = useMemo(() => {
    if (!isDev(accessToken) || cliSearch.length < 2) return [];
    const q = cliSearch.toLowerCase();
    return M_CLI.filter(c => c.fullName.includes(q) || c.phone.includes(q));
  }, [cliSearch, accessToken]);

  const { data: cliApi } = useQuery({
    queryKey: ['qpos-cli', cliSearch],
    queryFn: () => dashboardService.getClients({ search: cliSearch, limit: 5 }, accessToken!),
    enabled: !isDev(accessToken) && !!accessToken && cliSearch.length >= 2 && !walkInMode,
  });

  const cliResults = isDev(accessToken) ? mockCliSearch : (cliApi?.items ?? []);
  const allSvcs = useMemo(() => svcsData?.items ?? [], [svcsData]);
  const emps = useMemo(() => empData?.items ?? [], [empData]);

  const filtered = useMemo(() => {
    let s = allSvcs.filter(x => x.isActive);
    if (selCat) s = s.filter(x => x.categoryId === selCat);
    if (svcSearch) { const q = svcSearch.toLowerCase(); s = s.filter(x => x.nameAr.includes(q) || (x.nameEn?.toLowerCase() ?? '').includes(q)); }
    return s;
  }, [allSvcs, selCat, svcSearch]);

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
  const toggleFav = useCallback((svcId: string) => { setFavIds(p => p.includes(svcId) ? p.filter(x => x !== svcId) : [...p, svcId]); }, []);

  const clearAll = useCallback(() => {
    setCart([]); setClient(null); setWalkName(''); setWalkPhone('');
    setWalkInMode(false); setDiscInput(''); setTipInput(''); setCustNote('');
  }, []);

  /* ── Calculations ── */
  const itemTotals = useMemo(() => cart.map(item => {
    const line = item.service.price * item.quantity;
    const d = item.discount > 0 ? (item.discountType === 'percentage' ? line * item.discount / 100 : Math.min(line, item.discount)) : 0;
    return { id: item.id, line, d, net: line - d };
  }), [cart]);

  const subtotal = useMemo(() => itemTotals.reduce((s, i) => s + i.net, 0), [itemTotals]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const gDisc = useMemo(() => {
    const v = parseFloat(discInput);
    if (isNaN(v) || v <= 0) return 0;
    return discType === 'percentage' ? Math.min(subtotal, subtotal * v / 100) : Math.min(subtotal, v);
  }, [discInput, discType, subtotal]);

  const afterDisc = Math.max(0, subtotal - gDisc);
  const tax = afterDisc * TAX;
  const tip = useMemo(() => { const v = parseFloat(tipInput); return isNaN(v) || v < 0 ? 0 : v; }, [tipInput]);
  const total = afterDisc + tax + tip;

  /* ── Commission ── */
  const comms = useMemo(() => {
    const m = new Map<string, { name: string; amount: number }>();
    cart.forEach(item => {
      if (!item.employeeId) return;
      const emp = emps.find(e => e.id === item.employeeId);
      if (!emp || emp.commissionType === 'none') return;
      const net = itemTotals.find(t => t.id === item.id)?.net ?? 0;
      const c = emp.commissionType === 'percentage' ? net * emp.commissionValue / 100 : emp.commissionValue * item.quantity;
      const ex = m.get(emp.id);
      if (ex) ex.amount += c; else m.set(emp.id, { name: emp.fullName, amount: c });
    });
    return Array.from(m.values());
  }, [cart, emps, itemTotals]);

  const totalComm = useMemo(() => comms.reduce((s, c) => s + c.amount, 0), [comms]);

  /* ── Hold / Recall ── */
  const holdBill = useCallback(() => {
    if (!cart.length) { toast.error('السلة فارغة'); return; }
    setHeld(p => [...p, {
      id: uid(), label: (client?.fullName ?? walkName) || `فاتورة ${now()}`,
      cart: [...cart], client, walkIn: walkInMode ? { name: walkName, phone: walkPhone } : null,
      time: now(), total,
    }]);
    clearAll(); toast.success('تم تعليق الفاتورة');
  }, [cart, client, walkName, walkPhone, walkInMode, total, clearAll]);

  const recallBill = useCallback((id: string) => {
    const b = held.find(h => h.id === id); if (!b) return;
    if (cart.length) holdBill();
    setCart(b.cart); setClient(b.client);
    if (b.walkIn) { setWalkInMode(true); setWalkName(b.walkIn.name); setWalkPhone(b.walkIn.phone); }
    setHeld(p => p.filter(x => x.id !== id)); setPanel(null);
    toast.success('تم استدعاء الفاتورة');
  }, [held, cart, holdBill]);

  /* ── Split ── */
  const splitRem = useMemo(() => Math.max(0, total - splits.reduce((s, e) => s + (e.amount || 0), 0)), [splits, total]);

  /* ── Payment ── */
  const canPay = cart.length > 0 && (client || (walkInMode && walkName.trim() && walkPhone.trim()));

  const payMut = useMutation({
    mutationFn: async (method: string) => {
      if (isDev(accessToken)) { await new Promise(r => setTimeout(r, 500)); return { id: 'Q-' + Date.now() }; }
      let clientId = client?.id;
      if (!clientId && walkInMode && walkName.trim() && walkPhone.trim()) {
        const c = await dashboardService.createClient({ fullName: walkName.trim(), phone: walkPhone.trim(), source: 'walk_in' }, accessToken!);
        clientId = c.id;
      }
      if (!clientId) throw new Error('العميل مطلوب');
      const inv = await api.post<{ id: string }>('/invoices', {
        clientId, notes: custNote || undefined,
        items: cart.map(i => ({ serviceId: i.service.id, description: i.service.nameAr, quantity: i.quantity, unitPrice: i.service.price, employeeId: i.employeeId })),
      }, accessToken!);
      if (gDisc > 0) await dashboardService.addInvoiceDiscount(inv.id, { type: 'fixed', value: gDisc }, accessToken!);
      if (method === 'split') {
        for (const e of splits) { if (e.amount > 0) { const m = e.method === 'apple_pay' ? 'card' : e.method; await dashboardService.recordInvoicePayment(inv.id, { amount: e.amount, method: m as 'cash' | 'card' | 'bank_transfer' }, accessToken!); } }
      } else {
        const m = method === 'apple_pay' ? 'card' : method;
        await dashboardService.recordInvoicePayment(inv.id, { amount: total, method: m as 'cash' | 'card' | 'bank_transfer' }, accessToken!);
      }
      if (sendWA) { try { await dashboardService.sendInvoice(inv.id, 'whatsapp', accessToken!); } catch { /* ok */ } }
      return inv;
    },
    onSuccess: (inv) => { toast.success(`فاتورة ${inv.id} تمت بنجاح`); clearAll(); setPanel(null); setShowCart(false); },
    onError: (e: Error) => toast.error(e.message || 'خطأ'),
  });

  function pay(m: string) { if (!canPay) { toast.error('أكمل بيانات العميل'); return; } payMut.mutate(m); }
  function paySplit() { if (!canPay) { toast.error('أكمل بيانات العميل'); return; } if (splitRem > 0.01) { toast.error('المبلغ المتبقي غير صفر'); return; } payMut.mutate('split'); }

  const refMut = useMutation({
    mutationFn: async () => { if (isDev(accessToken)) { await new Promise(r => setTimeout(r, 400)); return; } await api.post(`/invoices/${refId}/refund`, { reason: refReason }, accessToken!); },
    onSuccess: () => { toast.success('تم الإرجاع'); setRefId(''); setRefReason(''); setPanel(null); },
    onError: () => toast.error('فشل الإرجاع'),
  });

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */

  const displayList = showFavs ? favSvcs : filtered;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)]" dir="rtl">

      {/* ══════════ HEADER — large touch targets ══════════ */}
      <header className={`flex shrink-0 items-center justify-between px-4 py-2.5 ${G2} ${brd(4)} border-b`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={primaryBg}>
            <Receipt size={16} className="text-white" />
          </div>
          <div>
            <span className="text-[15px] font-black text-[var(--foreground)]">Quick POS</span>
            <span className="ms-1.5 text-[10px] font-bold" style={accentColor}>iPad</span>
          </div>
          {/* Offline indicator */}
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-bold ${online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/15 text-red-400 animate-pulse'}`}>
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {online ? 'متصل' : 'غير متصل'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hold */}
          <button onClick={holdBill} className={`${B} group relative flex h-11 items-center gap-2 rounded-2xl px-4 ${G1} hover:${brd(8)}`}>
            <Pause size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
            <span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">تعليق</span>
            {held.length > 0 && <span className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-black" style={accentBg}>{held.length}</span>}
          </button>
          {/* Recall */}
          <button onClick={() => setPanel('hold-list')} className={`${B} group flex h-11 items-center gap-2 rounded-2xl px-4 ${G1} hover:${brd(8)}`}>
            <Play size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
            <span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">استدعاء</span>
          </button>
          {/* Refund */}
          <button onClick={() => setPanel('refund')} className={`${B} group flex h-11 items-center gap-2 rounded-2xl px-4 ${G1} hover:border-red-500/20`}>
            <RotateCcw size={16} className="text-[var(--muted-foreground)] group-hover:text-red-400" />
            <span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-red-400">إرجاع</span>
          </button>
          {/* Bundles */}
          <button onClick={() => setPanel('bundles')} className={`${B} group flex h-11 items-center gap-2 rounded-2xl px-4 ${G1} hover:${brd(8)}`}>
            <Package size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
            <span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">الباقات</span>
          </button>
          {/* Receipt */}
          <button onClick={() => setPanel('receipt')} className={`${B} group flex h-11 w-11 items-center justify-center rounded-2xl ${G1} hover:${brd(8)}`}>
            <Printer size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
          </button>

          <div className={`mx-1 h-6 w-px ${bg(6)}`} />
          <Link href="/pos" className={`${B} group flex h-11 items-center gap-2 rounded-2xl px-4 ${G1} hover:${brd(8)}`}>
            <Monitor size={16} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
            <span className="text-[12px] font-bold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">الكامل</span>
          </Link>
        </div>
      </header>

      {/* ══════════ BODY — 2 columns for iPad ══════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ─── LEFT: SERVICES ─── */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* Search */}
          <div className="shrink-0 p-4 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
              <input value={svcSearch} onChange={e => setSvcSearch(e.target.value)} placeholder="بحث سريع..."
                className={`flex h-14 ${INP} rounded-2xl ps-12 pe-12 text-[16px]`} />
              {svcSearch && <button onClick={() => setSvcSearch('')} className={`${BS} absolute end-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[var(--muted-foreground)] hover:${bg(5)}`}><X size={16} /></button>}
            </div>
          </div>

          {/* Category bar + Favs */}
          <div className="flex shrink-0 gap-2 px-4 pb-2">
            <button onClick={() => setShowFavs(!showFavs)}
              className={`${BS} flex items-center gap-1.5 rounded-2xl px-5 py-3 text-[13px] font-bold ${showFavs ? 'text-black shadow-md' : `${G1} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`}
              style={showFavs ? accentBg : undefined}>
              <Star size={14} /> المفضلة
            </button>
            <div className={`w-px ${bg(4)}`} />
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button onClick={() => { setSelCat(null); setShowFavs(false); }}
                className={`${BS} flex shrink-0 items-center gap-1.5 rounded-2xl px-5 py-3 text-[13px] font-bold ${!selCat && !showFavs ? 'text-white shadow-md' : `${G1} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`}
                style={!selCat && !showFavs ? primaryBg : undefined}>
                الكل
              </button>
              {cats?.map(c => {
                const I = CAT_ICO[c.nameAr] ?? Scissors;
                return (
                  <button key={c.id} onClick={() => { setSelCat(c.id); setShowFavs(false); }}
                    className={`${BS} flex shrink-0 items-center gap-1.5 rounded-2xl px-5 py-3 text-[13px] font-bold ${selCat === c.id ? 'text-white shadow-md' : `${G1} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`}
                    style={selCat === c.id ? primaryBg : undefined}>
                    <I size={14} /> {c.nameAr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service grid — BIG buttons for touch */}
          <div className="flex-1 overflow-y-auto p-4 pt-2">
            {!displayList.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--muted-foreground)]" style={{ opacity: 0.2 }}>
                <Search size={40} strokeWidth={1} />
                <p className="text-[14px]">{showFavs ? 'لا توجد خدمات مفضلة' : 'لا توجد خدمات'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {displayList.map(svc => {
                  const qty = cart.filter(c => c.service.id === svc.id).reduce((s, i) => s + i.quantity, 0);
                  const isFav = favIds.includes(svc.id);
                  return (
                    <div key={svc.id} className="relative group">
                      <button onClick={() => addToCart(svc)}
                        className={`${BS} flex w-full flex-col items-start gap-1.5 rounded-2xl border p-5 text-start min-h-[120px] ${qty > 0 ? `${brd(0)} shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand-primary)_25%,transparent)]` : `${brd(4)} ${bg(2)} hover:${brd(8)} hover:${bg(4)}`}`}
                        style={qty > 0 ? { background: 'color-mix(in srgb, var(--brand-primary) 5%, transparent)' } : undefined}>
                        {qty > 0 && <span className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black text-white" style={{ ...TN, ...primaryBg }}>{qty}</span>}
                        <span className="text-[15px] font-bold leading-snug text-[var(--foreground)] line-clamp-2">{svc.nameAr}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]" style={{ opacity: 0.5 }}><Clock size={11} />{svc.duration}د</span>
                        <span className="mt-auto pt-1 text-[18px] font-black" style={{ ...TN, ...accentColor }}>{fmt(svc.price)}<span className="text-[10px] font-semibold opacity-40 ms-1">ر.س</span></span>
                      </button>
                      {/* Fav toggle */}
                      <button onClick={() => toggleFav(svc.id)} className={`${BS} absolute start-2 top-2 rounded-xl p-2 ${isFav ? '' : 'opacity-0 group-hover:opacity-60'} hover:opacity-100`} style={isFav ? accentColor : { color: 'var(--muted-foreground)' }}>
                        {isFav ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: CART PANEL (420px) ─── */}
        <aside className={`hidden w-[420px] shrink-0 flex-col border-s ${brd(4)} md:flex ${G1}`}>

          {/* Client section */}
          <div className={`shrink-0 border-b ${brd(4)} p-4 space-y-3`}>
            <div className="flex items-center gap-2">
              <User size={14} style={accentColor} />
              <span className="text-[13px] font-bold text-[var(--foreground)]">العميل</span>
            </div>

            {client ? (
              <div className={`rounded-2xl ${G1} p-4`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[16px] font-bold" style={{ ...accentMix(15), ...accentColor }}>
                    {client.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[var(--foreground)]">
                      {client.fullName}
                      {client.totalVisits >= 10 && <Crown size={12} className="inline ms-1" style={accentColor} />}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)]" dir="ltr">{client.phone}</p>
                  </div>
                  <button onClick={() => setClient(null)} className={`${BS} text-[11px] font-bold`} style={accentColor}>تغيير</button>
                </div>
                {client.notes && <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400">{client.notes}</p>}
              </div>
            ) : walkInMode ? (
              <div className="space-y-2">
                <div className="relative"><User size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input value={walkName} onChange={e => setWalkName(e.target.value)} placeholder="اسم العميل" className={`${INP} py-3.5 ps-10 pe-4 text-[14px]`} /></div>
                <div className="relative"><Phone size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input value={walkPhone} onChange={e => setWalkPhone(e.target.value)} placeholder="رقم الجوال" dir="ltr" className={`${INP} py-3.5 ps-10 pe-4 text-[14px]`} /></div>
                <button onClick={() => { setWalkInMode(false); setWalkName(''); setWalkPhone(''); }} className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">إلغاء</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
                  <input value={cliSearch} onChange={e => setCliSearch(e.target.value)} placeholder="بحث بالاسم أو الجوال..."
                    className={`${INP} py-3.5 ps-10 pe-4 text-[14px]`} />
                  {cliResults.length > 0 && cliSearch.length >= 2 && (
                    <div className={`absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-2xl ${G2}`}>
                      {cliResults.map(c => (
                        <button key={c.id} onClick={() => { setClient(c); setCliSearch(''); }} className={`${B} flex w-full items-center gap-3 px-4 py-3.5 text-start hover:${bg(4)}`}>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold" style={{ ...accentMix(12), ...accentColor }}>{c.fullName.charAt(0)}</div>
                          <div><p className="text-[13px] font-medium text-[var(--foreground)]">{c.fullName}</p><p className="text-[10px] text-[var(--muted-foreground)]" dir="ltr">{c.phone}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setWalkInMode(true)} className={`${B} flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed ${brd(6)} py-3.5 text-[13px] font-semibold text-[var(--muted-foreground)] hover:${brd(12)} hover:text-[var(--foreground)]`}>
                  <UserPlus size={16} /> عميل جديد (Walk-in)
                </button>
              </div>
            )}
            {/* Quick note */}
            <div className="relative">
              <StickyNote size={12} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.2 }} />
              <input value={custNote} onChange={e => setCustNote(e.target.value)} placeholder="ملاحظة على الفاتورة..."
                className={`w-full rounded-xl border ${brd(4)} ${bg(2)} py-2.5 ps-9 pe-3 text-[11px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none ${T}`} style={{ placeholderOpacity: 0.3 } as React.CSSProperties} />
            </div>
          </div>

          {/* Employee */}
          <div className={`shrink-0 border-b ${brd(4)} p-4 space-y-2`}>
            <div className="flex items-center gap-2">
              <Scissors size={14} style={accentColor} />
              <span className="text-[13px] font-bold text-[var(--foreground)]">الموظفة</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {emps.map(emp => (
                <button key={emp.id} onClick={() => setDefEmployee(defEmployee?.id === emp.id ? null : emp)}
                  className={`${BS} rounded-xl px-4 py-2.5 text-[12px] font-bold ${defEmployee?.id === emp.id ? 'text-black shadow-md' : `${G1} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`}
                  style={defEmployee?.id === emp.id ? accentBg : undefined}>
                  {emp.fullName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={14} style={accentColor} />
                <span className="text-[13px] font-bold text-[var(--foreground)]">السلة</span>
                {cartCount > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[11px] font-black text-black" style={{ ...TN, ...accentBg }}>{cartCount}</span>}
              </div>
              {cart.length > 0 && <button onClick={clearAll} className={`${BS} text-[11px] font-semibold text-red-400 hover:bg-red-500/10 rounded-lg px-2 py-1`}>مسح</button>}
            </div>

            {!cart.length ? (
              <div className="py-12 text-center text-[var(--muted-foreground)]" style={{ opacity: 0.15 }}>
                <ShoppingCart size={36} className="mx-auto mb-3" strokeWidth={1} />
                <p className="text-[13px]">اضغط على خدمة لإضافتها</p>
              </div>
            ) : cart.map(item => {
              const info = itemTotals.find(t => t.id === item.id);
              return (
                <div key={item.id} className={`flex items-center gap-3 rounded-2xl border ${brd(4)} ${bg(2)} p-3.5 ${T}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[var(--foreground)]">
                      {item.service.nameAr}
                      {item.bundleId && <Package size={10} className="inline ms-1 text-[var(--muted-foreground)]" />}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]" style={{ opacity: 0.6 }}>
                      <span><Users size={9} className="inline" /> {item.employeeName}</span>
                      <span style={TN}>{fmt(info?.net ?? 0)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.id, -1)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl border ${brd(6)} text-[var(--muted-foreground)] hover:${brd(12)}`}><Minus size={16} /></button>
                    <span className="w-8 text-center text-[15px] font-black text-[var(--foreground)]" style={TN}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl border ${brd(6)} text-[var(--muted-foreground)] hover:${brd(12)}`}><Plus size={16} /></button>
                    <button onClick={() => removeItem(item.id)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400`} style={{ opacity: 0.3 }}><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Bottom: Totals + Payment ── */}
          {cart.length > 0 && (
            <div className={`shrink-0 border-t ${brd(4)} p-4 space-y-3`}>

              {/* Discount + Tip */}
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-1.5">
                  <Percent size={12} className="shrink-0 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
                  <input type="number" value={discInput} onChange={e => setDiscInput(e.target.value)} placeholder="خصم"
                    className={`w-16 rounded-xl border ${brd(6)} ${bg(3)} px-3 py-2.5 text-[12px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} />
                  <div className={`flex overflow-hidden rounded-xl border ${brd(6)}`}>
                    <button onClick={() => setDiscType('fixed')} className={`${BS} px-3 py-2.5 text-[10px] font-bold ${discType === 'fixed' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={discType === 'fixed' ? accentBg : undefined}>ر.س</button>
                    <button onClick={() => setDiscType('percentage')} className={`${BS} px-3 py-2.5 text-[10px] font-bold ${discType === 'percentage' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={discType === 'percentage' ? accentBg : undefined}>%</button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart size={12} className="shrink-0 text-pink-400" style={{ opacity: 0.5 }} />
                  <input type="number" value={tipInput} onChange={e => setTipInput(e.target.value)} placeholder="إكرامية"
                    className={`w-16 rounded-xl border ${brd(6)} ${bg(3)} px-3 py-2.5 text-[12px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} />
                </div>
              </div>

              {/* Commissions */}
              {comms.length > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 px-3 py-2">
                  <div className="flex items-center gap-1.5"><CircleDollarSign size={12} className="text-emerald-400" /><span className="text-[11px] font-bold text-emerald-400">العمولات</span></div>
                  <span className="text-[12px] font-black text-emerald-400" style={TN}>{fmt(totalComm)}</span>
                </div>
              )}

              {/* Totals */}
              <div className={`space-y-1.5 rounded-2xl ${bg(2)} p-3.5`}>
                <div className="flex justify-between text-[12px]"><span className="text-[var(--muted-foreground)]">المجموع الفرعي</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(subtotal)}</span></div>
                {gDisc > 0 && <div className="flex justify-between text-[12px]"><span className="text-emerald-400">الخصم</span><span className="font-semibold text-emerald-400" style={TN}>-{fmt(gDisc)}</span></div>}
                <div className="flex justify-between text-[12px]"><span className="text-[var(--muted-foreground)]">ضريبة 15%</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(tax)}</span></div>
                {tip > 0 && <div className="flex justify-between text-[12px]"><span className="text-pink-400">إكرامية</span><span className="font-semibold text-pink-400" style={TN}>{fmt(tip)}</span></div>}
                <div className={`flex items-baseline justify-between border-t ${brd(4)} pt-2`}>
                  <span className="text-[13px] font-bold text-[var(--foreground)]">الإجمالي</span>
                  <span className="text-[22px] font-black" style={{ ...TN, ...accentColor }}>{fmt(total)} <span className="text-[10px] font-semibold opacity-40">ر.س</span></span>
                </div>
              </div>

              {/* WhatsApp toggle */}
              <label className={`flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer ${T} hover:${bg(3)}`}>
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${sendWA ? 'border-transparent' : brd(10)}`} style={sendWA ? accentBg : undefined}>
                  {sendWA && <Check size={11} className="text-black" />}
                </div>
                <input type="checkbox" checked={sendWA} onChange={e => setSendWA(e.target.checked)} className="sr-only" />
                <MessageCircle size={14} className="text-emerald-400" />
                <span className="text-[12px] text-[var(--muted-foreground)]">إرسال واتساب</span>
              </label>

              {/* Payment grid — BIG buttons */}
              <div className="grid grid-cols-4 gap-2">
                {PAY_METHODS.map(pm => (
                  <button key={pm.id} onClick={() => pay(pm.id)} disabled={payMut.isPending || !canPay}
                    className={`${BS} flex flex-col items-center gap-1.5 rounded-2xl border ${brd(4)} ${bg(2)} py-3.5 text-[var(--muted-foreground)] hover:${brd(8)} hover:text-[var(--foreground)] disabled:opacity-15 disabled:pointer-events-none`}>
                    <pm.icon size={20} strokeWidth={1.5} />
                    <span className="text-[10px] font-bold">{pm.label}</span>
                  </button>
                ))}
              </div>

              {/* Split pay */}
              <button onClick={() => { setSplits([{ method: 'cash', amount: 0 }, { method: 'card', amount: 0 }]); setPanel('split'); }} disabled={!canPay}
                className={`${B} flex w-full items-center justify-center gap-2 rounded-2xl border ${brd(4)} py-3 text-[12px] font-semibold text-[var(--muted-foreground)] hover:${brd(8)} hover:text-[var(--foreground)] disabled:opacity-15`}>
                <Split size={14} /> دفع مقسّم
              </button>

              {/* MAIN PAY */}
              <button onClick={() => pay('cash')} disabled={payMut.isPending || !canPay}
                className={`${B} relative flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-[16px] font-black text-black shadow-xl disabled:opacity-15 disabled:pointer-events-none overflow-hidden`}
                style={canPay ? { background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, #000))' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                {payMut.isPending
                  ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  : <><Receipt size={18} /> إصدار فاتورة — {fmt(total)}</>}
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* ══════════ MOBILE BOTTOM BAR (phones) ══════════ */}
      <div className={`flex shrink-0 items-center justify-between border-t ${brd(4)} px-5 py-3.5 md:hidden ${G2}`}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>الإجمالي</p>
          <p className="text-[22px] font-black" style={{ ...TN, ...accentColor }}>{fmt(total)}</p>
        </div>
        <div className="flex items-center gap-3">
          {cartCount > 0 && (
            <button onClick={() => setShowCart(!showCart)} className={`${B} flex items-center gap-2 rounded-2xl px-4 py-3 ${G1}`}>
              <ShoppingCart size={16} style={accentColor} />
              <span className="text-[13px] font-black text-[var(--foreground)]" style={TN}>{cartCount}</span>
            </button>
          )}
          <button onClick={() => pay('cash')} disabled={payMut.isPending || !canPay}
            className={`${B} rounded-2xl px-8 py-3.5 text-[14px] font-bold text-black shadow-lg disabled:opacity-20`} style={accentBg}>
            {payMut.isPending ? '...' : 'ادفع'}
          </button>
        </div>
      </div>

      {/* ══════════ PANELS ══════════ */}

      {/* Split Payment */}
      <Panel open={panel === 'split'} onClose={() => setPanel(null)} title="دفع مقسّم">
        <div className="space-y-4">
          <div className={`rounded-2xl ${bg(3)} p-4 text-center`}>
            <p className="text-[11px] text-[var(--muted-foreground)]">الإجمالي</p>
            <p className="text-[24px] font-black" style={{ ...TN, ...accentColor }}>{fmt(total)} ر.س</p>
          </div>
          {splits.map((e, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-2xl ${G1} p-4`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-black" style={{ ...TN, ...accentBg }}>{i + 1}</span>
              <select value={e.method} onChange={ev => setSplits(p => p.map((x, j) => j === i ? { ...x, method: ev.target.value } : x))}
                className={`rounded-xl border ${brd(6)} ${bg(3)} px-3 py-3 text-[13px] text-[var(--foreground)] focus:outline-none`}>
                {PAY_METHODS.map(pm => <option key={pm.id} value={pm.id}>{pm.label}</option>)}
              </select>
              <input type="number" value={e.amount || ''} onChange={ev => setSplits(p => p.map((x, j) => j === i ? { ...x, amount: parseFloat(ev.target.value) || 0 } : x))}
                placeholder="المبلغ" className={`flex-1 rounded-xl border ${brd(6)} ${bg(3)} px-3 py-3 text-[13px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} />
              {splits.length > 1 && <button onClick={() => setSplits(p => p.filter((_, j) => j !== i))} className={`${BS} text-red-400`}><X size={16} /></button>}
            </div>
          ))}
          <button onClick={() => setSplits(p => [...p, { method: 'card', amount: 0 }])} className={`${B} flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed ${brd(6)} py-3.5 text-[12px] text-[var(--muted-foreground)]`}><Plus size={14} /> إضافة</button>
          <div className={`flex justify-between rounded-2xl ${bg(3)} p-4`}>
            <span className="text-[13px] text-[var(--muted-foreground)]">المتبقي</span>
            <span className={`text-[18px] font-black ${splitRem > 0.01 ? 'text-red-400' : 'text-emerald-400'}`} style={TN}>{fmt(splitRem)}</span>
          </div>
          <button onClick={paySplit} disabled={splitRem > 0.01 || payMut.isPending}
            className={`${B} flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-black shadow-lg disabled:opacity-20`} style={accentBg}>
            {payMut.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <><Split size={16} /> تأكيد الدفع المقسّم</>}
          </button>
        </div>
      </Panel>

      {/* Hold list */}
      <Panel open={panel === 'hold-list'} onClose={() => setPanel(null)} title="الفواتير المعلقة">
        {!held.length ? (
          <div className="py-12 text-center text-[var(--muted-foreground)]" style={{ opacity: 0.2 }}><Pause size={32} className="mx-auto mb-3" strokeWidth={1} /><p className="text-[14px]">لا توجد فواتير معلقة</p></div>
        ) : (
          <div className="space-y-3">
            {held.map(b => (
              <div key={b.id} className={`flex items-center justify-between rounded-2xl ${G1} p-4`}>
                <div>
                  <p className="text-[14px] font-bold text-[var(--foreground)]">{b.label}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{b.cart.length} خدمة &middot; {b.time} &middot; <span style={accentColor}>{fmt(b.total)}</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => recallBill(b.id)} className={`${BS} rounded-xl px-5 py-2.5 text-[12px] font-bold text-black`} style={accentBg}>استدعاء</button>
                  <button onClick={() => setHeld(p => p.filter(x => x.id !== b.id))} className={`${BS} rounded-xl border ${brd(6)} px-3 py-2.5 text-red-400 hover:bg-red-500/10`}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Refund */}
      <Panel open={panel === 'refund'} onClose={() => setPanel(null)} title="إرجاع / إلغاء">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[12px] font-bold text-[var(--muted-foreground)]">رقم الفاتورة</label>
            <div className="relative"><Hash size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
              <input value={refId} onChange={e => setRefId(e.target.value)} placeholder="INV-XXXX" dir="ltr"
                className={`${INP} py-3.5 ps-10 pe-4 text-[14px]`} /></div>
          </div>
          <div>
            <label className="mb-2 block text-[12px] font-bold text-[var(--muted-foreground)]">سبب الإرجاع</label>
            <textarea value={refReason} onChange={e => setRefReason(e.target.value)} placeholder="السبب..." rows={3}
              className={`w-full rounded-2xl border ${brd(6)} ${bg(4)} p-4 text-[13px] text-[var(--foreground)] resize-none placeholder:text-[var(--muted-foreground)] focus:outline-none ${T}`} />
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-red-500/10 p-4">
            <AlertTriangle size={18} className="text-red-400" />
            <p className="text-[12px] text-red-400">سيتم إرجاع المبلغ وتسجيل العملية</p>
          </div>
          <button onClick={() => refMut.mutate()} disabled={!refId.trim() || !refReason.trim() || refMut.isPending}
            className={`${B} flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 text-[14px] font-bold text-white shadow-lg disabled:opacity-20`}>
            {refMut.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><RotateCcw size={16} /> تأكيد الإرجاع</>}
          </button>
        </div>
      </Panel>

      {/* Bundles */}
      <Panel open={panel === 'bundles'} onClose={() => setPanel(null)} title="الباقات">
        <div className="space-y-3">
          {M_BUNDLES.map(b => (
            <button key={b.id} onClick={() => addBundle(b)}
              className={`${B} group flex w-full flex-col items-start gap-2 rounded-2xl border ${brd(4)} ${bg(2)} p-5 text-start hover:${brd(8)} hover:${bg(4)}`}>
              <div className="flex items-center gap-2">
                <Package size={16} style={accentColor} />
                <span className="text-[15px] font-bold text-[var(--foreground)]">{b.nameAr}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[18px] font-black" style={{ ...TN, ...accentColor }}>{fmt(b.price)}</span>
                <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-400">وفّر {fmt(b.savings)}</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {b.services.map(bs => allSvcs.find(s => s.id === bs.serviceId)?.nameAr).filter(Boolean).join(' + ')}
              </p>
            </button>
          ))}
        </div>
      </Panel>

      {/* Receipt Settings */}
      <Panel open={panel === 'receipt'} onClose={() => setPanel(null)} title="إعدادات الإيصال">
        <div className="space-y-4">
          <label className={`flex items-center gap-3 rounded-2xl ${bg(3)} px-4 py-4 cursor-pointer ${T}`}>
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${receiptLogo ? 'border-transparent' : brd(10)}`} style={receiptLogo ? accentBg : undefined}>
              {receiptLogo && <Check size={13} className="text-black" />}
            </div>
            <input type="checkbox" checked={receiptLogo} onChange={e => setReceiptLogo(e.target.checked)} className="sr-only" />
            <span className="text-[13px] text-[var(--foreground)]">عرض شعار الصالون</span>
          </label>
          <div>
            <label className="mb-2 block text-[12px] font-bold text-[var(--muted-foreground)]">رسالة الشكر</label>
            <input value={receiptMsg} onChange={e => setReceiptMsg(e.target.value)}
              className={`${INP} py-3.5 px-4 text-[14px]`} />
          </div>
          <div>
            <label className="mb-2 block text-[12px] font-bold text-[var(--muted-foreground)]">رقم الهاتف في الإيصال</label>
            <input value={receiptPhone} onChange={e => setReceiptPhone(e.target.value)} dir="ltr"
              className={`${INP} py-3.5 px-4 text-[14px]`} />
          </div>
          <button onClick={() => { toast.success('تم حفظ الإعدادات'); setPanel(null); }}
            className={`${B} flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-black`} style={accentBg}>
            <Check size={16} /> حفظ
          </button>
        </div>
      </Panel>

    </div>
  );
}
