'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock, ChevronDown, MapPin, Globe,
  ShoppingBag, Check, Plus, Sparkles, Star,
} from 'lucide-react';
import { menuApi, type MenuData, type MenuCategory } from '@/lib/menu-api';
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
    location: 'موقعنا على الخريطة',
    serviceCount: (n: number) => `${n} خدمة`,
    duration: (d: number) => `${d} د`,
    selectService: 'اختاري خدمتك',
    welcomeTag: 'مرحباً بكِ',
    browseMenu: 'تصفّح المنيو',
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
    location: 'View on map',
    serviceCount: (n: number) => `${n} service${n !== 1 ? 's' : ''}`,
    duration: (d: number) => `${d} min`,
    selectService: 'Pick your service',
    welcomeTag: 'Welcome',
    browseMenu: 'Browse Menu',
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

  /* ── Loading Skeleton ── */
  if (loading) {
    return (
      <div
        className="min-h-dvh"
        style={{ ...themeVars, background: 'var(--sm-bg)', color: 'var(--sm-text)' } as React.CSSProperties}
      >
        <div className="mx-auto max-w-lg px-4 pt-12">
          <div className="flex flex-col items-center gap-4">
            <div className="h-24 w-24 rounded-3xl animate-pulse" style={{ background: 'var(--sm-accent)' }} />
            <div className="h-5 w-48 rounded-full animate-pulse" style={{ background: 'var(--sm-accent)' }} />
            <div className="h-3 w-32 rounded-full animate-pulse" style={{ background: 'var(--sm-accent)', opacity: 0.6 }} />
          </div>
          <div className="mt-10 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl animate-pulse"
                style={{ background: 'var(--sm-bg-card)', border: '1px solid var(--sm-border)', animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{ background: 'var(--sm-accent)' }}>
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
      </div>
    );
  }

  const { salon, categories } = data;

  return (
    <div
      className="relative min-h-dvh"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        ...themeVars,
        background: 'var(--sm-bg)',
        color: 'var(--sm-text)',
        fontFamily: isRTL ? "'Tajawal', 'Cairo', sans-serif" : "'Inter', sans-serif",
      } as React.CSSProperties}
    >
      {/* ── Language Toggle (floating top) ── */}
      <div className="fixed top-4 z-50" style={{ [isRTL ? 'left' : 'right']: 16 }}>
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
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
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
        <p className="text-[11px] tracking-widest uppercase" style={{ color: 'var(--sm-text-secondary)', opacity: 0.4 }}>
          {t.poweredBy} <span className="font-black" style={{ letterSpacing: '0.2em' }}>SERVIX</span>
        </p>
      </div>

      {/* ── Sticky Bottom Bar ── */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-slide-up pointer-events-none">
          <div
            className="pointer-events-auto mx-auto max-w-lg rounded-3xl p-4 shadow-2xl backdrop-blur-2xl"
            style={{
              background: dark ? 'rgba(26,26,26,0.92)' : 'rgba(255,255,255,0.92)',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.08)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: 'var(--sm-primary)' }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--sm-primary)' }} />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--sm-text-secondary)' }}>
                    {t.serviceCount(selected.size)}
                  </p>
                </div>
                <p className="mt-0.5 text-2xl font-black leading-none" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                  {total.toFixed(0)} <span className="text-sm font-bold opacity-60">{t.sar}</span>
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
                  boxShadow: `0 8px 20px color-mix(in srgb, var(--sm-primary) 40%, transparent)`,
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
      )}

      {/* ── Global animations ── */}
      <style jsx global>{`
        @keyframes sm-slide-up {
          from { transform: translateY(120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: sm-slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }

        @keyframes sm-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sm-fade-in { animation: sm-fade-in 0.5s ease-out both; }
      `}</style>
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
   PREMIUM HERO (shared for Classic, Cards, Compact)
   — Cover image with gradient overlay + floating logo
   ═══════════════════════════════════════════════════════════════ */
function PremiumHero({
  salon,
  lang,
  t,
  dark,
  tight,
}: {
  salon: MenuData['salon'];
  lang: Lang;
  t: typeof T['ar'];
  dark: boolean;
  tight?: boolean;
}) {
  const salonName = lang === 'en' && salon.nameEn ? salon.nameEn : salon.nameAr;

  return (
    <div className="relative mb-6">
      {/* Cover / Gradient Band */}
      <div className={`relative overflow-hidden ${tight ? 'h-36' : 'h-44'}`}>
        {salon.coverImageUrl ? (
          <img src={salon.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
            }}
          />
        )}
        {/* decorative pattern */}
        <div
          className="absolute inset-0 opacity-10 mix-blend-overlay"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 30%, white 1.5px, transparent 2px), radial-gradient(circle at 75% 70%, white 1px, transparent 1.5px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* gradient fade to bg */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 0%, transparent 40%, var(--sm-bg) 100%)`,
          }}
        />
      </div>

      {/* Floating Logo */}
      <div className="relative -mt-12 flex flex-col items-center px-6 sm-fade-in">
        {salon.logoUrl ? (
          <img
            src={salon.logoUrl}
            alt=""
            className="h-24 w-24 rounded-3xl object-contain shadow-xl"
            style={{
              background: 'var(--sm-bg-card)',
              border: `4px solid var(--sm-bg)`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            }}
          />
        ) : (
          <div
            className="flex h-24 w-24 items-center justify-center rounded-3xl text-3xl font-black text-white shadow-xl"
            style={{
              background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
              border: `4px solid var(--sm-bg)`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            }}
          >
            {(salon.nameAr || 'S')[0]}
          </div>
        )}

        {/* Welcome chip */}
        <div
          className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: 'var(--sm-accent)',
            color: 'var(--sm-primary)',
          }}
        >
          <Sparkles size={11} strokeWidth={2.5} />
          {t.welcomeTag}
        </div>

        {/* Name */}
        <h1 className="mt-2 text-center text-2xl font-black leading-tight px-4">
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
   CATEGORY DIVIDER
   ═══════════════════════════════════════════════════════════════ */
function CategoryHeader({
  title,
  count,
  selectedCount,
}: {
  title: string;
  count: number;
  selectedCount: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-4 px-1">
      <div className="flex-1 h-px" style={{ background: 'var(--sm-border)' }} />
      <div className="flex items-center gap-2">
        <h2
          className="text-sm font-black uppercase tracking-widest"
          style={{ color: 'var(--sm-primary)', letterSpacing: '0.15em' }}
        >
          {title}
        </h2>
        <span
          className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-black"
          style={{ background: 'var(--sm-accent)', color: 'var(--sm-primary)' }}
        >
          {count}
        </span>
        {selectedCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black text-white"
            style={{ background: 'var(--sm-primary)' }}
          >
            <Check size={9} strokeWidth={3} />
            {selectedCount}
          </span>
        )}
      </div>
      <div className="flex-1 h-px" style={{ background: 'var(--sm-border)' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 1: CLASSIC — Premium vertical list with card container
   ═══════════════════════════════════════════════════════════════ */
function ClassicLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  return (
    <div className="mx-auto max-w-lg">
      <PremiumHero salon={salon} lang={lang} t={t} dark={dark} />

      <div className="px-4 space-y-8">
        {categories.map((cat, catIdx) => {
          const selectedCount = cat.services.filter((s) => selected.has(s.id)).length;
          return (
            <div key={cat.id} className="sm-fade-in" style={{ animationDelay: `${catIdx * 60}ms` }}>
              <CategoryHeader title={cn(cat)} count={cat.services.length} selectedCount={selectedCount} />

              <div
                className="rounded-3xl overflow-hidden"
                style={{
                  background: 'var(--sm-bg-card)',
                  border: `1px solid var(--sm-border)`,
                  boxShadow: dark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
                }}
              >
                {cat.services.map((svc, i) => {
                  const isSelected = selected.has(svc.id);
                  return (
                    <button
                      key={svc.id}
                      onClick={() => toggle(svc.id)}
                      className="relative flex w-full items-center gap-4 px-5 py-4 text-start transition-all active:scale-[0.99]"
                      style={{
                        borderTop: i > 0 ? `1px solid var(--sm-border)` : undefined,
                        background: isSelected
                          ? `color-mix(in srgb, var(--sm-primary) 8%, transparent)`
                          : 'transparent',
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all"
                        style={{
                          background: isSelected ? 'var(--sm-primary)' : 'var(--sm-accent)',
                          border: isSelected ? 'none' : `1px solid var(--sm-border)`,
                          boxShadow: isSelected ? '0 4px 12px color-mix(in srgb, var(--sm-primary) 40%, transparent)' : undefined,
                        }}
                      >
                        {isSelected ? (
                          <Check size={15} className="text-white" strokeWidth={3} />
                        ) : (
                          <Plus size={14} style={{ color: 'var(--sm-primary)' }} strokeWidth={2.5} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[15px] font-bold leading-snug"
                          style={{ color: 'var(--sm-text)' }}
                        >
                          {sn(svc)}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Clock size={11} style={{ color: 'var(--sm-text-secondary)' }} />
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--sm-text-secondary)' }}>
                            {t.duration(svc.duration)}
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="shrink-0 text-end">
                        <p
                          className="text-base font-black leading-none"
                          style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}
                        >
                          {svc.price}
                        </p>
                        <p
                          className="mt-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: 'var(--sm-text-secondary)' }}
                        >
                          {t.sar}
                        </p>
                      </div>
                    </button>
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

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 2: CARDS — Elevated card grid
   ═══════════════════════════════════════════════════════════════ */
function CardsLayout({ salon, categories, selected, toggle, sn, cn, t, lang, dark }: LayoutProps) {
  return (
    <div className="mx-auto max-w-lg">
      <PremiumHero salon={salon} lang={lang} t={t} dark={dark} />

      <div className="px-4 space-y-8">
        {categories.map((cat, catIdx) => {
          const selectedCount = cat.services.filter((s) => selected.has(s.id)).length;
          return (
            <div key={cat.id} className="sm-fade-in" style={{ animationDelay: `${catIdx * 60}ms` }}>
              <CategoryHeader title={cn(cat)} count={cat.services.length} selectedCount={selectedCount} />

              <div className="grid grid-cols-2 gap-3">
                {cat.services.map((svc) => {
                  const isSelected = selected.has(svc.id);
                  return (
                    <button
                      key={svc.id}
                      onClick={() => toggle(svc.id)}
                      className="relative flex flex-col items-start gap-2 rounded-2xl p-4 text-start transition-all active:scale-[0.97] overflow-hidden"
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`
                          : 'var(--sm-bg-card)',
                        border: isSelected ? 'none' : `1px solid var(--sm-border)`,
                        boxShadow: isSelected
                          ? `0 12px 28px color-mix(in srgb, var(--sm-primary) 35%, transparent)`
                          : dark
                            ? '0 2px 8px rgba(0,0,0,0.3)'
                            : '0 2px 8px rgba(0,0,0,0.04)',
                        minHeight: 130,
                      }}
                    >
                      {/* Selected check chip */}
                      <div
                        className="absolute top-2.5 end-2.5 flex h-6 w-6 items-center justify-center rounded-full transition-all"
                        style={{
                          background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--sm-accent)',
                        }}
                      >
                        {isSelected ? (
                          <Check size={12} className="text-white" strokeWidth={3} />
                        ) : (
                          <Plus size={12} style={{ color: 'var(--sm-primary)' }} strokeWidth={2.5} />
                        )}
                      </div>

                      {/* Decorative star for unselected */}
                      {!isSelected && (
                        <Star
                          size={14}
                          strokeWidth={2.5}
                          style={{ color: 'var(--sm-primary)', opacity: 0.5 }}
                        />
                      )}

                      <p
                        className="mt-auto text-sm font-bold leading-snug pr-5"
                        style={{ color: isSelected ? '#fff' : 'var(--sm-text)' }}
                      >
                        {sn(svc)}
                      </p>

                      <div
                        className="flex items-center gap-1 text-[11px] font-semibold"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--sm-text-secondary)' }}
                      >
                        <Clock size={10} /> {t.duration(svc.duration)}
                      </div>

                      <p
                        className="text-lg font-black leading-none"
                        style={{
                          color: isSelected ? '#fff' : 'var(--sm-primary)',
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {svc.price}{' '}
                        <span className="text-[10px] font-bold opacity-70">{t.sar}</span>
                      </p>
                    </button>
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

/* ═══════════════════════════════════════════════════════════════
   LAYOUT 3: COMPACT — Accordion with smooth transitions
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
    <div className="mx-auto max-w-lg">
      <PremiumHero salon={salon} lang={lang} t={t} dark={dark} tight />

      <div className="px-4 space-y-3">
        {categories.map((cat, catIdx) => {
          const isOpen = openCats.has(cat.id);
          const catSelectedCount = cat.services.filter((s) => selected.has(s.id)).length;

          return (
            <div
              key={cat.id}
              className="overflow-hidden rounded-3xl transition-all sm-fade-in"
              style={{
                background: 'var(--sm-bg-card)',
                border: `1px solid var(--sm-border)`,
                boxShadow: isOpen
                  ? dark
                    ? '0 8px 24px rgba(0,0,0,0.4)'
                    : '0 8px 24px rgba(0,0,0,0.06)'
                  : 'none',
                animationDelay: `${catIdx * 50}ms`,
              }}
            >
              {/* Category header button */}
              <button
                onClick={() => toggleCat(cat.id)}
                className="flex w-full items-center justify-between px-5 py-4 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: 'var(--sm-accent)' }}
                  >
                    <Sparkles size={14} style={{ color: 'var(--sm-primary)' }} strokeWidth={2.5} />
                  </div>
                  <h2 className="text-[15px] font-black" style={{ color: 'var(--sm-text)' }}>
                    {cn(cat)}
                  </h2>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-black"
                    style={{ background: 'var(--sm-accent)', color: 'var(--sm-primary)' }}
                  >
                    {cat.services.length}
                  </span>
                  {catSelectedCount > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                      style={{ background: 'var(--sm-primary)' }}
                    >
                      {catSelectedCount} ✓
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={18}
                  className="transition-transform"
                  style={{
                    color: 'var(--sm-text-secondary)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {/* Services list */}
              {isOpen && (
                <div className="px-4 pb-3 sm-fade-in">
                  {cat.services.map((svc, i) => {
                    const isSelected = selected.has(svc.id);
                    return (
                      <button
                        key={svc.id}
                        onClick={() => toggle(svc.id)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition-all active:scale-[0.99]"
                        style={{
                          borderTop: i > 0 ? `1px solid var(--sm-border)` : undefined,
                          background: isSelected
                            ? `color-mix(in srgb, var(--sm-primary) 8%, transparent)`
                            : 'transparent',
                        }}
                      >
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all"
                          style={{
                            background: isSelected ? 'var(--sm-primary)' : 'var(--sm-accent)',
                            border: isSelected ? 'none' : `1px solid var(--sm-border)`,
                          }}
                        >
                          {isSelected ? (
                            <Check size={13} className="text-white" strokeWidth={3} />
                          ) : (
                            <Plus size={12} style={{ color: 'var(--sm-primary)' }} strokeWidth={2.5} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-start">
                          <p
                            className="text-sm font-bold"
                            style={{ color: isSelected ? 'var(--sm-primary)' : 'var(--sm-text)' }}
                          >
                            {sn(svc)}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1">
                            <Clock size={10} style={{ color: 'var(--sm-text-secondary)' }} />
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: 'var(--sm-text-secondary)' }}
                            >
                              {t.duration(svc.duration)}
                            </span>
                          </div>
                        </div>
                        <span
                          className="text-sm font-black"
                          style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}
                        >
                          {svc.price}{' '}
                          <span className="text-[10px] opacity-60">{t.sar}</span>
                        </span>
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
      <div className="relative h-60 w-full overflow-hidden">
        {salon.coverImageUrl ? (
          <img src={salon.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
            }}
          />
        )}
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 40%, white 2px, transparent 2.5px), radial-gradient(circle at 70% 80%, white 1px, transparent 1.5px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(0deg, var(--sm-bg) 0%, transparent 55%)',
          }}
        />
      </div>

      {/* Overlapping Logo */}
      <div className="relative -mt-16 flex flex-col items-center px-6 sm-fade-in">
        {salon.logoUrl ? (
          <img
            src={salon.logoUrl}
            alt=""
            className="h-28 w-28 rounded-[2rem] object-contain shadow-2xl"
            style={{
              background: 'var(--sm-bg-card)',
              border: `4px solid var(--sm-bg)`,
            }}
          />
        ) : (
          <div
            className="flex h-28 w-28 items-center justify-center rounded-[2rem] shadow-2xl text-4xl font-black text-white"
            style={{
              background: `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`,
              border: `4px solid var(--sm-bg)`,
            }}
          >
            {(salon.nameAr || 'S')[0]}
          </div>
        )}

        <h1
          className="mt-5 text-3xl font-black text-center tracking-tight"
          style={{ fontFamily: lang === 'ar' ? "'Amiri', 'Tajawal', serif" : "'Playfair Display', serif" }}
        >
          {lang === 'en' && salon.nameEn ? salon.nameEn : salon.nameAr}
        </h1>

        {salon.welcomeMessage && (
          <p
            className="mt-3 text-sm text-center leading-relaxed max-w-sm"
            style={{ color: 'var(--sm-text-secondary)' }}
          >
            {salon.welcomeMessage}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px w-10" style={{ background: 'var(--sm-primary)', opacity: 0.4 }} />
          <Sparkles size={14} style={{ color: 'var(--sm-primary)' }} />
          <span
            className="text-[11px] font-black uppercase"
            style={{ color: 'var(--sm-primary)', letterSpacing: '0.25em' }}
          >
            {t.services}
          </span>
          <Sparkles size={14} style={{ color: 'var(--sm-primary)' }} />
          <div className="h-px w-10" style={{ background: 'var(--sm-primary)', opacity: 0.4 }} />
        </div>
      </div>

      {/* Services */}
      <div className="mt-8 space-y-10 px-6">
        {categories.map((cat, catIdx) => (
          <div
            key={cat.id}
            className="sm-fade-in"
            style={{ animationDelay: `${catIdx * 80}ms` }}
          >
            <h2
              className="mb-5 text-center text-[11px] font-black uppercase"
              style={{ color: 'var(--sm-primary)', letterSpacing: '0.25em' }}
            >
              — {cn(cat)} —
            </h2>

            <div className="space-y-3">
              {cat.services.map((svc) => {
                const isSelected = selected.has(svc.id);
                return (
                  <button
                    key={svc.id}
                    onClick={() => toggle(svc.id)}
                    className="flex w-full items-center gap-4 rounded-2xl p-5 text-start transition-all active:scale-[0.98]"
                    style={{
                      background: isSelected
                        ? `linear-gradient(135deg, var(--sm-primary), var(--sm-primary-dark))`
                        : 'var(--sm-bg-card)',
                      border: isSelected ? 'none' : `1px solid var(--sm-border)`,
                      boxShadow: isSelected
                        ? `0 16px 40px color-mix(in srgb, var(--sm-primary) 35%, transparent)`
                        : '0 2px 12px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all"
                      style={{
                        background: isSelected ? 'rgba(255,255,255,0.22)' : 'var(--sm-accent)',
                      }}
                    >
                      {isSelected ? (
                        <Check size={16} className="text-white" strokeWidth={3} />
                      ) : (
                        <Plus size={16} style={{ color: 'var(--sm-primary)' }} strokeWidth={2.5} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[15px] font-bold"
                        style={{ color: isSelected ? '#fff' : 'var(--sm-text)' }}
                      >
                        {sn(svc)}
                      </p>
                      <p
                        className="mt-0.5 flex items-center gap-1 text-xs font-semibold"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)' }}
                      >
                        <Clock size={10} /> {t.duration(svc.duration)}
                      </p>
                    </div>

                    <div className="text-end">
                      <p
                        className="text-lg font-black leading-none"
                        style={{
                          color: isSelected ? '#fff' : 'var(--sm-primary)',
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {svc.price}
                      </p>
                      <p
                        className="mt-0.5 text-[10px] font-bold uppercase"
                        style={{
                          color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--sm-text-secondary)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {t.sar}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
