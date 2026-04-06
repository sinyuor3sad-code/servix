'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { BadgePercent, Plus, CheckCircle, XCircle, Copy, Loader2, X, Trash2 } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type PlatformCoupon } from '@/services/admin.service';

export default function CouponsPage(): ReactElement {
  const [coupons, setCoupons] = useState<PlatformCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'percentage' as 'percentage' | 'fixed' | 'free', value: 0, usageLimit: 100, validUntil: '' });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchCoupons = () => {
    setLoading(true);
    adminService.getCoupons()
      .then(res => setCoupons(res.data ?? []))
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCoupons(); }, []);

  const handleCreate = async () => {
    if (!form.code || !form.validUntil) return;
    setCreating(true);
    try {
      const newCoupon = await adminService.createCoupon({
        code: form.code.toUpperCase(),
        type: form.type,
        value: form.type === 'free' ? 100 : form.value,
        usageLimit: form.usageLimit,
        validUntil: form.validUntil,
      });
      setCoupons(prev => [newCoupon, ...prev]);
      setShowCreate(false);
      setForm({ code: '', type: 'percentage', value: 0, usageLimit: 100, validUntil: '' });
    } catch (e) {
      alert('فشل إنشاء الكوبون');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (coupon: PlatformCoupon) => {
    setToggling(coupon.id);
    try {
      const updated = await adminService.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      setCoupons(prev => prev.map(c => c.id === coupon.id ? updated : c));
    } catch { /* silent */ }
    setToggling(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return;
    try {
      await adminService.deleteCoupon(id);
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch { alert('فشل الحذف'); }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const typeLabel = (t: string) => t === 'percentage' ? 'نسبة' : t === 'fixed' ? 'ثابت' : 'مجاني';
  const discountDisplay = (c: PlatformCoupon) => {
    if (c.type === 'free') return '100%';
    if (c.type === 'percentage') return `${c.value}%`;
    return `${c.value} ر.س`;
  };

  return (
    <div className="space-y-5">
      <PageTitle title="الكوبونات" desc="إدارة كوبونات الخصم للاشتراكات">
        <button onClick={() => setShowCreate(true)}
          className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 text-[13px] font-bold text-black shadow-lg shadow-amber-500/20 hover:shadow-xl active:scale-[0.97]">
          <Plus size={16} strokeWidth={2.5} /> كوبون جديد
        </button>
      </PageTitle>

      <Glass className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-amber-400/60" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-16 text-center">
            <BadgePercent size={32} className="mx-auto mb-3 text-white/10" />
            <p className="text-[14px] font-bold text-white/30">لا توجد كوبونات</p>
            <p className="mt-1 text-[12px] text-white/15">اضغط &quot;كوبون جديد&quot; لإنشاء أول كوبون</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-white/[0.05]">
              {['الكود', 'الخصم', 'النوع', 'الاستخدام', 'صالح حتى', 'الحالة', ''].map((h, i) => (
                <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {coupons.map((c, i) => (
                <tr key={c.id} className={`group transition-colors hover:bg-white/[0.02] ${i < coupons.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-3 py-1 font-mono text-[12px] font-bold text-amber-400">
                      {c.code}
                      <button onClick={() => copyCode(c.code, c.id)} className="text-amber-400/40 hover:text-amber-400">
                        {copiedId === c.id ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-white/70">{discountDisplay(c)}</td>
                  <td className="px-5 py-3.5 text-white/40">{typeLabel(c.type)}</td>
                  <td className="px-5 py-3.5" style={TN}>
                    <span className="font-bold text-white/60">{c.usedCount}</span>
                    <span className="text-white/20"> / {c.usageLimit}</span>
                    <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-amber-400/40" style={{ width: `${Math.min(100, (c.usedCount / c.usageLimit) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-white/30" style={TN}>{new Date(c.validUntil).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => handleToggle(c)} disabled={toggling === c.id}>
                      {c.isActive
                        ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400"><CheckCircle size={12} />فعّال</span>
                        : <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-white/30"><XCircle size={12} />معطّل</span>
                      }
                    </button>
                  </td>
                  <td className="px-3 py-3.5">
                    <button onClick={() => handleDelete(c.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Glass>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0f14] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-white/80">كوبون جديد</h3>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 text-white/20 hover:bg-white/[0.05] hover:text-white/40"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-white/25">كود الكوبون</label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="مثال: RAMADAN30" dir="ltr"
                  className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 font-mono text-[13px] text-amber-400 placeholder:text-white/15 outline-none focus:border-amber-500/25" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-white/25">النوع</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as 'percentage' | 'fixed' | 'free' }))}
                    className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-[13px] text-white/70 outline-none focus:border-amber-500/25">
                    <option value="percentage">نسبة مئوية</option>
                    <option value="fixed">مبلغ ثابت</option>
                    <option value="free">مجاني</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-white/25">{form.type === 'percentage' ? 'النسبة %' : 'المبلغ (ر.س)'}</label>
                  <input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: +e.target.value }))}
                    disabled={form.type === 'free'}
                    className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[13px] text-white/70 outline-none focus:border-amber-500/25 disabled:opacity-30" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-white/25">حد الاستخدام</label>
                  <input type="number" value={form.usageLimit} onChange={e => setForm(p => ({ ...p, usageLimit: +e.target.value }))}
                    className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[13px] text-white/70 outline-none focus:border-amber-500/25" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-white/25">صالح حتى</label>
                  <input type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[13px] text-white/70 outline-none focus:border-amber-500/25" />
                </div>
              </div>
            </div>

            <button onClick={handleCreate} disabled={creating || !form.code || !form.validUntil}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-2.5 text-[13px] font-bold text-black shadow-lg shadow-amber-500/20 disabled:opacity-40">
              {creating ? <Loader2 size={16} className="mx-auto animate-spin" /> : 'إنشاء الكوبون'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
