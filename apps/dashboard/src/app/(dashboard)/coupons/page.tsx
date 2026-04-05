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
  id: string; code: string; type: 'percentage' | 'fixed_amount'; value: number;
  minOrderAmount: number; maxUses: number; currentUses: number;
  startDate: string; endDate: string; isActive: boolean;
}

type CStatus = 'active' | 'expired' | 'disabled';
function getCouponStatus(c: Coupon): CStatus {
  if (!c.isActive) return 'disabled';
  if (new Date(c.endDate) < new Date()) return 'expired';
  return 'active';
}

const STATUS_STYLE: Record<CStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'نشط', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  expired: { label: 'منتهي', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  disabled: { label: 'معطّل', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)]">الكوبونات</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">إدارة أكواد الخصم والعروض</p>
        </div>
        <Link href="/coupons/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> إضافة كوبون</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 p-4 text-white">
          <Tag className="h-5 w-5 mb-2 opacity-60" />
          <div className="text-2xl font-black">{coupons.length}</div>
          <p className="text-[11px] opacity-70">إجمالي الكوبونات</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
          <CheckCircle2 className="h-5 w-5 mb-2 opacity-60" />
          <div className="text-2xl font-black">{coupons.filter(c => getCouponStatus(c) === 'active').length}</div>
          <p className="text-[11px] opacity-70">نشطة</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white hidden sm:block">
          <Users className="h-5 w-5 mb-2 opacity-60" />
          <div className="text-2xl font-black">{coupons.reduce((s, c) => s + c.currentUses, 0)}</div>
          <p className="text-[11px] opacity-70">مرات الاستخدام</p>
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
            const usagePct = coupon.maxUses > 0 ? Math.round((coupon.currentUses / coupon.maxUses) * 100) : 0;

            return (
              <div key={coupon.id} className={cn('rounded-2xl border bg-[var(--card)] overflow-hidden transition-all hover:shadow-md', st === 'disabled' && 'opacity-50')}>
                {/* Coupon Header - Ticket Style */}
                <div className={cn('relative p-5', isPercent ? 'bg-gradient-to-l from-fuchsia-500 to-pink-600' : 'bg-gradient-to-l from-violet-500 to-purple-600')}>
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {isPercent ? <Percent className="h-4 w-4 opacity-70" /> : <DollarSign className="h-4 w-4 opacity-70" />}
                        <span className="text-xs font-bold opacity-70">{isPercent ? 'خصم نسبي' : 'خصم ثابت'}</span>
                      </div>
                      <div className="text-3xl font-black tabular-nums" dir="ltr">
                        {isPercent ? `${coupon.value}%` : `${coupon.value} SAR`}
                      </div>
                    </div>
                    <span className={cn('px-2.5 py-1 rounded-lg border text-[10px] font-bold', style.bg, style.color)}>
                      {style.label}
                    </span>
                  </div>
                  {/* Dashed divider - ticket effect */}
                  <div className="absolute bottom-0 left-0 right-0 border-b-2 border-dashed border-white/20" />
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
                      <span className="font-bold tabular-nums">{coupon.currentUses} / {coupon.maxUses}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-primary)]/50" style={{ width: `${usagePct}%` }} />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                    <Clock className="h-3 w-3" />
                    <span dir="ltr" className="tabular-nums">{new Date(coupon.startDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })} → {new Date(coupon.endDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
