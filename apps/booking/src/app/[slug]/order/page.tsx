'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock, ChevronDown, MapPin, Globe, ShoppingBag, Check, Plus,
  Sparkles, Crown, Search, X,
} from 'lucide-react';
import { menuApi, type MenuData, type MenuCategory, type MenuService } from '@/lib/menu-api';
import { getThemeCSSVars, isDarkTheme } from '@/lib/menu-themes';

/* ═══════════════════════════════════════════════════════════════
   TRANSLATIONS
   ═══════════════════════════════════════════════════════════════ */
const T = {
  ar: {
    loading: 'جارٍ التحميل',
    error: 'حدث خطأ في تحميل المنيو',
    retry: 'إعادة المحاولة',
    services: 'خدماتنا',
    sar: 'ر.س',
    createOrder: 'إنشاء الطلب',
    total: 'المجموع',
    poweredBy: 'Powered by',
    location: 'موقعنا على الخريطة',
    serviceCount: (n: number) => `${n} ${n === 1 ? 'خدمة' : n === 2 ? 'خدمتان' : 'خدمات'}`,
    duration: (d: number) => `${d} د`,
    welcomeTag: 'مرحباً بكِ',
    addService: 'إضافة',
    selected: 'تم اختياره',
    searchPlaceholder: 'ابحثي عن خدمة...',
    all: 'الكل',
    noResults: 'لا توجد نتائج',
    browseMenu: 'تصفّح المنيو',
    luxe: 'تجربة فاخرة',
  },
  en: {
    loading: 'Loading',
    error: 'Failed to load menu',
    retry: 'Try Again',
    services: 'Our Services',
    sar: 'SAR',
    createOrder: 'Create Order',
    total: 'Total',
    poweredBy: 'Powered by',
    location: 'View on map',
    serviceCount: (n: number) => `${n} service${n !== 1 ? 's' : ''}`,
    duration: (d: number) => `${d} min`,
    welcomeTag: 'Welcome',
    addService: 'Add',
    selected: 'Selected',
    searchPlaceholder: 'Search services...',
    all: 'All',
    noResults: 'No results',
    browseMenu: 'Browse Menu',
    luxe: 'Luxury Experience',
  },
};

type Lang = 'ar' | 'en';

/* ═══════════════════════════════════════════════════════════════
   ANIMATED COUNT-UP (for total in bottom bar)
   ═══════════════════════════════════════════════════════════════ */
function useCountUp(target: number, duration = 400) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevRef.current;
    const delta = target - start;
    if (delta === 0) return;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + delta * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function SmartMenuPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('ar');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const t = T[lang];
  const isRTL = lang === 'ar';

  /* ── Fetch menu ── */
  const fetchMenu = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await menuApi.getMenu(slug);
      setData(result);
    } catch (err: unknown) {
      setError((err as Error).message || t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMenu(); }, [slug]);

  /* ── Toggle service selection ── */
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ── Computed totals ── */
  const allServices = useMemo(() => {
    if (!data) return [];
    return data.categories.flatMap((c) => c.services);
  }, [data]);

  const selectedServices = useMemo(
    () => allServices.filter((s) => selected.has(s.id)),
    [allServices, selected],
  );

  const total = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.price, 0),
    [selectedServices],
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.duration, 0),
    [selectedServices],
  );

  /* ── Submit order ── */
  const handleSubmit = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await menuApi.createOrder(slug, [...selected]);
      router.push(`/${slug}/order/${result.orderCode}`);
    } catch (err: unknown) {
      alert((err as Error).message || 'حدث خطأ');
      setSubmitting(false);
    }
  };

  /* ── Theme CSS vars ── */
  const themeVars = data ? getThemeCSSVars(data.salon.brandColorPreset) : getThemeCSSVars('purple');
  const dark = data ? isDarkTheme(data.salon.brandColorPreset) : false;

  /* Map new layout names (luxe/bloom/glamour/golden/banan) to internal order-page layouts */
  const rawLayout = data?.salon.themeLayout || 'classic';
  const layout = (() => {
    switch (rawLayout) {
      case 'golden':  return 'elegant';   // dark luxury → elegant
      case 'glamour': return 'cards';     // 2-col grid  → magazine cards
      case 'luxe':    return 'cards';     // square cards → magazine cards
      case 'bloom':   return 'compact';   // horizontal + search → compact
      case 'banan':   return 'classic';   // natural centered → classic
      // Legacy names still work
      case 'elegant': return 'elegant';
      case 'cards':   return 'cards';
      case 'compact': return 'compact';
      case 'classic': return 'classic';
      default:        return 'classic';
    }
  })();

  /* ── Name helpers ── */
  const sn = (s: { nameAr: string; nameEn: string | null }) =>
    lang === 'en' && s.nameEn ? s.nameEn : s.nameAr;
  const cn = (c: { nameAr: string; nameEn: string | null }) =>
    lang === 'en' && c.nameEn ? c.nameEn : c.nameAr;

  /* ── Loading Skeleton ── */
  if (loading) {
    return (
      <div
        className="min-h-dvh"
        style={{ ...themeVars, background: 'var(--sm-bg)', color: 'var(--sm-text)' } as React.CSSProperties}
      >
        <div className="mx-auto max-w-lg px-4 pt-8">
          {/* Cover skeleton */}
          <div className="h-44 rounded-b-3xl sm-shimmer" style={{ background: 'var(--sm-accent)' }} />
          <div className="-mt-14 flex flex-col items-center gap-3">
            <div className="h-24 w-24 rounded-3xl sm-shimmer" style={{ background: 'var(--sm-accent)', border: '4px solid var(--sm-bg)' }} />
            <div className="h-6 w-48 rounded-full sm-shimmer" style={{ background: 'var(--sm-accent)' }} />
            <div className="h-3 w-32 rounded-full sm-shimmer" style={{ background: 'var(--sm-accent)', opacity: 0.6 }} />
          </div>
          <div className="mt-10 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl sm-shimmer"
                style={{ background: 'var(--sm-bg-card)', border: '1px solid var(--sm-border)' }}
              />
            ))}
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--sm-text-secondary)' }}>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--sm-primary)' }} />
            {t.loading}
          </div>
        </div>
        <GlobalStyles />
      </div>
    );
  }

  /* ── Error ── */
  if (error || !data) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ ...themeVars, background: 'var(--sm-bg)', color: 'var(--sm-text)' } as React.CSSProperties}
      >
        <div className="text-center space-y-4 px-6">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{ background: 'var(--sm-accent)' }}
          >
            😔
          </div>
          <p className="text-lg font-bold">{error || t.error}</p>
          <button
            onClick={fetchMenu}
            className="rounded-2xl px-6 py-3 text-sm font-black text-white shadow-lg transition hover:scale-105"
            style={{ background: 'var(--sm-primary)' }}
          >
            {t.retry}
          </button>
        </div>
        <GlobalStyles />
      </div>
    );
  }

  const { salon, categories } = data;

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        ...themeVars,
        background: 'var(--sm-bg)',
        color: 'var(--sm-text)',
        fontFamily: isRTL ? "'Tajawal', 'Cairo', sans-serif" : "'Inter', sans-serif",
      } as React.CSSProperties}
    >
      {/* ── Language Toggle (floating top) ── */}
      <div className="fixed top-4 z-[60]" style={{ [isRTL ? 'left' : 'right']: 16 }}>
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="flex h-11 w-11 items-center justify-center rounded-full shadow-xl backdrop-blur-xl transition-all hover:scale-110 active:scale-95"
          style={{
            background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.92)',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'}`,
            color: 'var(--sm-primary)',
          }}
        >
          <Globe size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Layout Renderer ── */}
      {layout === 'elegant' ? (
        <ElegantLayout salon={salon} categories={categories} selected={selected} toggle={toggle} sn={sn} cn={cn} t={t} lang={lang} dark={dark} />
      ) : layout === 'cards' ? (
        <CardsLayout salon={salon} categories={categories} selected={selected} toggle={toggle} sn={sn} cn={cn} t={t} lang={lang} dark={dark} />
      ) : layout === 'compact' ? (
        <CompactLayout salon={salon} categories={categories} selected={selected} toggle={toggle} sn={sn} cn={cn} t={t} lang={lang} dark={dark} />
      ) : (
        <ClassicLayout salon={salon} categories={categories} selected={selected} toggle={toggle} sn={sn} cn={cn} t={t} lang={lang} dark={dark} />
      )}

      {/* ── Google Maps ── */}
      {salon.googleMapsUrl && (
        <div className="px-6 pt-2 pb-4">
          <a
            href={salon.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: 'var(--sm-accent)',
              color: 'var(--sm-primary)',
              border: `1px solid var(--sm-border)`,
            }}
          >
            <MapPin size={16} strokeWidth={2.5} /> {t.location}
          </a>
        </div>
      )}

      {/* ── Powered By ── */}
      <div className="pb-32 pt-6 text-center">
        <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: 'var(--sm-text-secondary)', opacity: 0.4 }}>
          {t.poweredBy} <span className="font-black">SERVIX</span>
        </p>
      </div>

      {/* ── Sticky Bottom Bar ── */}
      <BottomBar
        count={selected.size}
        total={total}
        totalDuration={totalDuration}
        submitting={submitting}
        onSubmit={handleSubmit}
        t={t}
        dark={dark}
      />

      <GlobalStyles />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL STYLES (animations + shimmer)
   ═══════════════════════════════════════════════════════════════ */
function GlobalStyles() {
  return (
    <style jsx global>{`
      @keyframes sm-slide-up {
        from { transform: translateY(120%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .sm-slide-up { animation: sm-slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }

      @keyframes sm-fade-in {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .sm-fade-in { animation: sm-fade-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }

      @keyframes sm-pop {
        0% { transform: scale(0.6); opacity: 0; }
        60% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      .sm-pop { animation: sm-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

      @keyframes sm-ripple {
        0% { transform: scale(0); opacity: 0.6; }
        100% { transform: scale(2.5); opacity: 0; }
      }
      .sm-ripple::after {
        content: '';
        position: absolute;
        inset: 50% 50% 50% 50%;
        width: 10px;
        height: 10px;
        border-radius: 9999px;
        background: var(--sm-primary);
        transform: scale(0);
        opacity: 0;
        pointer-events: none;
      }
      .sm-ripple.sm-ripple-active::after {
        animation: sm-ripple 0.55s ease-out;
      }

      @keyframes sm-shimmer {
        0% { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .sm-shimmer {
        position: relative;
        overflow: hidden;
      }
      .sm-shimmer::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
        animation: sm-shimmer 1.4s linear infinite;
        background-size: 800px 100%;
      }

      @keyframes sm-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      .sm-float { animation: sm-float 3s ease-in-out infinite; }

      @keyframes sm-glow {
        0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--sm-primary) 40%, transparent); }
        50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--sm-primary) 0%, transparent); }
      }
      .sm-glow { animation: sm-glow 2s ease-in-out infinite; }

      html { scroll-behavior: smooth; }

      /* Hide scrollbar on horizontal scroll containers */
      .sm-hide-scrollbar::-webkit-scrollbar { display: none; }
      .sm-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

      /* Smooth snap */
      .sm-snap-x { scroll-snap-type: x mandatory; }
      .sm-snap-start { scroll-snap-align: start; }
    `}</style>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED TYPES
   ═══════════════════════════════════════════════════════════════ */
interface LayoutProps {
  salon: MenuData['salon'];
  categories: MenuCategory[];
  selected: Set<string>;
  toggle: (id: string) => void;
  sn: (s: { nameAr: string; nameEn: string | null }) => string;
  cn: (c: { nameAr: string; nameEn: string | null }) => string;
  t: typeof T['ar'];
  lang: Lang;
  dark: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM BAR (shared)
   ═══════════════════════════════════════════════════════════════ */
function BottomBar({
  count, total, totalDuration, submitting, onSubmit, t, dark,
}: {
  count: number;
  total: number;
  totalDuration: number;
  submitting: boolean;
  onSubmit: () => void;
  t: typeof T['ar'];
  dark: boolean;
}) {
  const displayTotal = useCountUp(total);
  const displayDuration = useCountUp(totalDuration);

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm-slide-up pointer-events-none">
      <div
        className="pointer-events-auto mx-auto max-w-lg rounded-[28px] p-4 shadow-2xl backdrop-blur-2xl"
        style={{
          background: dark ? 'rgba(26,26,26,0.88)' : 'rgba(255,255,255,0.92)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'}`,
          boxShadow: '0 -12px 48px rgba(0,0,0,0.14), 0 24px 48px rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: 'var(--sm-primary)' }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--sm-primary)' }} />
              </span>
              <p className="text-[11px] font-black uppercase tracking-[0.1em]" style={{ color: 'var(--sm-text-secondary)' }}>
                {t.serviceCount(count)}
              </p>
              {totalDuration > 0 && (
                <span className="text-[10px] font-bold" style={{ color: 'var(--sm-text-secondary)', opacity: 0.6 }}>
                  · {t.duration(displayDuration)}
                </span>
              )}
            </div>
            <p className="mt-1 text-2xl font-black leading-none tabular-nums" style={{ color: 'var(--sm-primary)' }}>
              {displayTotal.toFixed(0)}
              <span className="ms-1 text-sm font-bold opacity-60">{t.sar}</span>
            </p>
          </div>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-2xl px-6 py-4 text-sm font-black text-white shadow-lg transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
              boxShadow: `0 8px 24px color-mix(in srgb, var(--sm-primary) 45%, transparent)`,
            }}
          >
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <ShoppingBag size={16} strokeWidth={2.5} />
                {t.createOrder}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PREMIUM HERO — shared across classic / cards / compact
   ═══════════════════════════════════════════════════════════════ */
function PremiumHero({
  salon, lang, t, dark, tight,
}: {
  salon: MenuData['salon'];
  lang: Lang;
  t: typeof T['ar'];
  dark: boolean;
  tight?: boolean;
}) {
  const salonName = lang === 'en' && salon.nameEn ? salon.nameEn : salon.nameAr;

  return (
    <div className="relative">
      {/* Cover / Gradient Band with parallax feel */}
      <div className={`relative overflow-hidden ${tight ? 'h-40' : 'h-52'}`}>
        {salon.coverImageUrl ? (
          <img
            src={salon.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ transform: 'scale(1.05)' }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
            }}
          />
        )}
        {/* Dotted pattern overlay */}
        <div
          className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 30%, white 1.5px, transparent 2px), radial-gradient(circle at 75% 70%, white 1px, transparent 1.5px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Gradient fade to bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 0%, transparent 35%, var(--sm-bg) 100%)`,
          }}
        />
      </div>

      {/* Floating Logo + Name */}
      <div className="relative -mt-14 flex flex-col items-center px-6 sm-fade-in">
        {salon.logoUrl ? (
          <div className="sm-float">
            <img
              src={salon.logoUrl}
              alt=""
              className="h-24 w-24 rounded-[1.75rem] object-contain"
              style={{
                background: 'var(--sm-bg-card)',
                border: `4px solid var(--sm-bg)`,
                boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
              }}
            />
          </div>
        ) : (
          <div
            className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] text-3xl font-black text-white sm-float"
            style={{
              background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
              border: `4px solid var(--sm-bg)`,
              boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
            }}
          >
            {(salon.nameAr || 'S')[0]}
          </div>
        )}

        {/* Welcome chip */}
        <div
          className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em]"
          style={{
            background: 'var(--sm-accent)',
            color: 'var(--sm-primary)',
          }}
        >
          <Sparkles size={11} strokeWidth={2.5} />
          {t.welcomeTag}
        </div>

        {/* Salon name (large, prominent) */}
        <h1 className="mt-2 text-center text-[26px] font-black leading-tight tracking-tight px-4">
          {salonName}
        </h1>

        {/* Welcome message */}
        {salon.welcomeMessage && (
          <p
            className="mt-2 text-center text-sm leading-relaxed max-w-sm px-4"
            style={{ color: 'var(--sm-text-secondary)' }}
          >
            {salon.welcomeMessage}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SELECT BUTTON — animated add/check with ripple
   ═══════════════════════════════════════════════════════════════ */
function SelectPill({
  selected, size = 28, onWhite = false,
}: {
  selected: boolean;
  size?: number;
  onWhite?: boolean;
}) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-xl transition-all"
      style={{
        width: size,
        height: size,
        background: selected
          ? 'var(--sm-primary)'
          : onWhite ? 'rgba(255,255,255,0.25)' : 'var(--sm-accent)',
        border: selected ? 'none' : `1px solid var(--sm-border)`,
        boxShadow: selected
          ? '0 4px 12px color-mix(in srgb, var(--sm-primary) 45%, transparent)'
          : undefined,
      }}
    >
      {selected ? (
        <Check size={Math.round(size * 0.55)} className="text-white sm-pop" strokeWidth={3.5} />
      ) : (
        <Plus size={Math.round(size * 0.5)} style={{ color: onWhite ? '#fff' : 'var(--sm-primary)' }} strokeWidth={2.5} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 1: CLASSIC — "Scroll Nav" with sticky category tabs + scroll-spy
   ═══════════════════════════════════════════════════════════════ */
function ClassicLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id || '');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);

  /* Scroll-spy: detect which category is in view */
  useEffect(() => {
    if (categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute('data-cat-id');
          if (id) setActiveCat(id);
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    categories.forEach((c) => {
      const el = sectionRefs.current[c.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories]);

  /* Auto-scroll the nav chip into view when active changes */
  useEffect(() => {
    const chip = navRef.current?.querySelector(`[data-chip="${activeCat}"]`);
    if (chip) {
      (chip as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCat]);

  const scrollToCat = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      const offset = 130;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <PremiumHero salon={salon} lang={lang} t={t} dark={dark} />

      {/* Sticky Category Nav (scroll-spy tabs) */}
      <div
        className="sticky top-0 z-40 -mx-0 mt-6 backdrop-blur-2xl"
        style={{
          background: dark ? 'rgba(15,15,15,0.85)' : 'rgba(255,255,255,0.85)',
          borderBottom: `1px solid var(--sm-border)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        <div
          ref={navRef}
          className="flex gap-2 overflow-x-auto px-4 py-3 sm-hide-scrollbar sm-snap-x"
        >
          {categories.map((cat) => {
            const isActive = activeCat === cat.id;
            const selectedCount = cat.services.filter((s) => selected.has(s.id)).length;
            return (
              <button
                key={cat.id}
                data-chip={cat.id}
                onClick={() => scrollToCat(cat.id)}
                className="sm-snap-start flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition-all active:scale-95"
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`
                    : 'var(--sm-accent)',
                  color: isActive ? '#fff' : 'var(--sm-primary)',
                  boxShadow: isActive ? '0 6px 20px color-mix(in srgb, var(--sm-primary) 35%, transparent)' : undefined,
                }}
              >
                {cn(cat)}
                <span
                  className="inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[9px]"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--sm-primary)',
                    color: isActive ? '#fff' : '#fff',
                  }}
                >
                  {selectedCount > 0 ? `${selectedCount}✓` : cat.services.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 mt-6 space-y-8">
        {categories.map((cat, catIdx) => (
          <div
            key={cat.id}
            ref={(el) => { sectionRefs.current[cat.id] = el; }}
            data-cat-id={cat.id}
            className="sm-fade-in scroll-mt-32"
            style={{ animationDelay: `${catIdx * 60}ms` }}
          >
            <div className="flex items-center gap-3 mb-4 px-1">
              <div className="h-px flex-1" style={{ background: 'var(--sm-border)' }} />
              <h2
                className="text-[11px] font-black uppercase tracking-[0.2em]"
                style={{ color: 'var(--sm-primary)' }}
              >
                {cn(cat)}
              </h2>
              <div className="h-px flex-1" style={{ background: 'var(--sm-border)' }} />
            </div>

            <div
              className="rounded-[28px] overflow-hidden"
              style={{
                background: 'var(--sm-bg-card)',
                border: `1px solid var(--sm-border)`,
                boxShadow: dark ? '0 8px 28px rgba(0,0,0,0.4)' : '0 8px 28px rgba(0,0,0,0.05)',
              }}
            >
              {cat.services.map((svc, i) => {
                const isSelected = selected.has(svc.id);
                return (
                  <ServiceRow
                    key={svc.id}
                    svc={svc}
                    selected={isSelected}
                    onToggle={() => toggle(svc.id)}
                    sn={sn}
                    t={t}
                    isLast={i === cat.services.length - 1}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceRow({
  svc, selected, onToggle, sn, t, isLast,
}: {
  svc: MenuService;
  selected: boolean;
  onToggle: () => void;
  sn: (s: { nameAr: string; nameEn: string | null }) => string;
  t: typeof T['ar'];
  isLast: boolean;
}) {
  const [rippling, setRippling] = useState(false);
  const handle = () => {
    setRippling(true);
    onToggle();
    setTimeout(() => setRippling(false), 550);
  };
  return (
    <button
      onClick={handle}
      className={`relative flex w-full items-center gap-4 px-5 py-4 text-start transition-all active:scale-[0.995] sm-ripple ${rippling ? 'sm-ripple-active' : ''}`}
      style={{
        borderBottom: !isLast ? `1px solid var(--sm-border)` : undefined,
        background: selected ? `color-mix(in srgb, var(--sm-primary) 6%, transparent)` : 'transparent',
      }}
    >
      <SelectPill selected={selected} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-snug" style={{ color: 'var(--sm-text)' }}>
          {sn(svc)}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <Clock size={11} style={{ color: 'var(--sm-text-secondary)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--sm-text-secondary)' }}>
            {t.duration(svc.duration)}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-end">
        <p className="text-lg font-black leading-none tabular-nums" style={{ color: 'var(--sm-primary)' }}>
          {svc.price}
        </p>
        <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: 'var(--sm-text-secondary)' }}>
          {t.sar}
        </p>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 2: CARDS — "Magazine Grid" with bold typography + gradient tiles
   ═══════════════════════════════════════════════════════════════ */
function CardsLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  return (
    <div className="mx-auto max-w-lg">
      <PremiumHero salon={salon} lang={lang} t={t} dark={dark} />

      <div className="px-4 mt-6 space-y-10">
        {categories.map((cat, catIdx) => {
          const selectedCount = cat.services.filter((s) => selected.has(s.id)).length;
          return (
            <div
              key={cat.id}
              className="sm-fade-in"
              style={{ animationDelay: `${catIdx * 70}ms` }}
            >
              {/* Category title row */}
              <div className="mb-4 flex items-end justify-between px-1">
                <div>
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{ color: 'var(--sm-text-secondary)' }}
                  >
                    {cat.services.length} {lang === 'ar' ? 'خدمات' : 'items'}
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    {cn(cat)}
                  </h2>
                </div>
                {selectedCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black text-white sm-pop"
                    style={{ background: 'var(--sm-primary)' }}
                  >
                    <Check size={11} strokeWidth={3} /> {selectedCount}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {cat.services.map((svc, i) => {
                  const isSelected = selected.has(svc.id);
                  /* First card bigger (featured) */
                  const featured = i === 0 && cat.services.length >= 3;
                  return (
                    <MagazineCard
                      key={svc.id}
                      svc={svc}
                      selected={isSelected}
                      onToggle={() => toggle(svc.id)}
                      sn={sn}
                      t={t}
                      featured={featured}
                      dark={dark}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MagazineCard({
  svc, selected, onToggle, sn, t, featured, dark,
}: {
  svc: MenuService;
  selected: boolean;
  onToggle: () => void;
  sn: (s: { nameAr: string; nameEn: string | null }) => string;
  t: typeof T['ar'];
  featured?: boolean;
  dark: boolean;
}) {
  const [rippling, setRippling] = useState(false);
  const handle = () => {
    setRippling(true);
    onToggle();
    setTimeout(() => setRippling(false), 550);
  };
  return (
    <button
      onClick={handle}
      className={`relative flex flex-col items-start gap-2 rounded-[24px] p-5 text-start transition-all active:scale-[0.97] overflow-hidden sm-ripple ${rippling ? 'sm-ripple-active' : ''} ${featured ? 'col-span-2' : ''}`}
      style={{
        background: selected
          ? `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`
          : 'var(--sm-bg-card)',
        border: selected ? 'none' : `1px solid var(--sm-border)`,
        boxShadow: selected
          ? `0 16px 36px color-mix(in srgb, var(--sm-primary) 40%, transparent)`
          : dark ? '0 4px 16px rgba(0,0,0,0.35)' : '0 4px 16px rgba(0,0,0,0.05)',
        minHeight: featured ? 180 : 150,
      }}
    >
      {/* Decorative gradient corner for unselected */}
      {!selected && (
        <div
          className="absolute -top-6 -end-6 h-20 w-20 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, var(--sm-primary) 20%, transparent) 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Select pill top-end */}
      <div className="absolute top-3 end-3">
        <SelectPill selected={selected} size={32} onWhite={selected} />
      </div>

      {/* Number label */}
      <div
        className="text-[10px] font-black uppercase tracking-[0.15em]"
        style={{ color: selected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)' }}
      >
        {t.duration(svc.duration)}
      </div>

      {/* Service name (big magazine-style) */}
      <p
        className={`${featured ? 'text-xl' : 'text-base'} mt-auto pr-10 font-black leading-tight tracking-tight`}
        style={{ color: selected ? '#fff' : 'var(--sm-text)' }}
      >
        {sn(svc)}
      </p>

      {/* Price chip */}
      <div
        className="mt-1 inline-flex items-baseline gap-1 rounded-full px-3 py-1.5"
        style={{
          background: selected ? 'rgba(255,255,255,0.2)' : 'var(--sm-accent)',
        }}
      >
        <span
          className={`${featured ? 'text-xl' : 'text-lg'} font-black leading-none tabular-nums`}
          style={{ color: selected ? '#fff' : 'var(--sm-primary)' }}
        >
          {svc.price}
        </span>
        <span
          className="text-[10px] font-black"
          style={{ color: selected ? 'rgba(255,255,255,0.85)' : 'var(--sm-primary)' }}
        >
          {t.sar}
        </span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 3: COMPACT — "Quick Chips" with filter + search
   ═══════════════════════════════════════════════════════════════ */
function CompactLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  const filteredServices = useMemo(() => {
    const base = filter === 'all'
      ? categories.flatMap((c) => c.services.map((s) => ({ ...s, catName: cn(c) })))
      : categories
          .filter((c) => c.id === filter)
          .flatMap((c) => c.services.map((s) => ({ ...s, catName: cn(c) })));
    if (!query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter(
      (s) => s.nameAr.toLowerCase().includes(q) || (s.nameEn || '').toLowerCase().includes(q),
    );
  }, [categories, filter, query, cn]);

  return (
    <div className="mx-auto max-w-lg">
      <PremiumHero salon={salon} lang={lang} t={t} dark={dark} tight />

      {/* Search bar */}
      <div className="px-4 mt-6">
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{
            background: 'var(--sm-bg-card)',
            border: `1px solid var(--sm-border)`,
            boxShadow: dark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          <Search size={16} style={{ color: 'var(--sm-text-secondary)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="flex-1 bg-transparent text-sm font-semibold outline-none placeholder:opacity-50"
            style={{ color: 'var(--sm-text)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="rounded-full p-1 transition hover:scale-110" style={{ color: 'var(--sm-text-secondary)' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal category chips */}
      <div className="mt-4 overflow-x-auto px-4 sm-hide-scrollbar">
        <div className="flex gap-2 pb-2">
          <ChipButton
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={t.all}
            count={categories.reduce((n, c) => n + c.services.length, 0)}
          />
          {categories.map((cat) => (
            <ChipButton
              key={cat.id}
              active={filter === cat.id}
              onClick={() => setFilter(cat.id)}
              label={cn(cat)}
              count={cat.services.length}
            />
          ))}
        </div>
      </div>

      {/* Services list */}
      <div className="px-4 mt-4 space-y-2.5">
        {filteredServices.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 rounded-3xl py-12 text-center"
            style={{ background: 'var(--sm-bg-card)', border: `1px solid var(--sm-border)` }}
          >
            <div className="text-4xl opacity-50">🔍</div>
            <p className="text-sm font-bold" style={{ color: 'var(--sm-text-secondary)' }}>
              {t.noResults}
            </p>
          </div>
        ) : (
          filteredServices.map((svc, i) => {
            const isSelected = selected.has(svc.id);
            return (
              <CompactRow
                key={svc.id}
                svc={svc}
                selected={isSelected}
                onToggle={() => toggle(svc.id)}
                sn={sn}
                t={t}
                catName={(svc as MenuService & { catName: string }).catName}
                delay={i * 30}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function ChipButton({
  active, onClick, label, count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition-all active:scale-95"
      style={{
        background: active
          ? `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`
          : 'var(--sm-bg-card)',
        color: active ? '#fff' : 'var(--sm-text)',
        border: active ? 'none' : `1px solid var(--sm-border)`,
        boxShadow: active ? '0 6px 18px color-mix(in srgb, var(--sm-primary) 35%, transparent)' : undefined,
      }}
    >
      {label}
      <span
        className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[9px] font-black"
        style={{
          background: active ? 'rgba(255,255,255,0.22)' : 'var(--sm-accent)',
          color: active ? '#fff' : 'var(--sm-primary)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

function CompactRow({
  svc, selected, onToggle, sn, t, catName, delay,
}: {
  svc: MenuService;
  selected: boolean;
  onToggle: () => void;
  sn: (s: { nameAr: string; nameEn: string | null }) => string;
  t: typeof T['ar'];
  catName: string;
  delay: number;
}) {
  const [rippling, setRippling] = useState(false);
  const handle = () => {
    setRippling(true);
    onToggle();
    setTimeout(() => setRippling(false), 550);
  };
  return (
    <button
      onClick={handle}
      className={`relative flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start transition-all active:scale-[0.99] sm-ripple sm-fade-in ${rippling ? 'sm-ripple-active' : ''}`}
      style={{
        background: selected
          ? `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`
          : 'var(--sm-bg-card)',
        border: selected ? 'none' : `1px solid var(--sm-border)`,
        boxShadow: selected
          ? '0 10px 28px color-mix(in srgb, var(--sm-primary) 35%, transparent)'
          : '0 2px 8px rgba(0,0,0,0.03)',
        animationDelay: `${delay}ms`,
      }}
    >
      <SelectPill selected={selected} onWhite={selected} />
      <div className="min-w-0 flex-1">
        <p
          className="text-[10px] font-black uppercase tracking-[0.1em]"
          style={{ color: selected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)' }}
        >
          {catName}
        </p>
        <p
          className="text-[15px] font-bold leading-snug"
          style={{ color: selected ? '#fff' : 'var(--sm-text)' }}
        >
          {sn(svc)}
        </p>
        <div className="mt-0.5 flex items-center gap-1">
          <Clock size={10} style={{ color: selected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)' }} />
          <span
            className="text-[11px] font-semibold"
            style={{ color: selected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)' }}
          >
            {t.duration(svc.duration)}
          </span>
        </div>
      </div>
      <div className="text-end">
        <p
          className="text-lg font-black leading-none tabular-nums"
          style={{ color: selected ? '#fff' : 'var(--sm-primary)' }}
        >
          {svc.price}
        </p>
        <p
          className="mt-0.5 text-[10px] font-black uppercase"
          style={{ color: selected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)' }}
        >
          {t.sar}
        </p>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 4: ELEGANT — "Luxury VIP" with serif + gold accents
   ═══════════════════════════════════════════════════════════════ */
function ElegantLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  const salonName = lang === 'en' && salon.nameEn ? salon.nameEn : salon.nameAr;
  return (
    <div className="mx-auto max-w-lg">
      {/* Cinematic Hero */}
      <div className="relative h-[70vh] max-h-[620px] w-full overflow-hidden">
        {salon.coverImageUrl ? (
          <img
            src={salon.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ transform: 'scale(1.05)' }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
            }}
          />
        )}
        {/* Film grain */}
        <div
          className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 40%, white 2px, transparent 2.5px), radial-gradient(circle at 70% 80%, white 1px, transparent 1.5px)',
            backgroundSize: '80px 80px',
          }}
        />
        {/* Dark vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 55%, var(--sm-bg) 100%)',
          }}
        />

        {/* Centered hero content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center sm-fade-in">
          {salon.logoUrl ? (
            <img
              src={salon.logoUrl}
              alt=""
              className="h-28 w-28 rounded-[2rem] object-contain shadow-2xl"
              style={{
                background: 'rgba(255,255,255,0.95)',
                border: '3px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(8px)',
              }}
            />
          ) : (
            <div
              className="flex h-28 w-28 items-center justify-center rounded-[2rem] text-4xl font-black text-white shadow-2xl"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '3px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {salonName[0]}
            </div>
          )}

          {/* Luxe badge */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 backdrop-blur-xl">
            <Crown size={12} className="text-amber-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
              {t.luxe}
            </span>
          </div>

          {/* Salon name (large, serif) */}
          <h1
            className="mt-5 text-4xl font-black leading-tight tracking-tight text-white drop-shadow-lg"
            style={{ fontFamily: lang === 'ar' ? "'Amiri', 'Tajawal', serif" : "'Playfair Display', serif" }}
          >
            {salonName}
          </h1>

          {salon.welcomeMessage && (
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
              {salon.welcomeMessage}
            </p>
          )}

          {/* Scroll hint */}
          <div className="absolute bottom-10 flex flex-col items-center gap-2 text-white/70">
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">{t.browseMenu}</span>
            <ChevronDown size={18} className="sm-float" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Decorative divider */}
      <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 px-6">
        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, var(--sm-primary))` }} />
        <Sparkles size={14} style={{ color: 'var(--sm-primary)' }} />
        <span
          className="text-[11px] font-black uppercase tracking-[0.3em]"
          style={{ color: 'var(--sm-primary)' }}
        >
          {t.services}
        </span>
        <Sparkles size={14} style={{ color: 'var(--sm-primary)' }} />
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, var(--sm-primary))` }} />
      </div>

      {/* Services */}
      <div className="mt-10 space-y-12 px-6">
        {categories.map((cat, catIdx) => (
          <div
            key={cat.id}
            className="sm-fade-in"
            style={{ animationDelay: `${catIdx * 80}ms` }}
          >
            <div className="mb-5 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--sm-text-secondary)' }}>
                {cat.services.length} · {lang === 'ar' ? 'خدمات' : 'items'}
              </p>
              <h2
                className="mt-1 text-2xl font-black tracking-tight"
                style={{
                  fontFamily: lang === 'ar' ? "'Amiri', 'Tajawal', serif" : "'Playfair Display', serif",
                  color: 'var(--sm-primary)',
                }}
              >
                {cn(cat)}
              </h2>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div className="h-px w-8" style={{ background: 'var(--sm-primary)', opacity: 0.4 }} />
                <div className="h-1 w-1 rounded-full" style={{ background: 'var(--sm-primary)' }} />
                <div className="h-px w-8" style={{ background: 'var(--sm-primary)', opacity: 0.4 }} />
              </div>
            </div>

            <div className="space-y-3">
              {cat.services.map((svc) => {
                const isSelected = selected.has(svc.id);
                return (
                  <ElegantRow
                    key={svc.id}
                    svc={svc}
                    selected={isSelected}
                    onToggle={() => toggle(svc.id)}
                    sn={sn}
                    t={t}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElegantRow({
  svc, selected, onToggle, sn, t,
}: {
  svc: MenuService;
  selected: boolean;
  onToggle: () => void;
  sn: (s: { nameAr: string; nameEn: string | null }) => string;
  t: typeof T['ar'];
}) {
  const [rippling, setRippling] = useState(false);
  const handle = () => {
    setRippling(true);
    onToggle();
    setTimeout(() => setRippling(false), 550);
  };
  return (
    <button
      onClick={handle}
      className={`relative flex w-full items-center gap-4 rounded-[22px] p-5 text-start transition-all active:scale-[0.985] sm-ripple ${rippling ? 'sm-ripple-active' : ''}`}
      style={{
        background: selected
          ? `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`
          : 'var(--sm-bg-card)',
        border: selected ? 'none' : `1px solid var(--sm-border)`,
        boxShadow: selected
          ? `0 20px 48px color-mix(in srgb, var(--sm-primary) 35%, transparent)`
          : '0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      <SelectPill selected={selected} size={36} onWhite={selected} />
      <div className="min-w-0 flex-1">
        <p
          className="text-[15px] font-bold leading-snug"
          style={{ color: selected ? '#fff' : 'var(--sm-text)' }}
        >
          {sn(svc)}
        </p>
        <p
          className="mt-1 flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: selected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)' }}
        >
          <Clock size={10} />
          {t.duration(svc.duration)}
        </p>
      </div>
      <div className="text-end">
        <p
          className="text-xl font-black leading-none tabular-nums"
          style={{ color: selected ? '#fff' : 'var(--sm-primary)' }}
        >
          {svc.price}
        </p>
        <p
          className="mt-1 text-[10px] font-black uppercase tracking-[0.15em]"
          style={{ color: selected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)' }}
        >
          {t.sar}
        </p>
      </div>
    </button>
  );
}
