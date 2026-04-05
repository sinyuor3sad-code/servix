'use client';

import { useQuery } from '@tanstack/react-query';
import { Gift, Star, ArrowDownUp, Heart, Crown, Trophy, Phone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface LoyaltySettings { pointsPerSar: number; redemptionValue: number; minimumRedemption: number; }
interface LoyaltyClient { id: string; fullName: string; phone: string; points: number; totalEarned: number; totalRedeemed: number; }
interface LoyaltyData { settings: LoyaltySettings; leaderboard: LoyaltyClient[]; }

export default function LoyaltyPage() {
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery<LoyaltyData>({
    queryKey: ['loyalty'],
    queryFn: () => api.get<LoyaltyData>('/loyalty', accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
          <Heart className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)]">نظام الولاء</h1>
          <p className="text-sm text-[var(--muted-foreground)]">النقاط تتراكم تلقائياً مع كل عملية شراء</p>
        </div>
      </div>

      {!data ? (
        /* Empty State */
        <div className="text-center py-20">
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 animate-pulse" />
            <div className="absolute inset-2 rounded-2xl bg-[var(--card)] flex items-center justify-center border border-[var(--border)]">
              <Heart className="h-10 w-10 text-rose-400" />
            </div>
          </div>
          <p className="font-bold text-lg">لا توجد بيانات ولاء</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">ستظهر نقاط الولاء تلقائياً بعد أول عملية شراء من الكاشير</p>
          
          {/* How it works */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-right">
            {[
              { icon: '🛒', title: 'الشراء', desc: 'العميلة تشتري من الكاشير' },
              { icon: '⭐', title: 'النقاط', desc: 'تتراكم النقاط تلقائياً' },
              { icon: '🎁', title: 'الاستبدال', desc: 'تستبدل النقاط بخصومات' },
            ].map((step, i) => (
              <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <span className="text-2xl">{step.icon}</span>
                <p className="font-bold text-sm mt-2">{step.title}</p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Settings Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white">
              <Gift className="h-5 w-5 mb-2 opacity-60" />
              <p className="text-xs opacity-70">نقاط لكل ريال</p>
              <p className="text-3xl font-black mt-1">{data.settings.pointsPerSar}</p>
              <p className="text-[10px] opacity-50">نقطة / SAR</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
              <Star className="h-5 w-5 mb-2 opacity-60" />
              <p className="text-xs opacity-70">قيمة الاسترداد</p>
              <p className="text-3xl font-black mt-1 tabular-nums" dir="ltr">{data.settings.redemptionValue} <span className="text-base font-medium opacity-70">SAR</span></p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white">
              <ArrowDownUp className="h-5 w-5 mb-2 opacity-60" />
              <p className="text-xs opacity-70">الحد الأدنى للاسترداد</p>
              <p className="text-3xl font-black mt-1">{data.settings.minimumRedemption}</p>
              <p className="text-[10px] opacity-50">نقطة</p>
            </div>
          </div>

          {/* Leaderboard */}
          {data.leaderboard.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" /> لوحة المتصدرين
                </h3>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {data.leaderboard.map((client, i) => {
                  const maxPts = Math.max(...data.leaderboard.map(c => c.points), 1);
                  const pct = Math.round((client.points / maxPts) * 100);
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={client.id} className="p-5 hover:bg-[var(--muted)]/20 transition">
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center text-lg font-black flex-shrink-0">
                          {medals[i] || <span className="text-xs text-[var(--muted-foreground)]">{i + 1}</span>}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{client.fullName}</span>
                            {i === 0 && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 text-[var(--muted-foreground)]" />
                            <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">{client.phone}</span>
                          </div>
                        </div>
                        {/* Points */}
                        <div className="text-left flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-lg font-black text-[var(--brand-primary)] tabular-nums">{client.points.toLocaleString('en')}</span>
                          </div>
                          <p className="text-[10px] text-[var(--muted-foreground)]">نقطة</p>
                        </div>
                      </div>
                      {/* Points bar */}
                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-300" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-[var(--muted-foreground)] tabular-nums">
                          +{client.totalEarned.toLocaleString('en')} / -{client.totalRedeemed.toLocaleString('en')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info Card */}
          <div className="rounded-2xl bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Gift className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-emerald-800 text-sm">النقاط تلقائية 100%</p>
                <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
                  يتم إضافة النقاط تلقائياً عند كل عملية شراء من الكاشير. لا تحتاجين لأي إجراء يدوي — العميلات يجمعن النقاط ويستبدلنها بخصومات.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
