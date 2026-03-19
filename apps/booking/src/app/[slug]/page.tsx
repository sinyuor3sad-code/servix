import type { CSSProperties, ReactElement } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Phone, Clock, Timer, ChevronLeft } from 'lucide-react';
import { bookingApi, type SalonInfo, type ServiceCategory } from '@/lib/api';
import { cn } from '@/lib/utils';

type Props = {
  params: Promise<{ slug: string }>;
};

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
  saturday: 'السبت',
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
};

function getCurrentDay(): string {
  const map = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return map[new Date().getDay()];
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

// ---------------------------------------------------------------------------
// SEO metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const salon = await bookingApi.getSalonInfo(slug);
    return {
      title: `${salon.nameAr} — احجز موعدك`,
      description: salon.descriptionAr || `احجز موعدك في ${salon.nameAr}`,
      openGraph: {
        title: salon.nameAr,
        description: salon.descriptionAr || '',
        images: salon.coverUrl ? [salon.coverUrl] : [],
      },
    };
  } catch {
    return { title: 'صالون غير موجود' };
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SalonPage({
  params,
}: Props): Promise<ReactElement> {
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

  const today = getCurrentDay();

  return (
    <main className="min-h-screen bg-(--background)">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {salon.coverUrl ? (
          <>
            <img
              src={salon.coverUrl}
              alt={salon.nameAr}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/40 to-black/70" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={
              {
                background:
                  'linear-gradient(135deg, var(--brand-primary-dark) 0%, var(--brand-primary) 50%, var(--brand-primary-light) 100%)',
              } as CSSProperties
            }
          />
        )}

        <div className="relative flex min-h-[380px] flex-col items-center justify-center px-6 py-16 text-center md:min-h-[460px] lg:min-h-[520px]">
          {salon.logoUrl ? (
            <img
              src={salon.logoUrl}
              alt={salon.nameAr}
              className="mb-5 h-24 w-24 rounded-full border-4 border-white/30 object-cover shadow-xl md:h-28 md:w-28"
            />
          ) : (
            <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 bg-white/20 text-4xl font-bold text-white shadow-xl backdrop-blur-sm md:h-28 md:w-28 md:text-5xl">
              {salon.nameAr.charAt(0)}
            </div>
          )}

          <h1 className="mb-3 text-3xl font-bold text-white drop-shadow-md md:text-4xl lg:text-5xl">
            {salon.nameAr}
          </h1>

          {salon.descriptionAr && (
            <p className="mb-6 max-w-lg text-base text-white/80 md:text-lg">
              {salon.descriptionAr}
            </p>
          )}

          <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
            {salon.city && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-sm">
                <MapPin className="h-4 w-4" />
                {salon.city}
              </span>
            )}

            {salon.phone && (
              <a
                href={`tel:${salon.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <Phone className="h-4 w-4" />
                <span dir="ltr">{salon.phone}</span>
              </a>
            )}
          </div>

          <Link
            href={`/${slug}/book`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-lg font-bold text-(--brand-primary) shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            احجز الآن
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ── Working Hours ────────────────────────────────────────────── */}
      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center gap-3">
            <Clock className="h-6 w-6 text-(--brand-primary)" />
            <h2 className="text-2xl font-bold text-(--foreground)">
              أوقات العمل
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-(--border) bg-(--card) shadow-sm">
            {DAYS_ORDER.map((day, index) => {
              const schedule = salon.workingDays[day];
              const isToday = day === today;
              const isLast = index === DAYS_ORDER.length - 1;

              return (
                <div
                  key={day}
                  className={cn(
                    'flex items-center justify-between px-5 py-3.5 transition-colors',
                    !isLast && 'border-b border-(--border)',
                    isToday && 'bg-(--muted)',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 shrink-0 rounded-full',
                        schedule?.open ? 'bg-(--success)' : 'bg-gray-300',
                      )}
                    />
                    <span
                      className={cn(
                        'text-sm font-medium sm:text-base',
                        isToday
                          ? 'font-bold text-(--brand-primary)'
                          : 'text-(--foreground)',
                      )}
                    >
                      {DAYS_AR[day]}
                      {isToday && (
                        <span className="ms-2 text-xs font-normal text-(--muted-foreground)">
                          (اليوم)
                        </span>
                      )}
                    </span>
                  </div>

                  <span
                    className={cn(
                      'text-sm',
                      schedule?.open
                        ? 'text-(--foreground)'
                        : 'text-(--muted-foreground)',
                    )}
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

      {/* ── Services ─────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="bg-(--muted) px-4 py-12 md:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-10 text-center text-2xl font-bold text-(--foreground) md:text-3xl">
              خدماتنا
            </h2>

            {categories.map((category) => (
              <div key={category.id} className="mb-10 last:mb-0">
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-1 w-8 rounded-full bg-(--brand-primary)" />
                  <h3 className="text-xl font-semibold text-(--foreground)">
                    {category.nameAr}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {category.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex flex-col rounded-xl bg-(--card) p-5 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <h4 className="mb-1 text-lg font-semibold text-(--card-foreground)">
                        {service.nameAr}
                      </h4>

                      {service.descriptionAr && (
                        <p className="mb-3 text-sm leading-relaxed text-(--muted-foreground)">
                          {service.descriptionAr}
                        </p>
                      )}

                      <div className="mt-auto border-t border-(--border) pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xl font-bold text-(--brand-primary)">
                            {service.price} ر.س
                          </span>
                          <span className="flex items-center gap-1 text-sm text-(--muted-foreground)">
                            <Timer className="h-4 w-4" />
                            {service.duration} دقيقة
                          </span>
                        </div>

                        <Link
                          href={`/${slug}/book?service=${service.id}`}
                          className="block w-full rounded-lg bg-(--brand-primary) px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-(--brand-primary-dark)"
                        >
                          احجز هذه الخدمة
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-(--border) bg-(--card) px-4 py-8">
        <div className="mx-auto max-w-6xl text-center">
          {/* Social links placeholder */}
          <div className="mb-4 flex items-center justify-center gap-4">
            <span className="text-sm text-(--muted-foreground)">
              تابعونا على وسائل التواصل الاجتماعي
            </span>
          </div>

          <p className="text-sm text-(--muted-foreground)">
            مدعوم بواسطة{' '}
            <a
              href="https://servix.sa"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-(--brand-primary) hover:underline"
            >
              SERVIX
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
