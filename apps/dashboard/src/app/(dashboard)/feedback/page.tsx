'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star, TrendingUp, TrendingDown, ExternalLink,
  ThumbsUp, MousePointerClick, Calendar, Filter,
  BarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService, type FeedbackItem, type FeedbackSummary } from '@/services/dashboard.service';
import { toast } from 'sonner';

/* ─── Constants ─── */
const STAR_FILTERS = [
  { label: 'الكل', value: 0 },
  { label: '⭐ 5', value: 5 },
  { label: '⭐ 4', value: 4 },
  { label: '⭐ 3', value: 3 },
  { label: '⭐ 2', value: 2 },
  { label: '⭐ 1', value: 1 },
];

const STATUS_OPTIONS = [
  { label: 'الكل', value: '' },
  { label: 'جديد', value: 'new' },
  { label: 'تمت المراجعة', value: 'reviewed' },
  { label: 'تم التواصل', value: 'contacted' },
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'جديد', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  reviewed: { label: 'تمت المراجعة', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  contacted: { label: 'تم التواصل', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

function ratingColor(r: number): string {
  if (r >= 4) return 'text-emerald-500';
  if (r === 3) return 'text-amber-500';
  return 'text-red-500';
}

function MiniStars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          fill={i <= rating ? '#FACC15' : 'transparent'}
          stroke={i <= rating ? '#FACC15' : 'var(--border)'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function FeedbackPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [page, setPage] = useState(1);
  const [starFilter, setStarFilter] = useState(0); // 0 = all
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['feedback-summary'],
    queryFn: () => dashboardService.getFeedbackSummary(accessToken!),
    enabled: !!accessToken,
  });

  // Fetch list 
  const { data: feedbackData, isLoading: listLoading } = useQuery({
    queryKey: ['feedbacks', page, starFilter, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      dashboardService.getFeedbacks(
        {
          page,
          limit: 15,
          ...(starFilter > 0 ? { minRating: starFilter, maxRating: starFilter } : {}),
          ...(statusFilter ? { followUpStatus: statusFilter } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        },
        accessToken!,
      ),
    enabled: !!accessToken,
  });

  // Update follow-up mutation 
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      dashboardService.updateFeedbackStatus(id, status, accessToken!),
    onSuccess: () => {
      toast.success('تم تحديث حالة المتابعة ✅');
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const feedbacks = feedbackData?.items ?? [];
  const totalPages = feedbackData?.totalPages ?? 1;

  // Loading
  if (summaryLoading && listLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Compute month change percent
  const monthChangePercent = summary && summary.lastMonthCount > 0
    ? Math.round(((summary.thisMonthCount - summary.lastMonthCount) / summary.lastMonthCount) * 100)
    : summary?.thisMonthCount ? 100 : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* ═══ Hero Header ═══ */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Star className="h-6 w-6 text-white/80" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">تقييمات العملاء</h1>
              <p className="text-sm text-white/40 mt-0.5">آراء العملاء وملاحظاتهم</p>
            </div>
          </div>

          {/* KPIs */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><Star className="h-3 w-3 text-white/50" /></div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">متوسط التقييم</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white tabular-nums">{summary.avgRating}</span>
                  <span className="text-xs text-white/30">/ 5</span>
                </div>
                <div className="mt-1.5"><MiniStars rating={Math.round(summary.avgRating)} size={12} /></div>
              </div>
              <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><Calendar className="h-3 w-3 text-white/50" /></div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">تقييمات الشهر</span>
                </div>
                <p className="text-2xl font-black text-white tabular-nums">{summary.thisMonthCount}</p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-white/30">
                  {monthChangePercent > 0 ? <><TrendingUp className="h-3 w-3" /><span className="font-bold">↑{monthChangePercent}%</span></> : monthChangePercent < 0 ? <><TrendingDown className="h-3 w-3" /><span className="font-bold">↓{Math.abs(monthChangePercent)}%</span></> : <span>—</span>}
                </div>
              </div>
              <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><ThumbsUp className="h-3 w-3 text-white/50" /></div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">نسبة الرضا</span>
                </div>
                <p className="text-2xl font-black text-white tabular-nums">{summary.satisfactionRate}%</p>
                <p className="text-[10px] text-white/20 mt-1">تقييمات 4-5 نجوم</p>
              </div>
              <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><MousePointerClick className="h-3 w-3 text-white/50" /></div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">نقرات Google</span>
                </div>
                <p className="text-2xl font-black text-white tabular-nums">{summary.googleClickRate}%</p>
                <p className="text-[10px] text-white/20 mt-1">{summary.googleClickTotal} من {summary.googlePromptTotal} عُرض عليهم</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Star Distribution ═══ */}
      {summary && summary.totalCount > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center"><BarChart className="h-4 w-4 text-amber-600" /></div>
            <span className="text-sm font-bold">توزيع النجوم</span>
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[star] || 0;
              const pct = summary.totalCount > 0 ? Math.round((count / summary.totalCount) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs font-bold w-4 tabular-nums text-[var(--muted-foreground)]">{star}</span>
                  <Star size={12} fill="#FACC15" stroke="#FACC15" />
                  <div className="flex-1 h-3 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: star >= 4 ? '#10B981' : star === 3 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums w-10 text-end text-[var(--muted-foreground)]">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Filters ═══ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--muted-foreground)]">
          <Filter className="h-4 w-4" />
          <span>الفلاتر</span>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Star filter */}
          <div className="flex items-center gap-1 rounded-xl bg-[var(--muted)] p-1">
            {STAR_FILTERS.map((sf) => (
              <button
                key={sf.value}
                onClick={() => { setStarFilter(sf.value); setPage(1); }}
                className={cn(
                  'rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300',
                  starFilter === sf.value
                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-md'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                )}
              >
                {sf.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] outline-none"
            title="من تاريخ"
          />

          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] outline-none"
            title="إلى تاريخ"
          />

          {/* Reset */}
          {(starFilter || statusFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setStarFilter(0); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
              className="text-xs font-bold text-[var(--brand-primary)] hover:underline"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* ═══ Feedback Table ═══ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {listLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
              <Star className="h-10 w-10 text-[var(--muted-foreground)] opacity-30" />
            </div>
            <p className="font-bold text-lg">لا توجد تقييمات</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">سيظهر هنا تقييمات العملاء بعد زيارتهم</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                    <th className="px-4 py-3 text-start font-bold text-[var(--muted-foreground)] text-xs">التاريخ</th>
                    <th className="px-4 py-3 text-start font-bold text-[var(--muted-foreground)] text-xs">النجوم</th>
                    <th className="px-4 py-3 text-start font-bold text-[var(--muted-foreground)] text-xs">التعليق</th>
                    <th className="px-4 py-3 text-start font-bold text-[var(--muted-foreground)] text-xs">رقم الفاتورة</th>
                    <th className="px-4 py-3 text-start font-bold text-[var(--muted-foreground)] text-xs">المصدر</th>
                    <th className="px-4 py-3 text-start font-bold text-[var(--muted-foreground)] text-xs">Google</th>
                    <th className="px-4 py-3 text-start font-bold text-[var(--muted-foreground)] text-xs">المتابعة</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map((fb) => (
                    <FeedbackRow key={fb.id} fb={fb} onStatusChange={(status) => updateStatus.mutate({ id: fb.id, status })} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[var(--border)]">
              {feedbacks.map((fb) => (
                <FeedbackCard key={fb.id} fb={fb} onStatusChange={(status) => updateStatus.mutate({ id: fb.id, status })} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ═══ Pagination ═══ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-bold disabled:opacity-30 hover:bg-[var(--muted)] transition"
          >
            السابق
          </button>
          <span className="text-xs font-bold text-[var(--muted-foreground)] tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-bold disabled:opacity-30 hover:bg-[var(--muted)] transition"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══ Desktop Row ═══ */
function FeedbackRow({ fb, onStatusChange }: { fb: FeedbackItem; onStatusChange: (s: string) => void }) {
  const googleBadge = fb.googleClicked
    ? { label: 'تم النقر', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : fb.googlePromptShown
    ? { label: 'عُرضت', style: 'bg-amber-50 text-amber-700 border-amber-200' }
    : { label: 'لم تُعرض', style: 'bg-slate-50 text-slate-500 border-slate-200' };

  return (
    <tr className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)]/20 transition-colors">
      <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] tabular-nums whitespace-nowrap">
        {formatDate(fb.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <MiniStars rating={fb.rating} size={12} />
          <span className={cn('text-xs font-black', ratingColor(fb.rating))}>{fb.rating}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs max-w-[200px] truncate" title={fb.comment || undefined}>
        {fb.comment || <span className="text-[var(--muted-foreground)] opacity-40">—</span>}
      </td>
      <td className="px-4 py-3">
        {fb.invoice?.invoiceNumber ? (
          <a
            href={`/invoices/${fb.invoiceId}`}
            className="text-xs font-mono font-bold text-[var(--brand-primary)] tabular-nums hover:underline"
          >
            {fb.invoice.invoiceNumber}
          </a>
        ) : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold',
          fb.source === 'self_order' || fb.invoice?.selfOrderId
            ? 'bg-violet-50 text-violet-700 border-violet-200'
            : 'bg-sky-50 text-sky-700 border-sky-200',
        )}>
          {fb.source === 'self_order' || fb.invoice?.selfOrderId ? '📱 طلب ذاتي' : '🖥️ كاشيرة'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold',
          googleBadge.style,
        )}>
          <span className="text-xs">{fb.googleClicked ? '●' : fb.googlePromptShown ? '◐' : '○'}</span>
          {googleBadge.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <select
          value={fb.followUpStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className={cn(
            'rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer',
            STATUS_STYLES[fb.followUpStatus]?.bg || 'bg-slate-50',
            STATUS_STYLES[fb.followUpStatus]?.color || 'text-slate-600',
          )}
        >
          <option value="new">جديد</option>
          <option value="reviewed">تمت المراجعة</option>
          <option value="contacted">تم التواصل</option>
        </select>
      </td>
    </tr>
  );
}

/* ═══ Mobile Card ═══ */
function FeedbackCard({ fb, onStatusChange }: { fb: FeedbackItem; onStatusChange: (s: string) => void }) {
  const googleBadge = fb.googleClicked
    ? { label: 'تم النقر', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : fb.googlePromptShown
    ? { label: 'عُرضت', style: 'bg-amber-50 text-amber-700 border-amber-200' }
    : { label: 'لم تُعرض', style: 'bg-slate-50 text-slate-500 border-slate-200' };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <MiniStars rating={fb.rating} size={14} />
          <span className={cn('text-sm font-black', ratingColor(fb.rating))}>{fb.rating}/5</span>
        </div>
        <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums">{formatDate(fb.createdAt)}</span>
      </div>

      {fb.comment && (
        <p className="text-xs text-[var(--foreground)] bg-[var(--muted)] rounded-xl px-3 py-2">
          {fb.comment}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {fb.invoice?.invoiceNumber && (
          <a href={`/invoices/${fb.invoiceId}`} className="text-[10px] font-mono font-bold text-[var(--brand-primary)] hover:underline">
            #{fb.invoice.invoiceNumber}
          </a>
        )}
        <span className={cn(
          'inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold',
          fb.source === 'self_order' || fb.invoice?.selfOrderId
            ? 'bg-violet-50 text-violet-700 border-violet-200'
            : 'bg-sky-50 text-sky-700 border-sky-200',
        )}>
          {fb.source === 'self_order' || fb.invoice?.selfOrderId ? '📱 طلب ذاتي' : '🖥️ كاشيرة'}
        </span>
        <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold', googleBadge.style)}>
          <span>{fb.googleClicked ? '●' : fb.googlePromptShown ? '◐' : '○'}</span>
          {googleBadge.label}
        </span>
      </div>

      <select
        value={fb.followUpStatus}
        onChange={(e) => onStatusChange(e.target.value)}
        className={cn(
          'w-full rounded-xl border px-3 py-2 text-xs font-bold outline-none',
          STATUS_STYLES[fb.followUpStatus]?.bg || 'bg-slate-50',
          STATUS_STYLES[fb.followUpStatus]?.color || 'text-slate-600',
        )}
      >
        <option value="new">جديد</option>
        <option value="reviewed">تمت المراجعة</option>
        <option value="contacted">تم التواصل</option>
      </select>
    </div>
  );
}
