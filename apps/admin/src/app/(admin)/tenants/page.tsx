'use client';

import { useState, useEffect, type ReactElement, type ReactNode } from 'react';
import {
  Search, Plus, ChevronLeft, ChevronRight,
  Eye, LogIn, Ban, Trash2, Building2, Users,
  CalendarCheck, DollarSign, MoreHorizontal,
  X, MapPin, Crown, Sparkles, Shield, CreditCard,
} from 'lucide-react';
import { adminService, type Tenant as ApiTenant } from '@/services/admin.service';

/* ═══════════════════════════════════════════════════════════════ */

type Status = 'active' | 'suspended' | 'pending';

const ST: Record<string, { label: string; dot: string; cls: string }> = {
  active:    { label: 'نشط',  dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  suspended: { label: 'معلّق', dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]',    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  pending:   { label: 'بانتظار', dot: 'bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.6)]', cls: 'bg-violet-500/8 text-violet-400 border-violet-500/15' },
};

const TN = { fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums' as const };

/* ── Glass wrapper ── */
function G({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.07] shadow-[0_4px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 100%)', backdropFilter: 'blur(40px) saturate(130%)' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

/* ── Action dropdown ── */
function Actions({ t, onStatusChange }: { t: ApiTenant; onStatusChange: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const items: ({ icon: React.ElementType; label: string; cls: string; action?: () => void } | null)[] = [
    { icon: Eye, label: 'عرض التفاصيل', cls: 'text-white/60 hover:text-white' },
    null,
    t.status === 'active'
      ? { icon: Ban, label: 'تعليق', cls: 'text-amber-400/70 hover:text-amber-400', action: () => onStatusChange(t.id, 'suspended') }
      : { icon: Eye, label: 'تفعيل', cls: 'text-emerald-400/70 hover:text-emerald-400', action: () => onStatusChange(t.id, 'active') },
  ];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 transition-all hover:bg-white/[0.06] hover:text-white/60">
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute left-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-2xl border border-white/[0.08] p-1.5 shadow-2xl" style={{ background: 'rgba(12,12,18,0.96)', backdropFilter: 'blur(40px)' }}>
            {items.map((item, i) => item === null
              ? <div key={i} className="mx-2 my-1 border-t border-white/[0.05]" />
              : <button key={item.label} onClick={() => { item.action?.(); close(); }} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-white/[0.04] ${item.cls}`}>
                  <item.icon size={15} /> {item.label}
                </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function TenantsPage(): ReactElement {
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [page, setPage] = useState(1);
  const PER = 10;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('perPage', PER.toString());
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    adminService.getTenants(params.toString())
      .then((res) => {
        setTenants(res.items ?? []);
        setTotal(res.meta?.total ?? 0);
      })
      .catch(() => {
        setTenants([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, search, status]);

  const pages = Math.max(1, Math.ceil(total / PER));

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await adminService.updateTenantStatus(id, newStatus);
      setTenants((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus as ApiTenant['status'] } : t));
    } catch {
      // silently fail
    }
  };

  const Sel = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) => (
    <select value={value} onChange={(e) => { onChange(e.target.value); setPage(1); }}
      className="h-10 appearance-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[13px] text-white/55 outline-none transition-all focus:border-amber-500/25 hover:border-white/[0.14] hover:bg-white/[0.05]">
      {children}
    </select>
  );

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-amber-500/10 bg-gradient-to-br from-amber-500/15 to-amber-600/5">
            <Building2 size={22} className="text-amber-400" strokeWidth={1.7} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">إدارة الصالونات</h1>
            <p className="text-[13px] text-white/30">
              {loading ? 'جاري التحميل...' : `${total} صالون مسجل في المنصة`}
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <G>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث بالاسم أو الهاتف..."
              className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pr-10 pl-4 text-[13px] text-white/80 placeholder:text-white/15 outline-none transition-all focus:border-amber-500/25 hover:border-white/[0.14]" />
          </div>
          <Sel value={status} onChange={(v) => setStatus(v as Status | '')}>
            <option value="">جميع الحالات</option>
            <option value="active">نشطة</option>
            <option value="suspended">معلّقة</option>
            <option value="pending">بانتظار</option>
          </Sel>
          {(search || status) && (
            <button onClick={() => { setSearch(''); setStatus(''); setPage(1); }} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/15 bg-amber-500/8 px-3.5 py-2.5 text-[11px] font-bold text-amber-400 hover:bg-amber-500/15">
              <X size={12} /> مسح
            </button>
          )}
          <span className="mr-auto text-[12px] text-white/15">{total} نتيجة</span>
        </div>
      </G>

      {/* ── TABLE ── */}
      <G className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['الصالون', 'المدينة', 'الهاتف', 'الحالة', 'تاريخ التسجيل', ''].map((h, i) => (
                  <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-24 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                  <p className="mt-3 text-[13px] text-white/30">جاري تحميل البيانات...</p>
                </td></tr>
              ) : tenants.length === 0 ? (
                <tr><td colSpan={6} className="py-24 text-center">
                  <Building2 size={32} className="mx-auto mb-3 text-white/8" />
                  <p className="text-lg font-bold text-white/30">لا توجد صالونات مسجلة</p>
                  <p className="mt-1 text-sm text-white/15">ستظهر هنا عند تسجيل أول صالون</p>
                </td></tr>
              ) : tenants.map((t, idx) => {
                const stInfo = ST[t.status] ?? ST.pending;
                return (
                  <tr key={t.id} className={`group transition-colors hover:bg-white/[0.02] ${idx < tenants.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                    <td className="px-5 py-[14px]">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-[15px] font-bold text-white/30 transition-all group-hover:border-amber-500/15 group-hover:text-amber-400/50">
                          {(t.nameAr || t.nameEn || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-white/80 group-hover:text-white">{t.nameAr || t.nameEn}</p>
                          <p className="mt-0.5 text-[11px] text-white/20">{t.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-[14px]">
                      <span className="flex items-center gap-1 text-[13px] text-white/40"><MapPin size={12} className="text-white/15" />{t.city || '—'}</span>
                    </td>
                    <td className="px-5 py-[14px] text-[13px] text-white/40" style={TN}>{t.phone || '—'}</td>
                    <td className="px-5 py-[14px]">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${stInfo.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${stInfo.dot}`} />{stInfo.label}
                      </span>
                    </td>
                    <td className="px-5 py-[14px] text-[12px] text-white/25" style={TN}>
                      {new Date(t.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-[14px]"><Actions t={t} onStatusChange={handleStatusChange} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.04] px-6 py-4">
            <span className="text-[12px] text-white/15" style={TN}>صفحة {page} من {pages} · {total} صالون</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/25 hover:bg-white/[0.04] disabled:opacity-20"><ChevronRight size={16} /></button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-bold transition-all ${page === p ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 shadow-[0_0_12px_rgba(234,179,8,0.08)]' : 'text-white/25 hover:bg-white/[0.04]'}`}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/25 hover:bg-white/[0.04] disabled:opacity-20"><ChevronLeft size={16} /></button>
            </div>
          </div>
        )}
      </G>
    </div>
  );
}
