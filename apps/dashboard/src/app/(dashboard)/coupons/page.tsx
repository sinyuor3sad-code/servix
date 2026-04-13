'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Percent, DollarSign, Tag, Clock, Users, Ticket, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { PaginatedResponse } from '@/types';
import { toast } from 'sonner';

interface Coupon {
  id: string; code: string; type: 'percentage' | 'fixed'; value: number;
  minOrder: number; usageLimit: number; usedCount: number;
  validFrom: string; validUntil: string; isActive: boolean;
}

type CStatus = 'active' | 'expired' | 'disabled';
function getCouponStatus(c: Coupon): CStatus {
  if (!c.isActive) return 'disabled';
  if (new Date(c.validUntil) < new Date()) return 'expired';
  return 'active';
}

const STATUS_STYLE: Record<CStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'نشط', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  expired: { label: 'منتهي', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  disabled: { label: 'معطّل', color: 'text-[var(--muted-foreground)]', bg: 'bg-[var(--muted)] border-[var(--border)]' },
};

export default function CouponsPage() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['coupons', page],
    queryFn: () => api.get<PaginatedResponse<Coupon>>(`/coupons?page=${page}&limit=10`, accessToken!),
    enabled: !!accessToken,
  });

  const coupons = data?.items ?? [];

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    toast.success('تم نسخ الكود');
    setTimeout(() => setCopied(''), 2000);
  };

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-fuchsia-500/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <Tag className="h-6 w-6 text-white/80" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">الكوبونات</h1>
                <p className="text-xs text-white/40 mt-0.5">إدارة أكواد الخصم والعروض</p>
              </div>
            </div>
            <Link href="/coupons/new">
              <Button size="sm" className="gap-1.5 bg-white/10 border border-white/20 text-white hover:bg-white/20"><Plus className="h-3.5 w-3.5" /> إضافة كوبون</Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
            <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><Tag className="h-3 w-3 text-white/50" /></div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">إجمالي الكوبونات</span>
              </div>
              <p className="text-2xl font-black text-white tabular-nums">{coupons.length}</p>
            </div>
            <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><CheckCircle2 className="h-3 w-3 text-white/50" /></div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">نشطة</span>
              </div>
              <p className="text-2xl font-black text-white tabular-nums">{coupons.filter(c => getCouponStatus(c) === 'active').length}</p>
            </div>
            <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08] hidden sm:block">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><Users className="h-3 w-3 text-white/50" /></div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">مرات الاستخدام</span>
              </div>
              <p className="text-2xl font-black text-white tabular-nums">{coupons.reduce((s, c) => s + c.usedCount, 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coupon Cards */}
      {coupons.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Ticket className="h-10 w-10 text-[var(--muted-foreground)] opacity-30" />
          </div>
          <p className="font-bold text-lg">لا توجد كوبونات</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">أنشئي كوبون خصم جديد</p>
          <Link href="/coupons/new"><Button className="mt-4"><Plus className="h-4 w-4" /> إضافة كوبون</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coupons.map(coupon => {
            const st = getCouponStatus(coupon);
            const style = STATUS_STYLE[st];
            const isPercent = coupon.type === 'percentage';
            const usagePct = coupon.usageLimit && coupon.usageLimit > 0 ? Math.round((coupon.usedCount / coupon.usageLimit) * 100) : 0;

            return (
              <div key={coupon.id} className={cn('rounded-2xl border bg-[var(--card)] overflow-hidden transition-all hover:shadow-md', st === 'disabled' && 'opacity-50')}>
                {/* Coupon Header - Clean Ticket Style */}
                <div className="relative p-5 border-b border-[var(--border)] bg-[var(--muted)]/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', isPercent ? 'bg-fuchsia-500/10 text-fuchsia-600' : 'bg-violet-500/10 text-violet-600')}>
                          {isPercent ? <Percent className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                        </div>
                        <span className="text-[10px] font-bold text-[var(--muted-foreground)]">{isPercent ? 'خصم نسبي' : 'خصم ثابت'}</span>
                      </div>
                      <div className="text-2xl font-black tabular-nums text-[var(--foreground)]" dir="ltr">
                        {isPercent ? `${coupon.value}%` : `${coupon.value} SAR`}
                      </div>
                    </div>
                    <span className={cn('px-2.5 py-1 rounded-lg border text-[10px] font-bold', style.bg, style.color)}>
                      {style.label}
                    </span>
                  </div>
                </div>

                {/* Coupon Body */}
                <div className="p-4 space-y-3">
                  {/* Code */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-[var(--muted)] rounded-xl px-3 py-2 flex-1">
                      <span className="font-mono text-sm font-black tracking-wider text-[var(--brand-primary)]">{coupon.code}</span>
                    </div>
                    <button onClick={() => copyCode(coupon.code)}
                      className="mr-2 p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
                      {copied === coupon.code ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-[var(--muted-foreground)]" />}
                    </button>
                  </div>

                  {/* Usage progress */}
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-[var(--muted-foreground)]">الاستخدام</span>
                      <span className="font-bold tabular-nums">{coupon.usedCount} / {coupon.usageLimit ?? '∞'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-primary)]/50" style={{ width: `${usagePct}%` }} />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                    <Clock className="h-3 w-3" />
                    <span dir="ltr" className="tabular-nums">{new Date(coupon.validFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(coupon.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
