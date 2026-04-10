'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock, ChevronDown, ChevronUp, MapPin, Globe,
  ShoppingBag, Check, Minus, Plus, Sparkles,
} from 'lucide-react';
import { menuApi, type MenuData, type MenuService, type MenuCategory } from '@/lib/menu-api';
import { getThemeCSSVars, isDarkTheme } from '@/lib/menu-themes';

/* ═══════════════════════════════════════════════════════════════
   TRANSLATIONS
   ═══════════════════════════════════════════════════════════════ */
const T = {
  ar: {
    loading: 'جارٍ التحميل...',
    error: 'حدث خطأ في تحميل المنيو',
    retry: 'إعادة المحاولة',
    services: 'خدماتنا',
    min: 'د',
    sar: 'ر.س',
    selected: 'تم الاختيار',
    createOrder: 'إنشاء الطلب',
    total: 'المجموع التقريبي',
    poweredBy: 'Powered by',
    location: 'موقعنا',
    serviceCount: (n: number) => `${n} خدمة`,
    duration: (d: number) => `${d} د`,
  },
  en: {
    loading: 'Loading...',
    error: 'Failed to load menu',
    retry: 'Try Again',
    services: 'Our Services',
    min: 'min',
    sar: 'SAR',
    selected: 'Selected',
    createOrder: 'Create Order',
    total: 'Estimated Total',
    poweredBy: 'Powered by',
    location: 'Our Location',
    serviceCount: (n: number) => `${n} service${n !== 1 ? 's' : ''}`,
    duration: (d: number) => `${d} min`,
  },
};

type Lang = 'ar' | 'en';

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
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
  const layout = data?.salon.themeLayout || 'classic';

  /* ── Service name helper ── */
  const sn = (s: { nameAr: string; nameEn: string | null }) =>
    lang === 'en' && s.nameEn ? s.nameEn : s.nameAr;
  const cn = (c: { nameAr: string; nameEn: string | null }) =>
    lang === 'en' && c.nameEn ? c.nameEn : c.nameAr;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ ...themeVars, background: 'var(--sm-bg)', color: 'var(--sm-text)' } as React.CSSProperties}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-3 border-[var(--sm-primary)] border-t-transparent animate-spin" style={{ borderWidth: 3 }} />
          <p className="text-sm" style={{ color: 'var(--sm-text-secondary)' }}>{t.loading}</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ background: '#FAF5FF', color: '#1E1B2E' }}>
        <div className="text-center space-y-4 px-6">
          <div className="text-4xl">😔</div>
          <p className="text-lg font-bold">{error || t.error}</p>
          <button onClick={fetchMenu} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#7C3AED' }}>{t.retry}</button>
        </div>
      </div>
    );
  }

  const { salon, categories } = data;

  return (
    <div
      className="min-h-dvh"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        ...themeVars,
        background: 'var(--sm-bg)',
        color: 'var(--sm-text)',
        fontFamily: isRTL ? "'Tajawal', 'Cairo', sans-serif" : "'Inter', sans-serif",
      } as React.CSSProperties}
    >
      {/* ── Language Toggle ── */}
      <div className="fixed top-4 z-50" style={{ [isRTL ? 'left' : 'right']: 16 }}>
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-xl transition-transform hover:scale-110"
          style={{
            background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
            border: `1px solid var(--sm-border)`,
            color: 'var(--sm-primary)',
          }}
        >
          <Globe size={18} />
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
        <div className="px-5 pb-4">
          <a href={salon.googleMapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition hover:opacity-80"
            style={{ background: 'var(--sm-accent)', color: 'var(--sm-primary)' }}>
            <MapPin size={16} /> {t.location}
          </a>
        </div>
      )}

      {/* ── Powered By ── */}
      {/* TODO: Hide "Powered by SERVIX" based on subscription plan (premium plans can hide branding) */}
      <div className="pb-28 pt-6 text-center">
        <p className="text-xs" style={{ color: 'var(--sm-text-secondary)', opacity: 0.4 }}>
          {t.poweredBy} <span className="font-bold">SERVIX</span>
        </p>
      </div>

      {/* ── Sticky Bottom Bar ── */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-lg rounded-2xl p-4 shadow-2xl backdrop-blur-xl"
            style={{
              background: dark ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)',
              border: `1px solid var(--sm-border)`,
            }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold" style={{ color: 'var(--sm-text-secondary)' }}>
                  {t.serviceCount(selected.size)}
                </p>
                <p className="text-lg font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                  {total.toFixed(0)} {t.sar}
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-xl px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{ background: 'var(--sm-primary)' }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShoppingBag size={16} /> {t.createOrder}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
   HEADER COMPONENT (shared)
   ═══════════════════════════════════════════════════════════════ */
function SalonHeader({ salon, sn, lang, compact }: { salon: MenuData['salon']; sn: (s: { nameAr: string; nameEn: string | null }) => string; lang: Lang; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-2 py-6' : 'gap-3 py-8'}`}>
      {/* Logo */}
      {salon.logoUrl ? (
        <img src={salon.logoUrl} alt="" className={`${compact ? 'h-16 w-16' : 'h-20 w-20'} rounded-2xl object-contain shadow-md`}
          style={{ border: `2px solid var(--sm-border)` }} />
      ) : (
        <div className={`${compact ? 'h-16 w-16' : 'h-20 w-20'} flex items-center justify-center rounded-2xl text-2xl font-black text-white shadow-md`}
          style={{ background: 'var(--sm-primary)' }}>
          {(salon.nameAr || 'S')[0]}
        </div>
      )}
      {/* Name */}
      <h1 className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-center px-4`}>
        {lang === 'en' && salon.nameEn ? salon.nameEn : salon.nameAr}
      </h1>
      {/* Welcome */}
      {salon.welcomeMessage && (
        <p className="text-sm text-center leading-relaxed px-8 max-w-md" style={{ color: 'var(--sm-text-secondary)' }}>
          {salon.welcomeMessage}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 1: CLASSIC — Clean vertical list
   ═══════════════════════════════════════════════════════════════ */
function ClassicLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  return (
    <div className="mx-auto max-w-lg px-0">
      <SalonHeader salon={salon} sn={sn} lang={lang} />

      {categories.map((cat) => (
        <div key={cat.id} className="mb-6">
          {/* Category header */}
          <div className="sticky top-0 z-10 px-5 py-3 backdrop-blur-md" style={{ background: dark ? 'rgba(15,15,15,0.9)' : 'rgba(250,245,255,0.9)' }}>
            <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--sm-primary)' }}>
              {cn(cat)}
            </h2>
          </div>

          {/* Services */}
          <div className="px-5">
            {cat.services.map((svc, i) => {
              const isSelected = selected.has(svc.id);
              return (
                <button
                  key={svc.id}
                  onClick={() => toggle(svc.id)}
                  className="flex w-full items-center gap-3 py-4 transition-all"
                  style={{ borderBottom: i < cat.services.length - 1 ? `1px solid var(--sm-border)` : undefined }}
                >
                  {/* Checkbox */}
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all"
                    style={{
                      background: isSelected ? 'var(--sm-primary)' : 'transparent',
                      border: isSelected ? 'none' : `2px solid var(--sm-border)`,
                    }}
                  >
                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 text-start">
                    <p className={`text-sm ${isSelected ? 'font-bold' : 'font-semibold'}`} style={{ color: isSelected ? 'var(--sm-primary)' : 'var(--sm-text)' }}>
                      {sn(svc)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--sm-text-secondary)' }}>
                        <Clock size={10} /> {t.duration(svc.duration)}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <span className="text-sm font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                    {svc.price} {t.sar}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 2: CARDS — Card grid, 2-column mobile
   ═══════════════════════════════════════════════════════════════ */
function CardsLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  return (
    <div className="mx-auto max-w-lg px-4">
      <SalonHeader salon={salon} sn={sn} lang={lang} />

      {categories.map((cat) => (
        <div key={cat.id} className="mb-8">
          <h2 className="mb-4 text-sm font-black uppercase tracking-wider px-1" style={{ color: 'var(--sm-primary)' }}>
            {cn(cat)}
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {cat.services.map((svc) => {
              const isSelected = selected.has(svc.id);
              return (
                <button
                  key={svc.id}
                  onClick={() => toggle(svc.id)}
                  className="relative flex flex-col items-start gap-2 rounded-2xl p-4 text-start transition-all active:scale-[0.97]"
                  style={{
                    background: isSelected ? 'var(--sm-primary)' : 'var(--sm-bg-card)',
                    border: isSelected ? 'none' : `1px solid var(--sm-border)`,
                    boxShadow: isSelected ? `0 8px 24px ${dark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}` : `0 1px 3px ${dark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)'}`,
                  }}
                >
                  {isSelected && (
                    <div className="absolute top-2 end-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  <p className={`text-sm font-bold leading-snug ${isSelected ? 'text-white' : ''}`}
                    style={{ color: isSelected ? undefined : 'var(--sm-text)' }}>
                    {sn(svc)}
                  </p>
                  <div className={`flex items-center gap-1.5 text-xs ${isSelected ? 'text-white/70' : ''}`}
                    style={{ color: isSelected ? undefined : 'var(--sm-text-secondary)' }}>
                    <Clock size={10} /> {t.duration(svc.duration)}
                  </div>
                  <p className={`text-base font-black ${isSelected ? 'text-white' : ''}`}
                    style={{ color: isSelected ? undefined : 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                    {svc.price} <span className="text-xs font-semibold">{t.sar}</span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 3: COMPACT — Accordion/collapsible categories
   ═══════════════════════════════════════════════════════════════ */
function CompactLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  const [openCats, setOpenCats] = useState<Set<string>>(
    () => new Set(categories.length > 0 ? [categories[0].id] : []),
  );

  const toggleCat = (id: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-lg px-4">
      <SalonHeader salon={salon} sn={sn} lang={lang} compact />

      <div className="space-y-2">
        {categories.map((cat) => {
          const isOpen = openCats.has(cat.id);
          const catSelectedCount = cat.services.filter((s) => selected.has(s.id)).length;

          return (
            <div
              key={cat.id}
              className="overflow-hidden rounded-2xl transition-all"
              style={{
                background: 'var(--sm-bg-card)',
                border: `1px solid var(--sm-border)`,
              }}
            >
              {/* Category header button */}
              <button
                onClick={() => toggleCat(cat.id)}
                className="flex w-full items-center justify-between px-4 py-3.5 transition-all"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black" style={{ color: 'var(--sm-text)' }}>
                    {cn(cat)}
                  </h2>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--sm-accent)', color: 'var(--sm-primary)' }}>
                    {cat.services.length}
                  </span>
                  {catSelectedCount > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--sm-primary)' }}>
                      {catSelectedCount} ✓
                    </span>
                  )}
                </div>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--sm-text-secondary)' }} />
                  : <ChevronDown size={16} style={{ color: 'var(--sm-text-secondary)' }} />}
              </button>

              {/* Services list */}
              {isOpen && (
                <div className="px-4 pb-3">
                  {cat.services.map((svc, i) => {
                    const isSelected = selected.has(svc.id);
                    return (
                      <button
                        key={svc.id}
                        onClick={() => toggle(svc.id)}
                        className="flex w-full items-center gap-3 py-3 transition-all"
                        style={{ borderTop: i > 0 ? `1px solid var(--sm-border)` : undefined }}
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all"
                          style={{
                            background: isSelected ? 'var(--sm-primary)' : 'transparent',
                            border: isSelected ? 'none' : `2px solid var(--sm-border)`,
                          }}>
                          {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className={`flex-1 text-start text-sm ${isSelected ? 'font-bold' : 'font-medium'}`}
                          style={{ color: isSelected ? 'var(--sm-primary)' : 'var(--sm-text)' }}>
                          {sn(svc)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: 'var(--sm-text-secondary)' }}>
                            {t.duration(svc.duration)}
                          </span>
                          <span className="text-sm font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                            {svc.price}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 4: ELEGANT — Hero cover, overlapping logo, premium
   ═══════════════════════════════════════════════════════════════ */
function ElegantLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  return (
    <div className="mx-auto max-w-lg">
      {/* Hero Cover */}
      <div className="relative h-52 w-full overflow-hidden">
        {salon.coverImageUrl ? (
          <img src={salon.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{
            background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
          }} />
        )}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(0deg, var(--sm-bg) 0%, transparent 60%)',
        }} />
      </div>

      {/* Overlapping Logo */}
      <div className="relative -mt-14 flex flex-col items-center px-6">
        {salon.logoUrl ? (
          <img src={salon.logoUrl} alt="" className="h-24 w-24 rounded-3xl object-contain shadow-xl"
            style={{ background: 'var(--sm-bg-card)', border: `3px solid var(--sm-bg)` }} />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl shadow-xl text-3xl font-black text-white"
            style={{ background: 'var(--sm-primary)', border: `3px solid var(--sm-bg)` }}>
            {(salon.nameAr || 'S')[0]}
          </div>
        )}

        <h1 className="mt-4 text-2xl font-black text-center" style={{ fontFamily: lang === 'ar' ? "'Amiri', serif" : undefined }}>
          {lang === 'en' && salon.nameEn ? salon.nameEn : salon.nameAr}
        </h1>

        {salon.welcomeMessage && (
          <p className="mt-2 text-sm text-center leading-relaxed max-w-xs" style={{ color: 'var(--sm-text-secondary)' }}>
            {salon.welcomeMessage}
          </p>
        )}

        <div className="mt-6 flex items-center gap-2">
          <Sparkles size={14} style={{ color: 'var(--sm-primary)' }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--sm-primary)' }}>
            {t.services}
          </span>
          <Sparkles size={14} style={{ color: 'var(--sm-primary)' }} />
        </div>
      </div>

      {/* Services */}
      <div className="mt-6 space-y-10 px-6">
        {categories.map((cat) => (
          <div key={cat.id}>
            <h2 className="mb-5 text-center text-sm font-black uppercase tracking-widest" style={{ color: 'var(--sm-primary)', letterSpacing: '0.15em' }}>
              — {cn(cat)} —
            </h2>

            <div className="space-y-3">
              {cat.services.map((svc) => {
                const isSelected = selected.has(svc.id);
                return (
                  <button
                    key={svc.id}
                    onClick={() => toggle(svc.id)}
                    className="flex w-full items-center gap-4 rounded-2xl p-5 text-start transition-all"
                    style={{
                      background: isSelected
                        ? `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`
                        : 'var(--sm-bg-card)',
                      border: isSelected ? 'none' : `1px solid var(--sm-border)`,
                      boxShadow: isSelected ? '0 12px 32px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all"
                      style={{
                        background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--sm-accent)',
                      }}>
                      {isSelected ? <Check size={14} className="text-white" strokeWidth={3} />
                        : <Plus size={14} style={{ color: 'var(--sm-primary)' }} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold" style={{ color: isSelected ? '#fff' : 'var(--sm-text)' }}>
                        {sn(svc)}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: isSelected ? 'rgba(255,255,255,0.65)' : 'var(--sm-text-secondary)' }}>
                        <Clock size={10} className="inline" /> {t.duration(svc.duration)}
                      </p>
                    </div>

                    <p className="text-base font-black" style={{
                      color: isSelected ? '#fff' : 'var(--sm-primary)',
                      fontFeatureSettings: '"tnum"',
                    }}>
                      {svc.price} <span className="text-xs font-semibold">{t.sar}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ POWERED BY ═══ */}
      {/* TODO: Hide "Powered by SERVIX" based on subscription plan (premium plans can hide branding) */}
      <div style={{ textAlign: 'center', padding: '24px 0 16px', opacity: 0.4, fontSize: '11px', color: 'var(--sm-text-secondary)' }}>
        Powered by <a href="https://servi-x.com" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>SERVIX</a>
      </div>
    </div>
  );
}
