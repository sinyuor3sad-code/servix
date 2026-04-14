/**
 * SalonPage — app/[slug]/page.tsx  (Server Component)
 *
 * Public booking profile for a salon. Fully theme-aware via CSS variables.
 * Supports 5 layout variants: luxe, bloom, glamour, golden, banan.
 *
 * Sections:
 *  1. BookingHero     — cover/logo/name/CTA
 *  2. ServicesSection — layout-aware interactive service grid (Client Component)
 *  3. WorkingHours    — weekly schedule card
 *  4. SalonFooter     — brand + social + "powered by"
 */

import type { ReactElement } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock } from 'lucide-react';
import { bookingApi, type SalonInfo, type ServiceCategory } from '@/lib/api';
import { resolveTheme } from '@/lib/themes';
import BookingHero from '@/components/booking-hero';
import ServicesSection from '@/components/services-section';
import SalonFooter  from '@/components/salon-footer';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ slug: string }>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_ORDER = [
  'saturday', 'sunday', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday',
] as const;

const DAYS_AR: Record<string, string> = {
  saturday: 'السبت', sunday: 'الأحد', monday: 'الاثنين',
  tuesday: 'الثلاثاء', wednesday: 'الأربعاء',
  thursday: 'الخميس', friday: 'الجمعة',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentDay(): string {
  const map = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return map[new Date().getDay()];
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

// ── SEO metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const salon = await bookingApi.getSalonInfo(slug);
    return {
      title:       `${salon.nameAr} — احجز موعدك`,
      description: salon.descriptionAr || `احجز موعدك في ${salon.nameAr}`,
      openGraph: {
        title:       salon.nameAr,
        description: salon.descriptionAr || '',
        images:      salon.coverUrl ? [salon.coverUrl] : [],
      },
    };
  } catch {
    return { title: 'صالون غير موجود' };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SalonPage({ params }: Props): Promise<ReactElement> {
  const { slug } = await params;

  let salon: SalonInfo;
  let categories: ServiceCategory[];

  try {
    [salon, categories] = await Promise.all([
      bookingApi.getSalonInfo(slug),
      bookingApi.getServices(slug),
    ]);
  } catch {
    notFound();
  }

  const resolved = await resolveTheme(slug);
  const layout = resolved.themeLayout;
  const today = getCurrentDay();
  const totalServices = categories.reduce((n, c) => n + c.services.length, 0);
  const isDark = layout === 'golden';

  return (
    <div className="min-h-dvh" style={{ background: isDark ? '#0a0a0a' : 'var(--color-bg)' }}>

      {/* ── 1. Hero ───────────────────────────────────────────────── */}
      <BookingHero salon={salon} slug={slug} />

      {/* ── 2. Services ───────────────────────────────────────────── */}
      {categories.length > 0 && (
        <ServicesSection
          categories={categories}
          slug={slug}
          layout={layout}
          totalServices={totalServices}
        />
      )}

      {/* ── 3. Working Hours ──────────────────────────────────────── */}
      <section className="px-4 py-10 md:py-14"
        style={{ background: isDark ? '#111' : undefined }}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: isDark ? 'rgba(212,175,55,0.15)' : 'var(--color-primary-subtle)',
                color: isDark ? '#D4AF37' : 'var(--color-primary)',
              }}>
              <Clock className="h-4.5 w-4.5" />
            </span>
            <h2 className="font-heading text-xl font-bold sm:text-2xl"
              style={{ color: isDark ? '#f5f5f5' : 'var(--color-text)' }}>
              أوقات العمل
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl"
            style={{
              background: isDark ? '#1a1a1a' : 'var(--color-surface)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--color-border)'}`,
            }}>
            {DAYS_ORDER.map((day, index) => {
              const schedule = salon.workingDays[day];
              const isToday = day === today;
              const isLast = index === DAYS_ORDER.length - 1;

              return (
                <div
                  key={day}
                  className={cn(
                    'flex items-center justify-between px-5 py-3.5 transition-colors',
                    !isLast && 'border-b',
                    isToday && 'font-semibold',
                  )}
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'var(--color-border)',
                    background: isToday
                      ? (isDark ? 'rgba(212,175,55,0.08)' : 'var(--color-primary-subtle)')
                      : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: schedule?.open
                          ? (isDark ? '#D4AF37' : 'var(--color-primary)')
                          : (isDark ? 'rgba(255,255,255,0.15)' : 'var(--color-border-strong)'),
                      }} />
                    <span className="text-sm sm:text-base"
                      style={{
                        color: isToday
                          ? (isDark ? '#D4AF37' : 'var(--color-primary)')
                          : (isDark ? '#ccc' : 'var(--color-text)'),
                      }}>
                      {DAYS_AR[day]}
                      {isToday && (
                        <span className="ms-2 text-xs font-normal"
                          style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'var(--color-text-muted)' }}>
                          (اليوم)
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums"
                    style={{
                      color: schedule?.open
                        ? (isDark ? '#ddd' : 'var(--color-text)')
                        : (isDark ? 'rgba(255,255,255,0.25)' : 'var(--color-text-subtle)'),
                    }}>
                    {schedule?.open
                      ? `${formatTime(schedule.start)} — ${formatTime(schedule.end)}`
                      : 'مغلق'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. Footer ─────────────────────────────────────────────── */}
      <SalonFooter salon={salon} />
    </div>
  );
}
