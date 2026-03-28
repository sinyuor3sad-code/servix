/**
 * SalonPage — app/[slug]/page.tsx  (Server Component)
 *
 * Public booking profile for a salon. Fully theme-aware via CSS variables.
 *
 * Sections:
 *  1. BookingHero    — cover/logo/name/CTA  (+ AnnouncementBar inside)
 *  2. WorkingHours   — weekly schedule card
 *  3. Services       — category groups → ServiceCard grid
 *  4. SalonFooter    — brand + social + "powered by"
 */

import type { ReactElement } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, Sparkles } from 'lucide-react';
import { bookingApi, type SalonInfo, type ServiceCategory } from '@/lib/api';
import BookingHero from '@/components/booking-hero';
import ServiceCard  from '@/components/service-card';
import SalonFooter  from '@/components/salon-footer';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ slug: string }>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_ORDER = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

const DAYS_AR: Record<string, string> = {
  saturday:  'السبت',
  sunday:    'الأحد',
  monday:    'الاثنين',
  tuesday:   'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday:  'الخميس',
  friday:    'الجمعة',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentDay(): string {
  const map = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return map[new Date().getDay()];
}

function formatTime(time: string): string {
  // "09:00:00" → "09:00"
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

  const today        = getCurrentDay();
  const totalServices = categories.reduce((n, c) => n + c.services.length, 0);

  // Pick up to 3 featured services (first from each category) for the hero badge
  const featuredServiceIds = new Set(
    categories.map(c => c.services[0]?.id).filter(Boolean),
  );

  return (
    <div
      className="min-h-dvh"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <BookingHero
        salon={salon}
        slug={slug}
        /* announcement can be fetched separately if the API supports it */
      />

      {/* ── 2. Working Hours ────────────────────────────────────────────── */}
      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-2xl">

          {/* Section heading */}
          <div className="mb-6 flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'var(--color-primary-subtle)',
                color:      'var(--color-primary)',
              }}
            >
              <Clock className="h-4.5 w-4.5" />
            </span>
            <h2
              className="font-heading text-xl font-bold sm:text-2xl"
              style={{ color: 'var(--color-text)' }}
            >
              أوقات العمل
            </h2>
          </div>

          {/* Schedule card */}
          <div
            className="card overflow-hidden"
            style={{ padding: 0 }}   /* card has default padding; remove it for table layout */
          >
            {DAYS_ORDER.map((day, index) => {
              const schedule = salon.workingDays[day];
              const isToday  = day === today;
              const isLast   = index === DAYS_ORDER.length - 1;

              return (
                <div
                  key={day}
                  className={cn(
                    'flex items-center justify-between px-5 py-3.5 transition-colors',
                    !isLast && 'border-b',
                    isToday && 'font-semibold',
                  )}
                  style={{
                    borderColor: 'var(--color-border)',
                    background:  isToday ? 'var(--color-primary-subtle)' : undefined,
                  }}
                >
                  {/* Day name + status dot */}
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: schedule?.open
                          ? 'var(--color-primary)'
                          : 'var(--color-border-strong)',
                      }}
                    />
                    <span
                      className="text-sm sm:text-base"
                      style={{
                        color: isToday
                          ? 'var(--color-primary)'
                          : 'var(--color-text)',
                      }}
                    >
                      {DAYS_AR[day]}
                      {isToday && (
                        <span
                          className="ms-2 text-xs font-normal"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          (اليوم)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Hours */}
                  <span
                    className="text-sm tabular-nums"
                    style={{
                      color: schedule?.open
                        ? 'var(--color-text)'
                        : 'var(--color-text-subtle)',
                    }}
                  >
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

      {/* ── 3. Services ─────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section
          className="px-4 py-12 md:py-16"
          style={{ background: 'var(--color-bg-2)' }}
        >
          <div className="mx-auto max-w-5xl">

            {/* Section heading */}
            <div className="mb-10 text-center">
              <div className="mb-3 flex items-center justify-center gap-2">
                <Sparkles
                  className="h-5 w-5"
                  style={{ color: 'var(--color-primary)' }}
                />
                <h2
                  className="font-heading text-2xl font-bold sm:text-3xl"
                  style={{ color: 'var(--color-text)' }}
                >
                  خدماتنا
                </h2>
              </div>
              {totalServices > 0 && (
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {totalServices} خدمة متاحة للحجز
                </p>
              )}
            </div>

            {/* Categories */}
            <div className="space-y-12">
              {categories.map((category) => (
                <div key={category.id}>

                  {/* Category label */}
                  <div className="mb-5 flex items-center gap-3">
                    <span
                      className="h-1 w-8 rounded-full"
                      style={{ background: 'var(--color-primary)' }}
                    />
                    <h3
                      className="font-heading text-lg font-semibold"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {category.nameAr}
                    </h3>
                    <span
                      className="badge"
                    >
                      {category.services.length}
                    </span>
                  </div>

                  {/* Service cards grid */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {category.services.map((service, idx) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        slug={slug}
                        featured={idx === 0 && featuredServiceIds.has(service.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Footer ───────────────────────────────────────────────────── */}
      <SalonFooter salon={salon} />
    </div>
  );
}
