'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight, Upload, Palette, Layout, MessageCircle,
  MapPin, Image, Eye, Check, QrCode, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { MenuQRModal } from './MenuQRModal';

/* ─── Types ─── */
interface ThemeData {
  logoUrl: string | null;
  coverImageUrl: string | null;
  brandColorPreset: string;
  themeLayout: string;
  welcomeMessage: string | null;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
}

const COLORS = [
  { id: 'purple',  label: 'بنفسجي ملكي',  hex: '#7C3AED' },
  { id: 'gold',    label: 'ذهبي دافئ',     hex: '#B8860B' },
  { id: 'pink',    label: 'وردي ناعم',     hex: '#EC4899' },
  { id: 'black',   label: 'أسود أنيق',     hex: '#D4AF37' },
  { id: 'blue',    label: 'أزرق هادئ',     hex: '#3B82F6' },
  { id: 'green',   label: 'أخضر طبيعي',    hex: '#6B8E23' },
  { id: 'brown',   label: 'بني دافئ',      hex: '#8B7355' },
  { id: 'fuchsia', label: 'فوشيا جريء',    hex: '#D946EF' },
];

const LAYOUTS = [
  { id: 'classic', label: 'كلاسيكي', desc: 'قائمة عمودية بسيطة',           icon: '📋' },
  { id: 'cards',   label: 'بطاقات',  desc: 'شبكة بطاقات بعمودين',          icon: '🃏' },
  { id: 'compact', label: 'مضغوط',   desc: 'فئات قابلة للطي (accordion)',  icon: '📑' },
  { id: 'elegant', label: 'فاخر',    desc: 'غلاف كبير + تصميم VIP',       icon: '👑' },
];

export default function SmartMenuSettingsPage() {
  const router = useRouter();
  const { accessToken, currentTenant } = useAuth();
  const qc = useQueryClient();
  const [qrOpen, setQrOpen] = useState(false);

  /* ── Fetch ── */
  const { data, isLoading } = useQuery<ThemeData>({
    queryKey: ['settings', 'theme'],
    queryFn: () => api.get<ThemeData>('/salon', accessToken!).then((res: any) => ({
      logoUrl: res.logoUrl ?? null,
      coverImageUrl: res.coverImageUrl ?? null,
      brandColorPreset: res.brandColorPreset ?? 'purple',
      themeLayout: res.themeLayout ?? 'classic',
      welcomeMessage: res.welcomeMessage ?? null,
      googleMapsUrl: res.googleMapsUrl ?? null,
      googlePlaceId: res.googlePlaceId ?? null,
    })),
    enabled: !!accessToken,
  });

  /* ── State ── */
  const [color, setColor] = useState('purple');
  const [layout, setLayout] = useState('classic');
  const [welcome, setWelcome] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [placeId, setPlaceId] = useState('');

  useEffect(() => {
    if (data) {
      setColor(data.brandColorPreset ?? 'purple');
      setLayout(data.themeLayout ?? 'classic');
      setWelcome(data.welcomeMessage ?? '');
      setMapsUrl(data.googleMapsUrl ?? '');
      setPlaceId(data.googlePlaceId ?? '');
    }
  }, [data]);

  const hasChanges = data && (
    color !== data.brandColorPreset ||
    layout !== data.themeLayout ||
    welcome !== (data.welcomeMessage ?? '') ||
    mapsUrl !== (data.googleMapsUrl ?? '') ||
    placeId !== (data.googlePlaceId ?? '')
  );

  /* ── Save ── */
  const saveMut = useMutation({
    mutationFn: () => api.put('/salon/theme', {
      brandColorPreset: color,
      themeLayout: layout,
      welcomeMessage: welcome || undefined,
      googleMapsUrl: mapsUrl || undefined,
      googlePlaceId: placeId || undefined,
    }, accessToken!),
    onSuccess: () => {
      toast.success('✅ تم حفظ إعدادات المنيو');
      qc.invalidateQueries({ queryKey: ['settings', 'theme'] });
    },
    onError: () => toast.error('خطأ في الحفظ'),
  });

  /* ── Upload ── */
  const handleUpload = async (type: 'logo' | 'cover', file: File) => {
    const maxSize = type === 'logo' ? 2 : 5;
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`الملف أكبر من ${maxSize}MB`);
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const endpoint = type === 'logo' ? 'salon/logo' : 'salon/cover';
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error('فشل');
      const d = await res.json();
      toast.success(d.data?.message || `✅ تم رفع ${type === 'logo' ? 'الشعار' : 'الغلاف'}`);
      qc.invalidateQueries({ queryKey: ['settings', 'theme'] });
    } catch {
      toast.error(`فشل رفع ${type === 'logo' ? 'الشعار' : 'الغلاف'}`);
    }
  };

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
            <QrCode className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black">المنيو والعرض العام</h1>
            <p className="text-xs text-[var(--muted-foreground)]">تخصيص شكل المنيو الذكي والصفحة العامة</p>
          </div>
        </div>
      </div>

      {/* ─── ⭐ Menu QR Code ─── */}
      <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
        <div className="relative p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xl shadow-lg ring-1 ring-white/20">
              <QrCode className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-black">باركود المنيو الذكي</h2>
                <Sparkles className="h-3.5 w-3.5 opacity-80" />
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                أصدري باركود قابل للطباعة يعرض المنيو للعملاء عند مسحه بالهاتف
              </p>
            </div>
          </div>
          <button
            onClick={() => setQrOpen(true)}
            disabled={!currentTenant?.slug}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-black text-teal-700 shadow-lg hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <QrCode className="h-4 w-4" />
            إصدار باركود المنيو
          </button>
        </div>
      </div>

      {/* ─── 1. Logo ─── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-sky-500 to-blue-600 text-white flex items-center gap-2">
          <Upload className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">شعار الصالون</span>
        </div>
        <div className="p-5 space-y-3">
          {data?.logoUrl && (
            <div className="flex justify-center">
              <img src={data.logoUrl} alt="شعار الصالون" className="h-24 w-24 object-contain rounded-2xl border-2 border-[var(--border)] shadow-lg" />
            </div>
          )}
          <label className="flex h-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/30 transition-colors hover:border-[var(--brand-primary)] cursor-pointer">
            <Upload className="mb-2 h-6 w-6 text-[var(--muted-foreground)] opacity-30" />
            <p className="text-xs font-bold text-[var(--muted-foreground)]">{data?.logoUrl ? 'تغيير الشعار' : 'اضغطي لرفع الشعار'}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">PNG, JPG بحد أقصى 2MB</p>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUpload('logo', file);
            }} />
          </label>
        </div>
      </div>

      {/* ─── 2. Cover Image ─── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-orange-500 to-amber-600 text-white flex items-center gap-2">
          <Image className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">صورة الغلاف</span>
        </div>
        <div className="p-5 space-y-3">
          {data?.coverImageUrl && (
            <div className="flex justify-center">
              <img src={data.coverImageUrl} alt="صورة الغلاف" className="h-40 w-full object-cover rounded-2xl border-2 border-[var(--border)] shadow-lg" />
            </div>
          )}
          <label className="flex h-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/30 transition-colors hover:border-[var(--brand-primary)] cursor-pointer">
            <Image className="mb-2 h-6 w-6 text-[var(--muted-foreground)] opacity-30" />
            <p className="text-xs font-bold text-[var(--muted-foreground)]">{data?.coverImageUrl ? 'تغيير صورة الغلاف' : 'اضغطي لرفع صورة الغلاف'}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">PNG, JPG بحد أقصى 5MB — أبعاد مقترحة: 1200×400</p>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUpload('cover', file);
            }} />
          </label>
        </div>
      </div>

      {/* ─── 3. Brand Color ─── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-violet-500 to-purple-600 text-white flex items-center gap-2">
          <Palette className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">لون العلامة التجارية</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-4">يُطبّق على الأزرار والعناوين في صفحة المنيو الذكي</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setColor(c.id)}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all hover:scale-105',
                  color === c.id
                    ? 'border-[var(--foreground)] shadow-lg ring-2 ring-offset-2 ring-offset-[var(--card)]'
                    : 'border-[var(--border)] hover:border-[var(--muted-foreground)]',
                )}
              >
                <div className="h-10 w-10 rounded-xl shadow-md" style={{ background: c.hex }} />
                {color === c.id && (
                  <div className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--foreground)]">
                    <Check className="h-3 w-3 text-[var(--background)]" />
                  </div>
                )}
                <span className="text-[9px] font-bold text-[var(--muted-foreground)]">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 4. Layout ─── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-emerald-500 to-green-600 text-white flex items-center gap-2">
          <Layout className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">شكل المنيو</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-4">اختاري التصميم المناسب لصفحة الخدمات العامة</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {LAYOUTS.map(l => (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all hover:scale-[1.03]',
                  layout === l.id
                    ? 'border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] shadow-lg'
                    : 'border-[var(--border)] hover:border-[var(--muted-foreground)]',
                )}
              >
                <span className="text-3xl">{l.icon}</span>
                <span className="text-sm font-bold text-[var(--foreground)]">{l.label}</span>
                <span className="text-[10px] text-[var(--muted-foreground)] text-center leading-tight">{l.desc}</span>
                {layout === l.id && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)]">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 5. Welcome Message ─── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-pink-500 to-rose-600 text-white flex items-center gap-2">
          <MessageCircle className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">رسالة الترحيب</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-[var(--muted-foreground)]">تظهر في أعلى صفحة المنيو للعملاء</p>
          <textarea
            value={welcome}
            onChange={e => setWelcome(e.target.value)}
            placeholder="أهلاً وسهلاً بكِ في صالوننا 💜"
            rows={3}
            maxLength={300}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-primary)] outline-none resize-none"
          />
          <div className="text-end text-[10px] text-[var(--muted-foreground)]">{welcome.length}/300</div>
        </div>
      </div>

      {/* ─── 6. Google Maps ─── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-red-500 to-rose-600 text-white flex items-center gap-2">
          <MapPin className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">الموقع على الخريطة</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-[var(--muted-foreground)]">يظهر زر الموقع في صفحة المنيو ليسهل وصول العملاء</p>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-[var(--muted-foreground)]">رابط خرائط جوجل</label>
            <input
              value={mapsUrl}
              onChange={e => setMapsUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
              dir="ltr"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-primary)] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-[var(--muted-foreground)]">معرّف المكان (Place ID) — اختياري</label>
            <input
              value={placeId}
              onChange={e => setPlaceId(e.target.value)}
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
              dir="ltr"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-primary)] outline-none"
            />
          </div>
        </div>
      </div>

      {/* ─── Preview ─── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-gray-600 to-gray-800 text-white flex items-center gap-2">
          <Eye className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">معاينة</span>
        </div>
        <div className="p-5">
          <div className={cn(
            'relative rounded-2xl overflow-hidden border border-[var(--border)] min-h-[200px]',
            layout === 'elegant' ? 'bg-gray-900' : 'bg-white',
          )}>
            {/* Cover preview */}
            <div className="h-24 w-full opacity-30" style={{ background: COLORS.find(c => c.id === color)?.hex ?? '#7C3AED' }} />
            
            {/* Content preview */}
            <div className="p-4 text-center -mt-6 relative z-10">
              {data?.logoUrl ? (
                <img src={data.logoUrl} alt="" className="mx-auto h-16 w-16 rounded-2xl border-4 border-white shadow-lg object-contain bg-white" />
              ) : (
                <div
                  className="mx-auto h-16 w-16 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center"
                  style={{ background: COLORS.find(c => c.id === color)?.hex ?? '#7C3AED' }}
                >
                  <span className="text-white text-xl font-black">S</span>
                </div>
              )}
              
              <h3 className={cn(
                'text-sm font-black mt-3',
                layout === 'elegant' ? 'text-white' : 'text-gray-900',
              )}>
                اسم الصالون
              </h3>
              
              {welcome && (
                <p className={cn(
                  'text-[10px] mt-1',
                  layout === 'elegant' ? 'text-gray-300' : 'text-gray-500',
                )}>
                  {welcome}
                </p>
              )}
              
              {/* Mini service cards */}
              <div className="flex justify-center gap-2 mt-4">
                {['قص شعر', 'صبغة', 'مكياج'].map(s => (
                  <div
                    key={s}
                    className={cn(
                      'rounded-xl px-3 py-2 text-[9px] font-bold border',
                      layout === 'elegant'
                        ? 'bg-gray-800 border-gray-700 text-gray-200'
                        : 'bg-gray-50 border-gray-200 text-gray-700',
                    )}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-[var(--muted-foreground)] mt-2">هذه معاينة تقريبية — الشكل النهائي يختلف على هواتف العملاء</p>
        </div>
      </div>

      {/* ─── Save Button ─── */}
      <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !hasChanges} className="w-full py-3">
        {saveMut.isPending ? 'جارٍ الحفظ...' : hasChanges ? '💾 حفظ التغييرات' : '✅ محفوظ'}
      </Button>

      {/* ─── QR Modal ─── */}
      <MenuQRModal
        isOpen={qrOpen}
        onClose={() => setQrOpen(false)}
        slug={currentTenant?.slug || ''}
        salonName={currentTenant?.nameAr}
      />
    </div>
  );
}
