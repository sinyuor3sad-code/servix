'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Gift, Heart, Repeat, Star, Sparkles, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Spinner, Switch, Input, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  loyaltyService,
  type LoyaltyMode,
  type LoyaltySettings,
} from '@/services/loyalty.service';

const MODE_OPTIONS: Array<{
  value: LoyaltyMode;
  title: string;
  desc: string;
  icon: typeof Star;
  accent: string;
}> = [
  {
    value: 'points',
    title: 'النقاط',
    desc: 'اكسبي نقاط من كل عملية شراء واستبدليها بخصومات',
    icon: Star,
    accent: 'from-amber-500 to-orange-600',
  },
  {
    value: 'visits',
    title: 'الزيارات',
    desc: 'دورة زيارات محددة → مكافأة أو خصم مجاني',
    icon: Repeat,
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    value: 'both',
    title: 'النقاط + الزيارات',
    desc: 'نظام مزدوج يعمل بالطريقتين معاً',
    icon: Sparkles,
    accent: 'from-violet-500 to-purple-600',
  },
];

export default function LoyaltySettingsPage(): React.ReactElement {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<LoyaltySettings>({
    queryKey: ['loyalty', 'settings'],
    queryFn: () => loyaltyService.getSettings(accessToken!),
    enabled: !!accessToken,
  });

  const mutation = useMutation({
    mutationFn: (payload: Partial<LoyaltySettings>) =>
      loyaltyService.updateSettings(accessToken!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty', 'settings'] });
      toast.success('تم الحفظ');
    },
    onError: () => toast.error('فشل الحفظ'),
  });

  const [draft, setDraft] = useState<LoyaltySettings | null>(null);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (isLoading || !draft) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const showPoints = draft.loyaltyMode === 'points' || draft.loyaltyMode === 'both';
  const showVisits = draft.loyaltyMode === 'visits' || draft.loyaltyMode === 'both';

  const save = (patch: Partial<LoyaltySettings>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    mutation.mutate(patch);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/settings')}
          className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">الولاء</h1>
          <p className="text-xs text-[var(--muted-foreground)]">تخصيص نظام النقاط والزيارات</p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">تفعيل نظام الولاء</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              عند إيقافه لا يتم احتساب نقاط أو زيارات جديدة
            </p>
          </div>
        </div>
        <Switch
          checked={draft.loyaltyEnabled}
          onCheckedChange={(c) => save({ loyaltyEnabled: c })}
          disabled={mutation.isPending}
        />
      </div>

      {/* Mode selector */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold">نمط الولاء</h3>
          <p className="text-[11px] text-[var(--muted-foreground)]">اختاري كيف تكافئي عميلاتك</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = draft.loyaltyMode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => save({ loyaltyMode: opt.value })}
                disabled={mutation.isPending || !draft.loyaltyEnabled}
                className={cn(
                  'group text-right rounded-2xl border p-4 transition-all',
                  active
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-md'
                    : 'border-[var(--border)] hover:border-[var(--foreground)]/20 bg-[var(--card)]',
                  (!draft.loyaltyEnabled || mutation.isPending) && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-2xl flex items-center justify-center mb-3 bg-gradient-to-br',
                    opt.accent,
                  )}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-bold">{opt.title}</p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
                  {opt.desc}
                </p>
                {active && (
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--brand-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]" />
                    مفعّل
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Points config */}
      {showPoints && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Star className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold">إعدادات النقاط</h3>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  النقاط لكل ريال وقيمة الاسترداد
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[11px] font-bold">نقطة لكل ريال</span>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={draft.loyaltyPointsPerSar}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, loyaltyPointsPerSar: Number(e.target.value) } : d))
                }
                onBlur={(e) =>
                  save({ loyaltyPointsPerSar: Number(e.target.value) })
                }
                dir="ltr"
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">
                مثال: 1 = تحصل على نقطة واحدة عن كل ريال
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-bold">قيمة الاسترداد لكل نقطة (ريال)</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={draft.loyaltyRedemptionValue}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, loyaltyRedemptionValue: Number(e.target.value) } : d,
                  )
                }
                onBlur={(e) =>
                  save({ loyaltyRedemptionValue: Number(e.target.value) })
                }
                dir="ltr"
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">
                مثال: 0.1 = كل 10 نقاط = 1 ريال خصم
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Visits config */}
      {showVisits && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Repeat className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold">إعدادات الزيارات</h3>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  عدد الزيارات ومبلغ المكافأة
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[11px] font-bold">عدد الزيارات لكل مكافأة</span>
              <Input
                type="number"
                min={1}
                step={1}
                value={draft.loyaltyVisitsPerReward}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, loyaltyVisitsPerReward: Number(e.target.value) } : d,
                  )
                }
                onBlur={(e) =>
                  save({ loyaltyVisitsPerReward: Number(e.target.value) })
                }
                dir="ltr"
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">
                مثال: 10 = بعد 10 زيارات تحصل العميلة على المكافأة
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-bold">قيمة المكافأة (ريال)</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={draft.loyaltyVisitRewardValue}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, loyaltyVisitRewardValue: Number(e.target.value) } : d,
                  )
                }
                onBlur={(e) =>
                  save({ loyaltyVisitRewardValue: Number(e.target.value) })
                }
                dir="ltr"
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">
                مبلغ الخصم المجاني عند إتمام الدورة
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Preview */}
      {draft.loyaltyEnabled && (
        <div className="rounded-2xl bg-gradient-to-l from-rose-50 to-pink-50 border border-rose-200 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <Gift className="h-5 w-5 text-rose-600" />
            </div>
            <div className="text-right">
              <p className="font-bold text-rose-800 text-sm">مثال عملي</p>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                {showPoints && (
                  <>
                    فاتورة 200 ريال →{' '}
                    <b>
                      {Math.round(200 * (draft.loyaltyPointsPerSar || 0))} نقطة
                    </b>{' '}
                    (تعادل{' '}
                    {(
                      200 *
                      (draft.loyaltyPointsPerSar || 0) *
                      (draft.loyaltyRedemptionValue || 0)
                    ).toFixed(2)}{' '}
                    ريال خصم).
                  </>
                )}
                {showPoints && showVisits && <br />}
                {showVisits && (
                  <>
                    كل <b>{draft.loyaltyVisitsPerReward || 0} زيارة</b> تمنح
                    العميلة خصماً بقيمة{' '}
                    <b>{draft.loyaltyVisitRewardValue || 0} ريال</b>.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Link to leaderboard */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
            <Info className="h-5 w-5 text-[var(--muted-foreground)]" />
          </div>
          <div>
            <p className="text-sm font-bold">لوحة متصدرات الولاء</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              عرض أعلى العميلات نقاطاً وتاريخ المعاملات
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push('/loyalty')}>
          فتح
        </Button>
      </div>
    </div>
  );
}
